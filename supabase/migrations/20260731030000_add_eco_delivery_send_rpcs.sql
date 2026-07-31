create or replace function public.claim_eco_case_delivery_send(
  p_delivery_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_delivery public.eco_case_deliveries%rowtype;
  selected_participant public.eco_participants%rowtype;
  selected_case public.eco_cases%rowtype;
begin
  if p_delivery_id is null then
    return pg_catalog.jsonb_build_object('result', 'not_found');
  end if;

  select *
  into selected_delivery
  from public.eco_case_deliveries as delivery
  where delivery.id = p_delivery_id
  for update;

  if not found then
    return pg_catalog.jsonb_build_object('result', 'not_found');
  end if;

  if selected_delivery.status = 'sent' then
    return pg_catalog.jsonb_build_object(
      'result', 'already_sent',
      'status', selected_delivery.status
    );
  end if;

  if selected_delivery.status in ('sending', 'cancelled') then
    return pg_catalog.jsonb_build_object(
      'result', 'ineligible_state',
      'status', selected_delivery.status
    );
  end if;

  if selected_delivery.status = 'failed'
    and selected_delivery.attempt_count >= 3
  then
    return pg_catalog.jsonb_build_object(
      'result', 'retry_limit_reached',
      'status', selected_delivery.status
    );
  end if;

  if selected_delivery.status not in ('pending', 'failed') then
    return pg_catalog.jsonb_build_object(
      'result', 'ineligible_state',
      'status', selected_delivery.status
    );
  end if;

  select *
  into selected_participant
  from public.eco_participants as participant
  where participant.id = selected_delivery.participant_id;

  if not found then
    return pg_catalog.jsonb_build_object(
      'result', 'not_found',
      'status', selected_delivery.status
    );
  end if;

  if selected_participant.status in ('blocked', 'completed')
    or nullif(pg_catalog.btrim(selected_participant.email), '') is null
    or pg_catalog.char_length(pg_catalog.btrim(selected_participant.email)) > 320
    or pg_catalog.btrim(selected_participant.email)
      !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  then
    return pg_catalog.jsonb_build_object(
      'result', 'ineligible_state',
      'status', selected_delivery.status
    );
  end if;

  select *
  into selected_case
  from public.eco_cases as eco_case
  where eco_case.id = selected_delivery.case_id;

  if not found then
    return pg_catalog.jsonb_build_object(
      'result', 'not_found',
      'status', selected_delivery.status
    );
  end if;

  if selected_case.status <> 'active'
    or selected_case.entry_path !~ '^/[^?#]*$'
    or selected_case.entry_path ~ '^//'
    or selected_case.entry_path ~ '^[A-Za-z][A-Za-z0-9+.-]*://'
    or selected_delivery.delivery_reference
      !~ '^[A-Za-z0-9_-]{16,200}$'
  then
    return pg_catalog.jsonb_build_object(
      'result', 'ineligible_state',
      'status', selected_delivery.status
    );
  end if;

  update public.eco_case_deliveries
  set status = 'sending',
      attempt_count = attempt_count + 1,
      last_error_code = null,
      updated_at = now()
  where id = selected_delivery.id
  returning * into selected_delivery;

  return pg_catalog.jsonb_build_object(
    'result', 'claimed',
    'delivery_id', selected_delivery.id,
    'status', selected_delivery.status,
    'case_id', selected_case.id,
    'entry_path', selected_case.entry_path,
    'delivery_reference', selected_delivery.delivery_reference,
    'participant_email', selected_participant.email,
    'participant_name', nullif(pg_catalog.btrim(selected_participant.name), '')
  );
end;
$$;

create or replace function public.complete_eco_case_delivery_send(
  p_delivery_id uuid,
  p_provider_message_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  if p_delivery_id is null
    or nullif(pg_catalog.btrim(p_provider_message_id), '') is null
    or pg_catalog.char_length(pg_catalog.btrim(p_provider_message_id)) > 200
  then
    return false;
  end if;

  update public.eco_case_deliveries
  set status = 'sent',
      sent_at = now(),
      email_provider = 'postmark',
      provider_message_id = pg_catalog.btrim(p_provider_message_id),
      last_error_code = null,
      updated_at = now()
  where id = p_delivery_id
    and status = 'sending';

  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

create or replace function public.fail_eco_case_delivery_send(
  p_delivery_id uuid,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  if p_delivery_id is null
    or p_error_code not in (
      'postmark_configuration_missing',
      'postmark_timeout',
      'postmark_network_error',
      'postmark_unauthorized',
      'postmark_rejected',
      'postmark_server_error',
      'postmark_invalid_response',
      'postmark_result_unknown',
      'participant_ineligible',
      'case_inactive',
      'retry_limit_reached'
    )
  then
    return false;
  end if;

  update public.eco_case_deliveries
  set status = 'failed',
      email_provider = 'postmark',
      provider_message_id = null,
      last_error_code = p_error_code,
      updated_at = now()
  where id = p_delivery_id
    and status = 'sending';

  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

revoke all on function public.claim_eco_case_delivery_send(uuid)
  from public, anon, authenticated;
revoke all on function public.complete_eco_case_delivery_send(uuid, text)
  from public, anon, authenticated;
revoke all on function public.fail_eco_case_delivery_send(uuid, text)
  from public, anon, authenticated;

grant execute on function public.claim_eco_case_delivery_send(uuid)
  to service_role;
grant execute on function public.complete_eco_case_delivery_send(uuid, text)
  to service_role;
grant execute on function public.fail_eco_case_delivery_send(uuid, text)
  to service_role;
