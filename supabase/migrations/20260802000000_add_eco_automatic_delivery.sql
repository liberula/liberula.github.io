alter table public.eco_case_deliveries
  add column origin text not null default 'manual';

alter table public.eco_case_deliveries
  add constraint eco_case_deliveries_origin_check
  check (origin in ('manual', 'automatic'));

create table public.eco_runtime_settings (
  key text primary key,
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint eco_runtime_settings_key_check check (
    key = 'automatic_case_delivery_enabled'
  ),
  constraint eco_runtime_settings_updated_by_check check (
    updated_by is null or char_length(btrim(updated_by)) between 1 and 120
  )
);

insert into public.eco_runtime_settings (key, enabled, updated_by)
values ('automatic_case_delivery_enabled', false, 'migration')
on conflict (key) do nothing;

create table public.eco_automatic_delivery_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  participant_id uuid not null references public.eco_participants (id),
  case_id text not null references public.eco_cases (id),
  source_event_id uuid not null references public.eco_ingested_events (event_id),
  status text not null default 'pending',
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint eco_automatic_delivery_jobs_status_check check (
    status in ('pending', 'processing', 'completed', 'failed', 'cancelled')
  ),
  constraint eco_automatic_delivery_jobs_attempt_check check (
    attempt_count between 0 and 3
  ),
  constraint eco_automatic_delivery_jobs_source_case_unique unique (
    source_event_id,
    case_id
  )
);

create index eco_automatic_delivery_jobs_pending_idx
  on public.eco_automatic_delivery_jobs (available_at, created_at)
  where status = 'pending';

create index eco_automatic_delivery_jobs_participant_idx
  on public.eco_automatic_delivery_jobs (participant_id, case_id);

alter table public.eco_runtime_settings enable row level security;
alter table public.eco_automatic_delivery_jobs enable row level security;

revoke all on table public.eco_runtime_settings
  from public, anon, authenticated;
revoke all on table public.eco_automatic_delivery_jobs
  from public, anon, authenticated;

grant select, insert, update, delete on table public.eco_runtime_settings
  to service_role;
grant select, insert, update, delete on table public.eco_automatic_delivery_jobs
  to service_role;

