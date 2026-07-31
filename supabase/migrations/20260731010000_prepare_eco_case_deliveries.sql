alter table public.eco_cases
  add column entry_path text;

update public.eco_cases
set entry_path = '/eco/eco-sp-001/iniciar/',
    updated_at = now()
where id = 'eco-sp-001';

alter table public.eco_cases
  alter column entry_path set not null,
  add constraint eco_cases_entry_path_check check (
    entry_path ~ '^/[^?#]*$'
    and entry_path !~ '^//'
    and entry_path !~ '^[A-Za-z][A-Za-z0-9+.-]*://'
  );

insert into public.eco_cases (
  id,
  sequence_number,
  title,
  status,
  entry_path
) values (
  'eco-sp-001',
  1,
  'Atalho',
  'active',
  '/eco/eco-sp-001/iniciar/'
)
on conflict (id) do update
set sequence_number = excluded.sequence_number,
    title = excluded.title,
    status = excluded.status,
    entry_path = excluded.entry_path,
    updated_at = now();

create or replace function public.prepare_eco_case_deliveries(
  p_case_id text,
  p_participant_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_case public.eco_cases%rowtype;
  current_participant_id uuid;
  selected_delivery public.eco_case_deliveries%rowtype;
  generated_reference text;
  result_kind text;
  results jsonb := '[]'::jsonb;
  attempt integer;
begin
  if nullif(pg_catalog.btrim(p_case_id), '') is null
    or pg_catalog.char_length(pg_catalog.btrim(p_case_id)) > 100
    or p_participant_ids is null
    or pg_catalog.cardinality(p_participant_ids) < 1
    or pg_catalog.cardinality(p_participant_ids) > 10
    or exists (
      select 1
      from pg_catalog.unnest(p_participant_ids) as supplied(id)
      where supplied.id is null
    )
    or (
      select pg_catalog.count(*)
      from pg_catalog.unnest(p_participant_ids) as supplied(id)
    ) <> (
      select pg_catalog.count(distinct supplied.id)
      from pg_catalog.unnest(p_participant_ids) as supplied(id)
    )
  then
    return pg_catalog.jsonb_build_object('error', 'invalid_request');
  end if;

  select *
  into selected_case
  from public.eco_cases
  where id = pg_catalog.btrim(p_case_id)
  for share;

  if not found
    or selected_case.status <> 'active'
    or selected_case.entry_path !~ '^/[^?#]*$'
    or selected_case.entry_path ~ '^//'
    or selected_case.entry_path ~ '^[A-Za-z][A-Za-z0-9+.-]*://'
  then
    return pg_catalog.jsonb_build_object('error', 'not_found');
  end if;

  -- Lock every participant in stable order and validate the complete batch
  -- before the first delivery insert. A rejected batch therefore writes none.
  perform participant.id
  from public.eco_participants as participant
  where participant.id = any(p_participant_ids)
  order by participant.id
  for share;

  if (
    select pg_catalog.count(*)
    from public.eco_participants as participant
    where participant.id = any(p_participant_ids)
  ) <> pg_catalog.cardinality(p_participant_ids)
  then
    return pg_catalog.jsonb_build_object('error', 'not_found');
  end if;

  if exists (
    select 1
    from public.eco_participants as participant
    where participant.id = any(p_participant_ids)
      and participant.status not in ('registered', 'active', 'paused')
  ) then
    return pg_catalog.jsonb_build_object(
      'error',
      'ineligible_participant'
    );
  end if;

  foreach current_participant_id in array p_participant_ids loop
    selected_delivery := null;
    result_kind := 'existing';

    select *
    into selected_delivery
    from public.eco_case_deliveries as delivery
    where delivery.participant_id = current_participant_id
      and delivery.case_id = selected_case.id;

    if not found then
      for attempt in 1..5 loop
        generated_reference := pg_catalog.rtrim(
          pg_catalog.translate(
            pg_catalog.encode(extensions.gen_random_bytes(24), 'base64'),
            '+/',
            '-_'
          ),
          '='
        );

        insert into public.eco_case_deliveries (
          participant_id,
          case_id,
          status,
          delivery_reference,
          requested_at,
          attempt_count,
          sent_at,
          opened_at,
          email_provider,
          provider_message_id,
          last_error_code
        ) values (
          current_participant_id,
          selected_case.id,
          'pending',
          generated_reference,
          now(),
          0,
          null,
          null,
          null,
          null,
          null
        )
        on conflict do nothing
        returning * into selected_delivery;

        if found then
          result_kind := 'created';
          exit;
        end if;

        -- A concurrent request may have won the participant/case race.
        select *
        into selected_delivery
        from public.eco_case_deliveries as delivery
        where delivery.participant_id = current_participant_id
          and delivery.case_id = selected_case.id;

        if found then
          result_kind := 'existing';
          exit;
        end if;

        -- Otherwise the generated reference collided globally; retry with
        -- fresh cryptographic randomness without changing another delivery.
      end loop;

      if selected_delivery.id is null then
        raise exception 'eco_delivery_reference_generation_failed';
      end if;
    end if;

    results := results || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'participant_id', selected_delivery.participant_id,
        'delivery_id', selected_delivery.id,
        'result', result_kind,
        'status', selected_delivery.status,
        'delivery_reference', selected_delivery.delivery_reference
      )
    );
  end loop;

  return pg_catalog.jsonb_build_object(
    'case_id', selected_case.id,
    'entry_path', selected_case.entry_path,
    'results', results
  );
end;
$$;

revoke all on function public.prepare_eco_case_deliveries(text, uuid[])
  from public, anon, authenticated;

grant execute on function public.prepare_eco_case_deliveries(text, uuid[])
  to service_role;
