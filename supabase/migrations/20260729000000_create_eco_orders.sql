create extension if not exists pgcrypto;

create table public.eco_orders (
  id uuid primary key default gen_random_uuid(),
  public_reference text not null default
    replace(gen_random_uuid()::text, '-', ''),
  case_id text not null default 'eco-sp-001',
  amount_cents integer not null default 7990,
  currency text not null default 'BRL',
  status text not null default 'pending',

  buyer_name text not null,
  buyer_email text not null,
  buyer_whatsapp text not null,
  delivery_street text not null,
  delivery_number text not null,
  delivery_complement text not null default '',
  delivery_neighborhood text not null,
  delivery_city text not null,
  delivery_state text not null,
  delivery_postal_code text not null,

  client_idempotency_key uuid not null,
  external_reference text not null default
    ('eco_' || replace(gen_random_uuid()::text, '-', '')),
  mercado_pago_preference_id text,
  sandbox_checkout_url text,
  provider_payment_id text,
  site_origin text not null,

  preference_claim_token uuid,
  preference_claimed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provider_created_at timestamptz,
  provider_updated_at timestamptz,

  constraint eco_orders_public_reference_unique unique (public_reference),
  constraint eco_orders_client_idempotency_key_unique unique (client_idempotency_key),
  constraint eco_orders_external_reference_unique unique (external_reference),
  constraint eco_orders_preference_id_unique unique (mercado_pago_preference_id),
  constraint eco_orders_payment_id_unique unique (provider_payment_id),
  constraint eco_orders_case_check check (case_id = 'eco-sp-001'),
  constraint eco_orders_amount_check check (amount_cents = 7990),
  constraint eco_orders_currency_check check (currency = 'BRL'),
  constraint eco_orders_status_check check (
    status in ('pending', 'paid', 'rejected', 'cancelled', 'refunded')
  ),
  constraint eco_orders_public_reference_format_check check (
    public_reference ~ '^[A-Za-z0-9_-]{16,200}$'
  ),
  constraint eco_orders_buyer_name_check check (
    char_length(buyer_name) between 2 and 120
  ),
  constraint eco_orders_buyer_email_check check (
    char_length(buyer_email) between 3 and 320
    and buyer_email = lower(buyer_email)
  ),
  constraint eco_orders_buyer_whatsapp_check check (
    buyer_whatsapp ~ '^[0-9]{10,15}$'
  ),
  constraint eco_orders_delivery_street_check check (
    char_length(delivery_street) between 1 and 160
  ),
  constraint eco_orders_delivery_number_check check (
    char_length(delivery_number) between 1 and 20
  ),
  constraint eco_orders_delivery_complement_check check (
    char_length(delivery_complement) <= 80
  ),
  constraint eco_orders_delivery_neighborhood_check check (
    char_length(delivery_neighborhood) between 1 and 100
  ),
  constraint eco_orders_delivery_city_check check (
    char_length(delivery_city) between 1 and 100
  ),
  constraint eco_orders_delivery_state_check check (
    delivery_state ~ '^[A-Z]{2}$'
  ),
  constraint eco_orders_delivery_postal_code_check check (
    delivery_postal_code ~ '^[0-9]{8}$'
  ),
  constraint eco_orders_site_origin_check check (
    site_origin ~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?$'
    or site_origin ~ '^http://localhost(:[0-9]+)?$'
  ),
  constraint eco_orders_preference_pair_check check (
    (mercado_pago_preference_id is null and sandbox_checkout_url is null)
    or
    (mercado_pago_preference_id is not null and sandbox_checkout_url is not null)
  ),
  constraint eco_orders_claim_pair_check check (
    (preference_claim_token is null and preference_claimed_at is null)
    or
    (preference_claim_token is not null and preference_claimed_at is not null)
  ),
  constraint eco_orders_sandbox_url_check check (
    sandbox_checkout_url is null
    or sandbox_checkout_url ~ '^https://sandbox\.mercadopago\.com(\.br)?/'
  )
);

create index eco_orders_created_at_idx
  on public.eco_orders (created_at desc);

create index eco_orders_status_updated_at_idx
  on public.eco_orders (status, updated_at desc);

alter table public.eco_orders enable row level security;
revoke all on table public.eco_orders from anon, authenticated;

