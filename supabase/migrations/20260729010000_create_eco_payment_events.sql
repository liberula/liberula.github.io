create table public.eco_payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'mercado_pago',
  provider_payment_id text not null,
  observation_key text not null,
  external_reference text not null,
  provider_status text not null,
  mapped_order_status text not null,
  provider_updated_at timestamptz not null,
  correlation_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint eco_payment_events_observation_unique unique (observation_key),
  constraint eco_payment_events_provider_check check (
    provider = 'mercado_pago'
  ),
  constraint eco_payment_events_payment_id_check check (
    provider_payment_id ~ '^[A-Za-z0-9_-]{1,200}$'
  ),
  constraint eco_payment_events_external_reference_check check (
    external_reference ~ '^eco_[a-f0-9]{32}$'
  ),
  constraint eco_payment_events_provider_status_check check (
    provider_status in (
      'approved', 'pending', 'in_process', 'rejected', 'cancelled', 'refunded'
    )
  ),
  constraint eco_payment_events_mapped_status_check check (
    mapped_order_status in (
      'pending', 'paid', 'rejected', 'cancelled', 'refunded'
    )
  ),
  constraint eco_payment_events_status_mapping_check check (
    (provider_status = 'approved' and mapped_order_status = 'paid')
    or
    (provider_status in ('pending', 'in_process') and mapped_order_status = 'pending')
    or
    (provider_status = mapped_order_status)
  ),
  constraint eco_payment_events_metadata_object_check check (
    jsonb_typeof(correlation_metadata) = 'object'
  )
);

create index eco_payment_events_payment_id_idx
  on public.eco_payment_events (provider_payment_id, provider_updated_at desc);
create index eco_payment_events_external_reference_idx
  on public.eco_payment_events (external_reference, provider_updated_at desc);

alter table public.eco_payment_events enable row level security;
revoke all on table public.eco_payment_events from anon, authenticated;

create table public.eco_status_rate_limits (
  rate_key text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1,
  expires_at timestamptz not null,
  primary key (rate_key, window_started_at),
  constraint eco_status_rate_limits_key_check check (
    rate_key ~ '^[a-f0-9]{64}$'
  ),
  constraint eco_status_rate_limits_count_check check (
    request_count between 1 and 1000
  )
);

create index eco_status_rate_limits_expiry_idx
  on public.eco_status_rate_limits (expires_at);

alter table public.eco_status_rate_limits enable row level security;
revoke all on table public.eco_status_rate_limits from anon, authenticated;

create or replace function public.consume_eco_status_rate_limit(
  p_rate_key text,
  p_window_seconds integer default 60,
  p_request_limit integer default 18
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  bounded_window integer := greatest(10, least(p_window_seconds, 3600));
  bounded_limit integer := greatest(1, least(p_request_limit, 1000));
  current_window timestamptz;
  current_count integer;
begin
  if p_rate_key !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_rate_key';
  end if;

  current_window := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / bounded_window)
      * bounded_window
  );

  insert into public.eco_status_rate_limits (
    rate_key,
    window_started_at,
    request_count,
    expires_at
  )
  values (
    p_rate_key,
    current_window,
    1,
    current_window + make_interval(secs => bounded_window * 2)
  )
  on conflict (rate_key, window_started_at)
  do update set request_count =
    least(public.eco_status_rate_limits.request_count + 1, 1000)
  returning request_count into current_count;

  delete from public.eco_status_rate_limits
  where (rate_key, window_started_at) in (
    select rate_key, window_started_at
    from public.eco_status_rate_limits
    where expires_at < clock_timestamp()
    order by expires_at
    limit 100
  );

  return jsonb_build_object(
    'allowed', current_count <= bounded_limit,
    'retryAfter', greatest(
      1,
      ceil(extract(epoch from (
        current_window + make_interval(secs => bounded_window)
        - clock_timestamp()
      )))::integer
    )
  );
end;
$$;

