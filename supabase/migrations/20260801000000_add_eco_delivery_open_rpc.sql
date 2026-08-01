create or replace function public.record_eco_case_delivery_open(
  p_delivery_reference text
)
returns timestamptz
language sql
security definer
set search_path = ''
as $$
  update public.eco_case_deliveries
  set opened_at = coalesce(opened_at, pg_catalog.now())
  where delivery_reference = pg_catalog.btrim(p_delivery_reference)
    and status = 'sent'
    and p_delivery_reference = pg_catalog.btrim(p_delivery_reference)
    and p_delivery_reference ~ '^[A-Za-z0-9_-]{16,200}$'
  returning opened_at;
$$;

revoke all on function public.record_eco_case_delivery_open(text)
  from public, anon, authenticated;

grant execute on function public.record_eco_case_delivery_open(text)
  to service_role;
