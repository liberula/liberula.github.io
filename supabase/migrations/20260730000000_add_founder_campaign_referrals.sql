-- T004 keeps referral attribution on eco_orders. This is the smallest model
-- that preserves idempotent order creation, authoritative paid conversion,
-- and future reward eligibility without creating a second order-like ledger.

create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if to_regprocedure('extensions.gen_random_bytes(integer)') is null then
    raise exception 'extensions.gen_random_bytes(integer) is unavailable';
  end if;
end;
$$;

create table public.eco_campaigns (
  id text primary key,
  case_id text not null,
  production_target integer not null,
  closes_at timestamptz not null,
  explicitly_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint eco_campaigns_id_check check (id = 'eco-sp-001-founder'),
  constraint eco_campaigns_case_check check (case_id = 'eco-sp-001'),
  constraint eco_campaigns_target_check check (production_target = 100)
);

insert into public.eco_campaigns (
  id,
  case_id,
  production_target,
  closes_at
) values (
  'eco-sp-001-founder',
  'eco-sp-001',
  100,
  '2026-08-31 23:59:59-03'
);

alter table public.eco_campaigns enable row level security;
revoke all on table public.eco_campaigns from anon, authenticated;

alter table public.eco_orders
  add column campaign_id text not null default 'eco-sp-001-founder';

-- Add referral_code as nullable for a collision-safe existing-row backfill.
-- New rows receive the same opaque random format after the backfill completes.
alter table public.eco_orders
  add column referral_code text;

alter table public.eco_orders
  add column referral_code_used text;

alter table public.eco_orders
  add column referrer_order_id uuid;

alter table public.eco_orders
  add column referral_converted_at timestamptz;

do $$
declare
  target_order_id uuid;
  candidate_code text;
  generation_attempts integer;
begin
  for target_order_id in
    select id
    from public.eco_orders
    where referral_code is null
    order by id
    for update
  loop
    generation_attempts := 0;
    loop
      generation_attempts := generation_attempts + 1;
      candidate_code := upper(
        substr(
          encode(extensions.gen_random_bytes(8), 'hex'),
          1,
          12
        )
      );

      exit when not exists (
        select 1
        from public.eco_orders
        where referral_code = candidate_code
      );

      if generation_attempts >= 100 then
        raise exception 'unable to generate a unique referral code';
      end if;
    end loop;

    update public.eco_orders
    set referral_code = candidate_code
    where id = target_order_id;
  end loop;
end;
$$;

alter table public.eco_orders
  alter column referral_code set default
    upper(
      substr(
        encode(extensions.gen_random_bytes(8), 'hex'),
        1,
        12
      )
    ),
  alter column referral_code set not null;

alter table public.eco_orders
  add constraint eco_orders_campaign_fk foreign key (campaign_id)
    references public.eco_campaigns (id);

alter table public.eco_orders
  add constraint eco_orders_referrer_fk foreign key (referrer_order_id)
    references public.eco_orders (id);

alter table public.eco_orders
  add constraint eco_orders_campaign_check check (
    campaign_id = 'eco-sp-001-founder'
  );

alter table public.eco_orders
  add constraint eco_orders_referral_code_format_check check (
    referral_code ~ '^[A-F0-9]{12}$'
  );

alter table public.eco_orders
  add constraint eco_orders_referral_code_used_format_check check (
    referral_code_used is null
    or referral_code_used ~ '^[A-F0-9]{12}$'
  );

alter table public.eco_orders
  add constraint eco_orders_referral_pair_check check (
    (referral_code_used is null and referrer_order_id is null)
    or
    (referral_code_used is not null and referrer_order_id is not null)
  );

alter table public.eco_orders
  add constraint eco_orders_no_self_referral_check check (
    referrer_order_id is null or referrer_order_id <> id
  );

alter table public.eco_orders
  add constraint eco_orders_conversion_requires_referrer_check check (
    referral_converted_at is null or referrer_order_id is not null
  );

alter table public.eco_orders
  add constraint eco_orders_referral_code_unique unique (referral_code);

create index eco_orders_campaign_paid_idx
  on public.eco_orders (campaign_id, status)
  where status = 'paid';

create index eco_orders_referral_lookup_idx
  on public.eco_orders (campaign_id, referral_code, status);

create index eco_orders_referrer_idx
  on public.eco_orders (referrer_order_id)
  where referrer_order_id is not null;

create or replace function public.eco_orders_protect_immutable_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.public_reference is distinct from old.public_reference
    or new.client_idempotency_key is distinct from old.client_idempotency_key
    or new.external_reference is distinct from old.external_reference
    or new.case_id is distinct from old.case_id
    or new.campaign_id is distinct from old.campaign_id
    or new.amount_cents is distinct from old.amount_cents
    or new.currency is distinct from old.currency
    or new.site_origin is distinct from old.site_origin
    or new.referral_code is distinct from old.referral_code
    or (
      old.status in ('paid', 'refunded')
      and (
        new.referral_code_used is distinct from old.referral_code_used
        or new.referrer_order_id is distinct from old.referrer_order_id
        or (
          old.referral_converted_at is not null
          and new.referral_converted_at
            is distinct from old.referral_converted_at
        )
      )
    )
  then
    raise exception 'immutable_eco_order_field';
  end if;
  return new;