create or replace function public.prepare_eco_case_deliveries_automatic(
  p_case_id text,
  p_participant_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  prepared jsonb;
begin
  prepared := public.prepare_eco_case_deliveries(
    p_case_id,
    p_participant_ids
  );

  if prepared ? 'error' then
    return prepared;
  end if;

  update public.eco_case_deliveries
  set origin = 'automatic',
      updated_at = now()
  where case_id = btrim(p_case_id)
    and participant_id = any(p_participant_ids)
    and status <> 'sent';

  return prepared;
end;
$$;

revoke all on function public.prepare_eco_case_deliveries_automatic(text, uuid[])
  from public, anon, authenticated;
grant execute on function public.prepare_eco_case_deliveries_automatic(text, uuid[])
  to service_role;

create or replace function public.prepare_eco_case_deliveries_manual(
  p_case_id text,
  p_participant_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  prepared jsonb;
begin
  prepared := public.prepare_eco_case_deliveries(
    p_case_id,
    p_participant_ids
  );
  if prepared ? 'error' then return prepared; end if;
  update public.eco_case_deliveries
  set origin = 'manual', updated_at = now()
  where case_id = btrim(p_case_id)
    and participant_id = any(p_participant_ids)
    and status <> 'sent';
  return prepared;
end;
$$;

revoke all on function public.prepare_eco_case_deliveries_manual(text, uuid[])
  from public, anon, authenticated;
grant execute on function public.prepare_eco_case_deliveries_manual(text, uuid[])
  to service_role;

alter function public.ingest_eco_participant_event(
  uuid,
  text,
  integer,
  timestamptz,
  text,
  text,
  text,
  text,
  boolean,
  text,
  text,
  jsonb
) rename to ingest_eco_participant_event_core;

revoke all on function public.ingest_eco_participant_event_core(
  uuid,
  text,
  integer,
  timestamptz,
  text,
  text,
  text,
  text,
  boolean,
  text,
  text,
  jsonb
) from public, anon, authenticated, service_role;

create function public.ingest_eco_participant_event(
  p_event_id uuid,
  p_event_type text,
  p_event_version integer,
  p_occurred_at timestamptz,
  p_source_system text,
  p_source_record_id text,
  p_participant_name text,
  p_participant_email text,
  p_participant_consent boolean,
  p_project text,
  p_funnel text,
  p_acquisition jsonb,
  p_delivery_mode text default 'none'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ingestion jsonb;
  ingestion_result text;
  selected_participant_id uuid;
  job_enqueued boolean := false;
  automation_enabled boolean := false;
begin
  if p_delivery_mode is null
    or p_delivery_mode not in ('none', 'automatic_if_enabled')
  then
    raise exception 'invalid_eco_delivery_mode';
  end if;

  ingestion := public.ingest_eco_participant_event_core(
    p_event_id,
    p_event_type,
    p_event_version,
    p_occurred_at,
    p_source_system,
    p_source_record_id,
    p_participant_name,
    p_participant_email,
    p_participant_consent,
    p_project,
    p_funnel,
    p_acquisition
  );
  ingestion_result := ingestion->>'result';

  if ingestion_result in ('created', 'linked')
    and p_delivery_mode = 'automatic_if_enabled'
  then
    -- Serialize enqueue with toggle-off. If ingestion wins, the following
    -- disable waits and cancels this pending job; if disable wins, this reads false.
    select enabled into automation_enabled
    from public.eco_runtime_settings
    where key = 'automatic_case_delivery_enabled'
    for update;

    if coalesce(automation_enabled, false) then
    select source.participant_id
    into selected_participant_id
    from public.eco_participant_sources as source
    where source.source_system = p_source_system
      and source.source_record_id = btrim(p_source_record_id);

    if selected_participant_id is not null
      and not exists (
        select 1
        from public.eco_case_deliveries as delivery
        where delivery.participant_id = selected_participant_id
          and delivery.case_id = 'eco-sp-001'
          and delivery.status = 'sent'
      )
    then
      insert into public.eco_automatic_delivery_jobs (
        participant_id,
        case_id,
        source_event_id,
        status,
        available_at
      ) values (
        selected_participant_id,
        'eco-sp-001',
        p_event_id,
        'pending',
        now()
      )
      on conflict (source_event_id, case_id) do nothing;
      job_enqueued := found;
    end if;
    end if;
  end if;

  return ingestion || jsonb_build_object(
    'automatic_job_enqueued',
    job_enqueued
  );
end;
$$;

revoke all on function public.ingest_eco_participant_event(
  uuid,
  text,
  integer,
  timestamptz,
  text,
  text,
  text,
  text,
  boolean,
  text,
  text,
  jsonb,
  text
) from public, anon, authenticated;
grant execute on function public.ingest_eco_participant_event(
  uuid,
  text,
  integer,
  timestamptz,
  text,
  text,
  text,
  text,
  boolean,
  text,
  text,
  jsonb,
  text
) to service_role;

create function public.get_eco_automation_summary()
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'automatic_case_delivery_enabled',
      coalesce((
        select enabled
        from public.eco_runtime_settings
        where key = 'automatic_case_delivery_enabled'
      ), false),
    'pending_count', (
      select count(*)
      from public.eco_automatic_delivery_jobs
      where status = 'pending'
    ),
    'failed_count', (
      select count(*)
      from public.eco_automatic_delivery_jobs
      where status = 'failed'
    ),
    'completed_last_24h_count', (
      select count(*)
      from public.eco_automatic_delivery_jobs
      where status = 'completed'
        and completed_at >= now() - interval '24 hours'
    )
  );
$$;

create function public.set_eco_automatic_delivery_enabled(
  p_enabled boolean,
  p_updated_by text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_actor text := nullif(btrim(p_updated_by), '');
begin
  if p_enabled is null
    or normalized_actor is null
    or char_length(normalized_actor) > 120
  then
    raise exception 'invalid_eco_automation_setting';
  end if;

  insert into public.eco_runtime_settings (key, enabled, updated_at, updated_by)
  values (
    'automatic_case_delivery_enabled',
    p_enabled,
    now(),
    normalized_actor
  )
  on conflict (key) do update
  set enabled = excluded.enabled,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;

  if p_enabled = false then
    update public.eco_automatic_delivery_jobs
    set status = 'cancelled',
        last_error_code = 'automation_disabled',
        updated_at = now()
    where status = 'pending';
  end if;

  return public.get_eco_automation_summary();
end;
$$;

create function public.claim_eco_automatic_delivery_jobs(
  p_limit integer default 3
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed jsonb;
begin
  if p_limit is null or p_limit < 1 or p_limit > 10 then
    raise exception 'invalid_eco_automatic_job_limit';
  end if;

  if not exists (
    select 1 from public.eco_runtime_settings
    where key = 'automatic_case_delivery_enabled' and enabled = true
  ) then
    return '[]'::jsonb;
  end if;

  with candidates as (
    select job.id
    from public.eco_automatic_delivery_jobs as job
    where job.status = 'pending'
      and job.available_at <= now()
      and job.attempt_count < 3
    order by job.available_at, job.created_at, job.id
    for update skip locked
    limit p_limit
  ), updated as (
    update public.eco_automatic_delivery_jobs as job
    set status = 'processing',
        attempt_count = job.attempt_count + 1,
        claimed_at = now(),
        updated_at = now()
    from candidates
    where job.id = candidates.id
    returning job.id, job.participant_id, job.case_id, job.attempt_count
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'job_id', id,
        'participant_id', participant_id,
        'case_id', case_id,
        'attempt_count', attempt_count
      ) order by id
    ),
    '[]'::jsonb
  ) into claimed
  from updated;

  return claimed;
end;
$$;

create function public.recover_stale_eco_automatic_delivery_jobs()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  recovered integer := 0;
  current_job public.eco_automatic_delivery_jobs%rowtype;
  delivery_status text;
  setting_enabled boolean := false;
begin
  select coalesce(enabled, false) into setting_enabled
  from public.eco_runtime_settings
  where key = 'automatic_case_delivery_enabled';

  for current_job in
    select *
    from public.eco_automatic_delivery_jobs
    where status = 'processing'
      and claimed_at <= now() - interval '10 minutes'
    order by claimed_at, id
    for update skip locked
    limit 10
  loop
    select status into delivery_status
    from public.eco_case_deliveries
    where participant_id = current_job.participant_id
      and case_id = current_job.case_id;

    if delivery_status = 'sent' then
      update public.eco_automatic_delivery_jobs
      set status = 'completed', completed_at = now(),
          last_error_code = null, updated_at = now()
      where id = current_job.id;
    elsif delivery_status = 'sending' then
      update public.eco_case_deliveries
      set status = 'failed', last_error_code = 'postmark_result_unknown',
          updated_at = now()
      where participant_id = current_job.participant_id
        and case_id = current_job.case_id
        and status = 'sending';
      update public.eco_automatic_delivery_jobs
      set status = 'failed', last_error_code = 'postmark_result_unknown',
          updated_at = now()
      where id = current_job.id;
    elsif setting_enabled and current_job.attempt_count < 3 then
      update public.eco_automatic_delivery_jobs
      set status = 'pending', available_at = now(), claimed_at = null,
          last_error_code = 'temporary_dispatch_failure', updated_at = now()
      where id = current_job.id;
    else
      update public.eco_automatic_delivery_jobs
      set status = 'failed', last_error_code = case
            when current_job.attempt_count >= 3 then 'retry_limit_reached'
            else 'temporary_dispatch_failure'
          end,
          updated_at = now()
      where id = current_job.id;
    end if;
    recovered := recovered + 1;
  end loop;
  return recovered;
end;
$$;

create function public.complete_eco_automatic_delivery_job(p_job_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  update public.eco_automatic_delivery_jobs
  set status = 'completed',
      completed_at = now(),
      last_error_code = null,
      updated_at = now()
  where id = p_job_id and status = 'processing';
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

create function public.fail_eco_automatic_delivery_job(
  p_job_id uuid,
  p_error_code text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_job public.eco_automatic_delivery_jobs%rowtype;
  setting_enabled boolean;
  retryable boolean;
  next_status text;
begin
  if p_error_code not in (
    'postmark_timeout',
    'postmark_network_error',
    'postmark_server_error',
    'temporary_dispatch_failure',
    'postmark_unauthorized',
    'postmark_configuration_missing',
    'postmark_rejected',
    'postmark_invalid_response',
    'postmark_result_unknown',
    'participant_ineligible',
    'case_inactive',
    'already_sent',
    'invalid_email',
    'retry_limit_reached'
  ) then
    raise exception 'invalid_eco_automatic_job_error';
  end if;

  select * into selected_job
  from public.eco_automatic_delivery_jobs
  where id = p_job_id
  for update;
  if not found or selected_job.status <> 'processing' then
    return 'unchanged';
  end if;

  select coalesce(enabled, false) into setting_enabled
  from public.eco_runtime_settings
  where key = 'automatic_case_delivery_enabled';
  retryable := p_error_code in (
    'postmark_timeout',
    'postmark_network_error',
    'postmark_server_error',
    'temporary_dispatch_failure'
  );

  if retryable and setting_enabled and selected_job.attempt_count < 3 then
    next_status := 'pending';
    update public.eco_automatic_delivery_jobs
    set status = 'pending',
        available_at = now() + case
          when selected_job.attempt_count = 1 then interval '5 minutes'
          else interval '30 minutes'
        end,
        claimed_at = null,
        last_error_code = p_error_code,
        updated_at = now()
    where id = p_job_id;
  else
    next_status := 'failed';
    update public.eco_automatic_delivery_jobs
    set status = 'failed',
        last_error_code = case
          when retryable and selected_job.attempt_count >= 3
            then 'retry_limit_reached'
          else p_error_code
        end,
        updated_at = now()
    where id = p_job_id;
  end if;

  return next_status;
end;
$$;

revoke all on function public.get_eco_automation_summary()
  from public, anon, authenticated;
revoke all on function public.set_eco_automatic_delivery_enabled(boolean, text)
  from public, anon, authenticated;
revoke all on function public.claim_eco_automatic_delivery_jobs(integer)
  from public, anon, authenticated;
revoke all on function public.recover_stale_eco_automatic_delivery_jobs()
  from public, anon, authenticated;
revoke all on function public.complete_eco_automatic_delivery_job(uuid)
  from public, anon, authenticated;
revoke all on function public.fail_eco_automatic_delivery_job(uuid, text)
  from public, anon, authenticated;

grant execute on function public.get_eco_automation_summary()
  to service_role;
grant execute on function public.set_eco_automatic_delivery_enabled(boolean, text)
  to service_role;
grant execute on function public.claim_eco_automatic_delivery_jobs(integer)
  to service_role;
grant execute on function public.recover_stale_eco_automatic_delivery_jobs()
  to service_role;
grant execute on function public.complete_eco_automatic_delivery_job(uuid)
  to service_role;
grant execute on function public.fail_eco_automatic_delivery_job(uuid, text)
  to service_role;
