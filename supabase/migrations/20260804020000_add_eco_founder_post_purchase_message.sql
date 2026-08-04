-- Durable, idempotent post-purchase message for the ECO-SP-001 founder campaign.
-- No existing paid order is backfilled: only future authoritative transitions
-- into paid enqueue a message.

create table public.eco_founder_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.eco_orders (id),
  message_type text not null default 'eco_sp_001_founder_confirmation',
  status text not null default 'pending',
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  last_error_code text,
  access_token text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint eco_founder_messages_order_type_unique unique (order_id, message_type),
  constraint eco_founder_messages_access_token_unique unique (access_token),
  constraint eco_founder_messages_type_check check (
    message_type = 'eco_sp_001_founder_confirmation'
  ),
  constraint eco_founder_messages_status_check check (
    status in ('pending', 'processing', 'sent', 'failed', 'cancelled')
  ),
  constraint eco_founder_messages_attempt_check check (
    attempt_count between 0 and 3
  ),
  constraint eco_founder_messages_token_check check (
    access_token ~ '^[a-f0-9]{64}$'
  ),
  constraint eco_founder_messages_provider_id_check check (
    provider_message_id is null
    or provider_message_id ~ '^[A-Za-z0-9_-]{1,200}$'
  ),
  constraint eco_founder_messages_error_check check (
    last_error_code is null
    or last_error_code ~ '^[a-z0-9_]{1,80}$'
  ),
  constraint eco_founder_messages_sent_state_check check (
    (status = 'sent' and sent_at is not null and provider_message_id is not null)
    or status <> 'sent'
  )
);

create index eco_founder_messages_dispatch_idx
  on public.eco_founder_messages (status, available_at, created_at)
  where status = 'pending';

alter table public.eco_founder_messages enable row level security;
revoke all on table public.eco_founder_messages from anon, authenticated;

create function public.eco_founder_messages_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger eco_founder_messages_updated_at
before update on public.eco_founder_messages
for each row execute function public.eco_founder_messages_set_updated_at();

create function public.protect_eco_founder_message_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.order_id is distinct from old.order_id
    or new.message_type is distinct from old.message_type
    or new.access_token is distinct from old.access_token
    or new.created_at is distinct from old.created_at
  then
    raise exception 'eco_founder_message_identity_is_immutable';
  end if;
  return new;
end;
$$;

create trigger protect_eco_founder_message_identity
before update on public.eco_founder_messages
for each row execute function public.protect_eco_founder_message_identity();

create function public.enqueue_eco_founder_message_after_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    insert into public.eco_founder_messages (order_id)
    values (new.id)
    on conflict (order_id, message_type) do nothing;
  elsif new.status = 'refunded' and old.status is distinct from 'refunded' then
    update public.eco_founder_messages
    set status = 'cancelled',
        last_error_code = 'order_refunded',
        claimed_at = null
    where order_id = new.id
      and status in ('pending', 'failed');
  end if;
  return new;
end;
$$;

create trigger enqueue_eco_founder_message_after_payment
after update of status on public.eco_orders
for each row execute function public.enqueue_eco_founder_message_after_payment();

create function public.claim_eco_founder_messages(p_limit integer default 3)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  bounded_limit integer := least(greatest(coalesce(p_limit, 3), 1), 10);
  claimed jsonb;
begin
  -- A worker disappearing after claiming may have reached Postmark. Automatic
  -- recovery would risk a duplicate, so stale claims require human review.
  update public.eco_founder_messages
  set status = 'failed',
      claimed_at = null,
      last_error_code = 'postmark_result_unknown'
  where status = 'processing'
    and claimed_at < now() - interval '15 minutes';

  with candidates as (
    select message.id
    from public.eco_founder_messages message
    join public.eco_orders orders on orders.id = message.order_id
    where message.status = 'pending'
      and message.available_at <= now()
      and message.attempt_count < 3
      and orders.status = 'paid'
    order by message.available_at, message.created_at, message.id
    for update of message skip locked
    limit bounded_limit
  ), claimed_rows as (
    update public.eco_founder_messages message
    set status = 'processing',
        attempt_count = message.attempt_count + 1,
        claimed_at = now(),
        last_error_code = null
    from candidates, public.eco_orders orders
    where message.id = candidates.id
      and orders.id = message.order_id
    returning jsonb_build_object(
      'message_id', message.id,
      'order_id', orders.id,
      'buyer_name', orders.buyer_name,
      'buyer_email', orders.buyer_email,
      'amount_cents', orders.amount_cents,
      'currency', orders.currency,
      'order_reference', orders.public_reference,
      'access_token', message.access_token,
      'attempt_count', message.attempt_count
    ) as value
  )
  select coalesce(jsonb_agg(value), '[]'::jsonb)
  into claimed
  from claimed_rows;

  return claimed;