end;
$$;

drop function public.create_or_get_eco_order(
  uuid, text, text, text, text, text, text, text, text, text, text, text
);

create or replace function public.create_or_get_eco_order(
  p_client_idempotency_key uuid,
  p_buyer_name text,
  p_buyer_email text,
  p_buyer_whatsapp text,
  p_delivery_street text,
  p_delivery_number text,
  p_delivery_complement text,
  p_delivery_neighborhood text,
  p_delivery_city text,
  p_delivery_state text,
  p_delivery_postal_code text,
  p_site_origin text,
  p_referral_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_order public.eco_orders%rowtype;
  selected_referrer public.eco_orders%rowtype;
  normalized_referral_code text;
begin
  normalized_referral_code := upper(trim(coalesce(p_referral_code, '')));

  if normalized_referral_code ~ '^[A-F0-9]{12}$' then
    select *
    into selected_referrer
    from public.eco_orders
    where campaign_id = 'eco-sp-001-founder'
      and referral_code = normalized_referral_code
      and status = 'paid'
    limit 1;
  end if;

  insert into public.eco_orders (
    client_idempotency_key,
    buyer_name,
    buyer_email,
    buyer_whatsapp,
    delivery_street,
    delivery_number,
    delivery_complement,
    delivery_neighborhood,
    delivery_city,
    delivery_state,
    delivery_postal_code,
    site_origin,
    referral_code_used,
    referrer_order_id
  )
  values (
    p_client_idempotency_key,
    p_buyer_name,
    p_buyer_email,
    p_buyer_whatsapp,
    p_delivery_street,
    p_delivery_number,
    coalesce(p_delivery_complement, ''),
    p_delivery_neighborhood,
    p_delivery_city,
    p_delivery_state,
    p_delivery_postal_code,
    p_site_origin,
    case when selected_referrer.id is null
      then null else selected_referrer.referral_code end,
    selected_referrer.id
  )
  on conflict (client_idempotency_key) do nothing;

  select *
  into strict selected_order
  from public.eco_orders
  where client_idempotency_key = p_client_idempotency_key;

  return jsonb_build_object(
    'orderReference', selected_order.public_reference,
    'externalReference', selected_order.external_reference,
    'providerIdempotencyKey', selected_order.id::text,
    'checkoutUrl', selected_order.sandbox_checkout_url,
    'preferenceId', selected_order.mercado_pago_preference_id,
    'siteOrigin', selected_order.site_origin,
    'referralCode', selected_order.referral_code,
    'referralAttributed', selected_order.referrer_order_id is not null
  );
end;
$$;

revoke all on function public.create_or_get_eco_order(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.create_or_get_eco_order(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text
) to service_role;

create or replace function public.get_eco_campaign_progress()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  campaign public.eco_campaigns%rowtype;
  confirmed_count integer;
  campaign_status text;
begin
  select *
  into strict campaign
  from public.eco_campaigns
  where id = 'eco-sp-001-founder';

  -- Refunded orders are intentionally excluded: the canonical current order
  -- state is no longer paid, matching the existing payment-state model.
  select count(*)::integer
  into confirmed_count
  from public.eco_orders
  where campaign_id = campaign.id
    and status = 'paid';

  campaign_status := case
    when campaign.explicitly_closed or clock_timestamp() > campaign.closes_at
      then 'closed'
    when confirmed_count >= campaign.production_target
      then 'goal_reached'
    else 'collecting'
  end;

  return jsonb_build_object(
    'campaignId', campaign.id,
    'confirmed', confirmed_count,
    'target', campaign.production_target,
    'goalReached', confirmed_count >= campaign.production_target,
    'status', campaign_status,
    'closesAt', campaign.closes_at
  );
end;
$$;

revoke all on function public.get_eco_campaign_progress()
  from public, anon, authenticated;
grant execute on function public.get_eco_campaign_progress()
  to service_role;

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
  referral_was_converted boolean := false;
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
    or (p_provider_status in ('pending', 'in_process')
      and p_mapped_order_status = 'pending')
    or (p_provider_status in ('rejected', 'cancelled', 'refunded')
      and p_mapped_order_status = p_provider_status)
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

  if transition_result = 'updated'
    and p_mapped_order_status = 'paid'
    and selected_order.referrer_order_id is not null
    and selected_order.referrer_order_id <> selected_order.id
    and selected_order.referral_converted_at is null
  then
    update public.eco_orders referred
    set referral_converted_at = p_provider_updated_at
    where referred.id = selected_order.id
      and exists (
        select 1
        from public.eco_orders referrer
        where referrer.id = selected_order.referrer_order_id
          and referrer.id <> referred.id
          and referrer.campaign_id = referred.campaign_id
          and referrer.status = 'paid'
      );
    referral_was_converted := found;
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

  if referral_was_converted then
    transition_result := 'eco_referral_converted';
  end if;

  return jsonb_build_object('result', transition_result);
end;
$$;

revoke all on function public.process_eco_payment_event(
  text, text, text, text, text, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function public.process_eco_payment_event(
  text, text, text, text, text, timestamptz, jsonb
) to service_role;
