create extension if not exists pgcrypto with schema extensions;

create table public.eco_participants (
  id uuid primary key default extensions.gen_random_uuid(),
  email text not null,
  name text,
  status text not null default 'registered',
  consent boolean not null,
  registered_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint eco_participants_email_normalized_check check (
    email = lower(btrim(email)) and email <> ''
  ),
  constraint eco_participants_status_check check (
    status in ('registered', 'active', 'paused', 'completed', 'blocked')
  )
);

create unique index eco_participants_email_lower_unique
  on public.eco_participants (lower(email));

create table public.eco_participant_sources (
  id uuid primary key default extensions.gen_random_uuid(),
  participant_id uuid not null references public.eco_participants (id),
  source_system text not null,
  source_record_id text not null,
  project text,
  funnel text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz,
  created_at timestamptz not null default now(),
  constraint eco_participant_sources_identity_unique unique (
    source_system,
    source_record_id
  ),
  constraint eco_participant_sources_metadata_check check (
    jsonb_typeof(metadata) = 'object'
  )
);

create index eco_participant_sources_participant_idx
  on public.eco_participant_sources (participant_id);

create table public.eco_ingested_events (
  event_id uuid primary key,
  event_type text not null,
  event_version integer not null,
  source_system text not null,
  source_record_id text not null,
  received_at timestamptz not null default now(),
  constraint eco_ingested_events_source_identity_unique unique (
    source_system,
    source_record_id,
    event_type
  )
);

create table public.eco_cases (
  id text primary key,
  sequence_number integer not null unique,
  title text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint eco_cases_status_check check (
    status in ('draft', 'active', 'retired')
  )
);

insert into public.eco_cases (
  id,
  sequence_number,
  title,
  status
) values (
  'eco-sp-001',
  1,
  'Atalho',
  'active'
)
on conflict (id) do update
set sequence_number = excluded.sequence_number,
    title = excluded.title,
    status = excluded.status,
    updated_at = now();

create table public.eco_case_deliveries (
  id uuid primary key default extensions.gen_random_uuid(),
  participant_id uuid not null references public.eco_participants (id),
  case_id text not null references public.eco_cases (id),
  status text not null default 'pending',
  delivery_reference text not null,
  requested_at timestamptz not null,
  sent_at timestamptz,
  opened_at timestamptz,
  email_provider text,
  provider_message_id text,
  attempt_count integer not null default 0,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint eco_case_deliveries_participant_case_unique unique (
    participant_id,
    case_id
  ),
  constraint eco_case_deliveries_reference_unique unique (
    delivery_reference
  ),
  constraint eco_case_deliveries_status_check check (
    status in ('pending', 'sending', 'sent', 'failed', 'cancelled')
  ),
  constraint eco_case_deliveries_attempt_count_check check (
    attempt_count >= 0
  )
);

create index eco_case_deliveries_case_idx
  on public.eco_case_deliveries (case_id);

alter table public.eco_participants enable row level security;
alter table public.eco_participant_sources enable row level security;
alter table public.eco_ingested_events enable row level security;
alter table public.eco_cases enable row level security;
alter table public.eco_case_deliveries enable row level security;

revoke all on table public.eco_participants
  from public, anon, authenticated;
revoke all on table public.eco_participant_sources
  from public, anon, authenticated;
revoke all on table public.eco_ingested_events
  from public, anon, authenticated;
revoke all on table public.eco_cases
  from public, anon, authenticated;
revoke all on table public.eco_case_deliveries
  from public, anon, authenticated;

grant select, insert, update, delete on table public.eco_participants
  to service_role;
grant select, insert, update, delete on table public.eco_participant_sources
  to service_role;
grant select, insert, update, delete on table public.eco_ingested_events
  to service_role;
grant select, insert, update, delete on table public.eco_cases
  to service_role;
grant select, insert, update, delete on table public.eco_case_deliveries
  to service_role;

create or replace function public.ingest_eco_participant_event(
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
  p_acquisition jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(p_participant_email));
  normalized_name text := nullif(btrim(p_participant_name), '');
  selected_participant public.eco_participants%rowtype;
  ingestion_result text;
begin
  if p_event_id is null
    or p_event_type <> 'eco.participant.registered'
    or p_event_version <> 1
    or p_occurred_at is null
    or p_source_system <> 'quaero'
    or nullif(btrim(p_source_record_id), '') is null
    or char_length(btrim(p_source_record_id)) > 200
    or normalized_email is null
    or normalized_email = ''
    or char_length(normalized_email) > 320
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or (normalized_name is not null and char_length(normalized_name) > 120)
    or p_participant_consent is distinct from true
    or p_project <> 'eco'
    or p_funnel <> 'free_recruitment'
    or coalesce(jsonb_typeof(p_acquisition), '') <> 'object'
    or coalesce(p_acquisition->>'project', '') <> p_project
    or coalesce(p_acquisition->>'funnel', '') <> p_funnel
  then
    raise exception 'invalid_eco_participant_event';
  end if;

  -- Every competing transaction acquires locks in the same order. This makes
  -- retries and concurrent deliveries deterministic without partial writes.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('eco-event:' || p_event_id::text, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'eco-source:' || p_source_system || ':' || btrim(p_source_record_id),
      0
    )
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('eco-email:' || normalized_email, 0)
  );

  if exists (
    select 1
    from public.eco_ingested_events
    where event_id = p_event_id
  ) or exists (
    select 1
    from public.eco_participant_sources
    where source_system = p_source_system
      and source_record_id = btrim(p_source_record_id)
  ) then
    return jsonb_build_object('result', 'duplicate');
  end if;

  select *
  into selected_participant
  from public.eco_participants
  where lower(email) = normalized_email
  for update;

  if found then
    ingestion_result := 'linked';

    update public.eco_participants
    set name = case
          when nullif(btrim(name), '') is null and normalized_name is not null
            then normalized_name
          else name
        end,
        registered_at = least(registered_at, p_occurred_at),
        updated_at = case
          when (
            nullif(btrim(name), '') is null and normalized_name is not null
          ) or p_occurred_at < registered_at
            then now()
          else updated_at
        end
    where id = selected_participant.id
    returning * into selected_participant;
  else
    ingestion_result := 'created';

    insert into public.eco_participants (
      email,
      name,
      consent,
      registered_at
    ) values (
      normalized_email,
      normalized_name,
      true,
      p_occurred_at
    )
    returning * into selected_participant;
  end if;

  insert into public.eco_participant_sources (
    participant_id,
    source_system,
    source_record_id,
    project,
    funnel,
    metadata,
    occurred_at
  ) values (
    selected_participant.id,
    p_source_system,
    btrim(p_source_record_id),
    p_project,
    p_funnel,
    p_acquisition,
    p_occurred_at
  );

  insert into public.eco_ingested_events (
    event_id,
    event_type,
    event_version,
    source_system,
    source_record_id
  ) values (
    p_event_id,
    p_event_type,
    p_event_version,
    p_source_system,
    btrim(p_source_record_id)
  );

  return jsonb_build_object('result', ingestion_result);
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
  jsonb
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
  jsonb
) to service_role;
