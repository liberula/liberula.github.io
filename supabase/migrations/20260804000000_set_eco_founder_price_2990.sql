-- Set the canonical price for future ECO-SP-001 founder orders to R$ 29,90.
-- Historical orders at R$ 49,90 and R$ 79,90 remain valid and auditable.

alter table public.eco_orders
  alter column amount_cents set default 2990;

alter table public.eco_orders
  drop constraint eco_orders_amount_check;

alter table public.eco_orders
  add constraint eco_orders_amount_check
  check (amount_cents in (2990, 4990, 7990));

do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(
    'public.process_eco_payment_event(text,text,text,text,text,timestamptz,jsonb)'::regprocedure
  ) into strict function_definition;

  function_definition := replace(
    function_definition,
    'selected_order.amount_cents not in (4990, 7990)',
    'selected_order.amount_cents not in (2990, 4990, 7990)'
  );

  if function_definition not like '%selected_order.amount_cents not in (2990, 4990, 7990)%' then
    raise exception 'eco_payment_amount_invariant_not_found';
  end if;

  execute function_definition;
end;
$$;
