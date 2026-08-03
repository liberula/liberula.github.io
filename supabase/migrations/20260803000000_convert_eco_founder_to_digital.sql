-- Convert future ECO-SP-001 founder orders to the digital mission offer while
-- preserving the integrity of any historical order already stored at R$ 79,90.

alter table public.eco_orders
  alter column amount_cents set default 4990,
  alter column delivery_street drop not null,
  alter column delivery_number drop not null,
  alter column delivery_complement drop not null,
  alter column delivery_neighborhood drop not null,
  alter column delivery_city drop not null,
  alter column delivery_state drop not null,
  alter column delivery_postal_code drop not null;

alter table public.eco_orders
  drop constraint eco_orders_amount_check;

alter table public.eco_orders
  add constraint eco_orders_amount_check check (amount_cents in (4990, 7990));

-- The payment-event RPC owns a stored-order invariant. Replace only that
-- invariant in the existing function so historical payments remain auditable
-- and all new digital orders use the new canonical amount.
do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(
    'public.process_eco_payment_event(text,text,text,text,text,timestamptz,jsonb)'::regprocedure
  ) into strict function_definition;

  function_definition := replace(
    function_definition,
    'selected_order.amount_cents <> 7990',
    'selected_order.amount_cents not in (4990, 7990)'
  );

  if function_definition not like '%selected_order.amount_cents not in (4990, 7990)%' then
    raise exception 'eco_payment_amount_invariant_not_found';
  end if;

  execute function_definition;
end;
$$;