create or replace function public.eco_orders_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger eco_orders_updated_at
before update on public.eco_orders
for each row execute function public.eco_orders_set_updated_at();

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
    or new.amount_cents is distinct from old.amount_cents
    or new.currency is distinct from old.currency
    or new.site_origin is distinct from old.site_origin
  then
    raise exception 'immutable_eco_order_field';
  end if;
  return new;
end;
$$;

create trigger eco_orders_immutable_fields
before update on public.eco_orders
for each row execute function public.eco_orders_protect_immutable_fields();

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
  p_site_origin text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_order public.eco_orders%rowtype;
begin
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
    site_origin
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
    p_site_origin
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
    'siteOrigin', selected_order.site_origin
  );
end;
$$;

create or replace function public.claim_eco_order_preference(
  p_order_reference text,
  p_claim_ttl_seconds integer default 120
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_order public.eco_orders%rowtype;
  new_claim_token uuid;
begin
  select *
  into strict selected_order
  from public.eco_orders
  where public_reference = p_order_reference
  for update;

  if selected_order.mercado_pago_preference_id is not null then
    return jsonb_build_object(
      'state', 'existing',
      'checkoutUrl', selected_order.sandbox_checkout_url,
      'preferenceId', selected_order.mercado_pago_preference_id
    );
  end if;

  if selected_order.preference_claim_token is not null
    and selected_order.preference_claimed_at >
      now() - make_interval(secs => greatest(1, least(p_claim_ttl_seconds, 600)))
  then
    return jsonb_build_object('state', 'busy');
  end if;

  new_claim_token := gen_random_uuid();
  update public.eco_orders
  set preference_claim_token = new_claim_token,
      preference_claimed_at = now()
  where id = selected_order.id;

  return jsonb_build_object(
    'state', 'claimed',
    'claimToken', new_claim_token::text
  );
exception
  when no_data_found then
    return jsonb_build_object('state', 'missing');
end;
$$;

create or replace function public.complete_eco_order_preference(
  p_order_reference text,
  p_claim_token uuid,
  p_preference_id text,
  p_sandbox_checkout_url text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_order public.eco_orders%rowtype;
begin
  select *
  into strict selected_order
  from public.eco_orders
  where public_reference = p_order_reference
  for update;

  if selected_order.mercado_pago_preference_id is not null then
    return jsonb_build_object(
      'state', 'existing',
      'checkoutUrl', selected_order.sandbox_checkout_url,
      'preferenceId', selected_order.mercado_pago_preference_id
    );
  end if;

  if selected_order.preference_claim_token is distinct from p_claim_token then
    return jsonb_build_object('state', 'claim_lost');
  end if;

  update public.eco_orders
  set mercado_pago_preference_id = p_preference_id,
      sandbox_checkout_url = p_sandbox_checkout_url,
      provider_created_at = now(),
      preference_claim_token = null,
      preference_claimed_at = null
  where id = selected_order.id;

  return jsonb_build_object(
    'state', 'completed',
    'checkoutUrl', p_sandbox_checkout_url,
    'preferenceId', p_preference_id
  );
exception
  when no_data_found then
    return jsonb_build_object('state', 'missing');
end;
$$;

create or replace function public.release_eco_order_preference_claim(
  p_order_reference text,
  p_claim_token uuid
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  update public.eco_orders
  set preference_claim_token = null,
      preference_claimed_at = null
  where public_reference = p_order_reference
    and mercado_pago_preference_id is null
    and preference_claim_token = p_claim_token
  returning true;
$$;

revoke all on function public.create_or_get_eco_order(
  uuid, text, text, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.claim_eco_order_preference(text, integer)
  from public, anon, authenticated;
revoke all on function public.complete_eco_order_preference(text, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.release_eco_order_preference_claim(text, uuid)
  from public, anon, authenticated;

grant execute on function public.create_or_get_eco_order(
  uuid, text, text, text, text, text, text, text, text, text, text, text
) to service_role;
grant execute on function public.claim_eco_order_preference(text, integer)
  to service_role;
grant execute on function public.complete_eco_order_preference(text, uuid, text, text)
  to service_role;
grant execute on function public.release_eco_order_preference_claim(text, uuid)
  to service_role;
