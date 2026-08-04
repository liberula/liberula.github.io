-- Prepare ECO-SP-001 Checkout Pro storage for either explicit Mercado Pago
-- environment. The legacy column name is retained to avoid a risky data move;
-- its constraint now accepts only the four exact supported checkout hosts.

alter table public.eco_orders
  drop constraint if exists eco_orders_sandbox_url_check;

alter table public.eco_orders
  add constraint eco_orders_checkout_url_check check (
    sandbox_checkout_url is null
    or sandbox_checkout_url ~
      '^https://(sandbox|www)\.mercadopago\.com(\.br)?/'
  );

alter table public.eco_orders
  add constraint eco_orders_preference_id_format_check check (
    mercado_pago_preference_id is null
    or char_length(mercado_pago_preference_id) between 1 and 200
  );

-- Bind an idempotency key to the normalized buyer and site origin that first
-- created it. A reused key cannot disclose or redirect to another buyer's
-- checkout, while an exact retry still recovers the original order.
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
    p_delivery_complement,
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

  if selected_order.buyer_name is distinct from p_buyer_name
    or selected_order.buyer_email is distinct from p_buyer_email
    or selected_order.buyer_whatsapp is distinct from p_buyer_whatsapp
    or selected_order.site_origin is distinct from p_site_origin
  then
    raise exception 'eco_order_idempotency_mismatch';
  end if;

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