create or replace function public.process_eco_payment_event(
  p_provider_payment_id text,
  p_observation_key text,
  p_external_reference text,
  p_provider_status text,
  p_mapped_order_status text,
  p_provider_updated_at timestamptz,
  p_correlation_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_order public.eco_orders%rowtype;
  transition_result text := 'updated';
begin
  if p_provider_payment_id !~ '^[A-Za-z0-9_-]{1,200}$'
    or p_observation_key is null
    or char_length(p_observation_key) not between 16 and 300
    or p_external_reference !~ '^eco_[a-f0-9]{32}$'
    or p_provider_updated_at is null
    or coalesce(jsonb_typeof(p_correlation_metadata), '') <> 'object'
  then
    return jsonb_build_object('result', 'invalid_event');
  end if;

  if not (
    (p_provider_status = 'approved' and p_mapped_order_status = 'paid')
    or
    (
      p_provider_status in ('pending', 'in_process')
      and p_mapped_order_status = 'pending'
    )
    or
    (
      p_provider_status in ('rejected', 'cancelled', 'refunded')
      and p_mapped_order_status = p_provider_status
    )
  ) then
    return jsonb_build_object('result', 'invalid_event');
  end if;

  select *
  into selected_order
  from public.eco_orders
  where external_reference = p_external_reference
  for update;

  if not found then
    return jsonb_build_object('result', 'unknown_order');
  end if;

  if selected_order.case_id <> 'eco-sp-001'
    or selected_order.amount_cents <> 7990
    or selected_order.currency <> 'BRL'
  then
    return jsonb_build_object('result', 'order_invariant_mismatch');
  end if;

  if exists (
    select 1 from public.eco_payment_events
    where observation_key = p_observation_key
  ) then
    return jsonb_build_object('result', 'duplicate');
  end if;

  if selected_order.provider_payment_id is not null
    and selected_order.provider_payment_id <> p_provider_payment_id
  then
    return jsonb_build_object('result', 'payment_id_conflict');
  end if;

  if exists (
    select 1 from public.eco_orders
    where provider_payment_id = p_provider_payment_id
      and id <> selected_order.id
  ) then
    return jsonb_build_object('result', 'payment_id_conflict');
  end if;

  if selected_order.provider_updated_at is not null
    and p_provider_updated_at <= selected_order.provider_updated_at
  then
    transition_result := 'ignored_older';
  elsif selected_order.status = 'paid'
    and p_mapped_order_status in ('pending', 'rejected', 'cancelled')
  then
    transition_result := 'ignored_protected';
  elsif selected_order.status = 'refunded'
    and p_mapped_order_status <> 'refunded'
  then
    transition_result := 'ignored_protected';
  else
    update public.eco_orders
    set provider_payment_id = coalesce(
          provider_payment_id,
          p_provider_payment_id
        ),
        status = p_mapped_order_status,
        provider_updated_at = p_provider_updated_at
    where id = selected_order.id;
  end if;

  if transition_result = 'ignored_protected' then
    update public.eco_orders
    set provider_payment_id = coalesce(
          provider_payment_id,
          p_provider_payment_id
        ),
        provider_updated_at = p_provider_updated_at
    where id = selected_order.id;
  end if;

  insert into public.eco_payment_events (
    provider_payment_id,
    observation_key,
    external_reference,
    provider_status,
    mapped_order_status,
    provider_updated_at,
    correlation_metadata
  )
  values (
    p_provider_payment_id,
    p_observation_key,
    p_external_reference,
    p_provider_status,
    p_mapped_order_status,
    p_provider_updated_at,
    p_correlation_metadata
  )
  on conflict (observation_key) do nothing;

  if not found then
    return jsonb_build_object('result', 'duplicate');
  end if;

  return jsonb_build_object('result', transition_result);
end;
$$;

revoke all on function public.consume_eco_status_rate_limit(text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.process_eco_payment_event(
  text, text, text, text, text, timestamptz, jsonb
) from public, anon, authenticated;

grant execute on function public.consume_eco_status_rate_limit(
  text, integer, integer
) to service_role;
grant execute on function public.process_eco_payment_event(
  text, text, text, text, text, timestamptz, jsonb
) to service_role;