end;
$$;

create function public.complete_eco_founder_message(
  p_message_id uuid,
  p_provider_message_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_provider_message_id !~ '^[A-Za-z0-9_-]{1,200}$' then
    return false;
  end if;
  update public.eco_founder_messages
  set status = 'sent',
      provider_message_id = p_provider_message_id,
      sent_at = now(),
      claimed_at = null,
      last_error_code = null
  where id = p_message_id and status = 'processing';
  return found;
end;
$$;

create function public.fail_eco_founder_message(
  p_message_id uuid,
  p_error_code text,
  p_retryable boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_message public.eco_founder_messages%rowtype;
begin
  if p_error_code !~ '^[a-z0-9_]{1,80}$' then
    return 'unchanged';
  end if;
  select * into selected_message
  from public.eco_founder_messages
  where id = p_message_id
  for update;
  if not found or selected_message.status <> 'processing' then
    return 'unchanged';
  end if;

  if p_retryable and selected_message.attempt_count < 3 then
    update public.eco_founder_messages
    set status = 'pending',
        claimed_at = null,
        last_error_code = p_error_code,
        available_at = now() + case selected_message.attempt_count
          when 1 then interval '5 minutes'
          else interval '30 minutes'
        end
    where id = p_message_id;
    return 'pending';
  end if;

  update public.eco_founder_messages
  set status = 'failed',
      claimed_at = null,
      last_error_code = case
        when selected_message.attempt_count >= 3 then 'retry_limit_reached'
        else p_error_code
      end
  where id = p_message_id;
  return 'failed';
end;
$$;

create function public.retry_eco_founder_message(p_order_reference text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.eco_founder_messages message
  set status = 'pending',
      available_at = now(),
      claimed_at = null,
      last_error_code = null
  from public.eco_orders orders
  where orders.id = message.order_id
    and orders.public_reference = p_order_reference
    and orders.status = 'paid'
    and message.status = 'failed'
    and message.attempt_count < 3
    and message.last_error_code <> 'postmark_result_unknown';
  return found;
end;
$$;

create function public.get_eco_founder_record_access(p_access_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed boolean;
begin
  if p_access_token !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('allowed', false);
  end if;
  select true into allowed
  from public.eco_founder_messages message
  join public.eco_orders orders on orders.id = message.order_id
  where message.access_token = p_access_token
    and (
      orders.status = 'paid'
      or (orders.status = 'refunded' and message.sent_at is not null)
    )
  limit 1;
  return jsonb_build_object('allowed', coalesce(allowed, false));
end;
$$;

revoke all on function public.claim_eco_founder_messages(integer)
  from public, anon, authenticated;
revoke all on function public.complete_eco_founder_message(uuid, text)
  from public, anon, authenticated;
revoke all on function public.fail_eco_founder_message(uuid, text, boolean)
  from public, anon, authenticated;
revoke all on function public.retry_eco_founder_message(text)
  from public, anon, authenticated;
revoke all on function public.get_eco_founder_record_access(text)
  from public, anon, authenticated;

grant execute on function public.claim_eco_founder_messages(integer)
  to service_role;
grant execute on function public.complete_eco_founder_message(uuid, text)
  to service_role;
grant execute on function public.fail_eco_founder_message(uuid, text, boolean)
  to service_role;
grant execute on function public.retry_eco_founder_message(text)
  to service_role;
grant execute on function public.get_eco_founder_record_access(text)
  to service_role;
