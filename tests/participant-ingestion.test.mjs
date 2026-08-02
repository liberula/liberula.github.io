import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../supabase/migrations/20260731000000_create_eco_participant_ingestion.sql",
    import.meta.url,
  ),
  "utf8",
);
const edgeFunction = await readFile(
  new URL(
    "../supabase/functions/eco-participant-ingest/index.ts",
    import.meta.url,
  ),
  "utf8",
);
const config = await readFile(
  new URL("../supabase/config.toml", import.meta.url),
  "utf8",
);
const normalized = migration.replace(/\s+/g, " ");

const tables = [
  "eco_participants",
  "eco_participant_sources",
  "eco_ingested_events",
  "eco_cases",
  "eco_case_deliveries",
];

test("migration creates the participant, attribution, event, case, and delivery boundary", () => {
  for (const table of tables) {
    assert.match(normalized, new RegExp(`create table public\\.${table} \\(`));
  }
  assert.match(normalized, /create unique index eco_participants_email_lower_unique on public\.eco_participants \(lower\(email\)\)/);
  assert.match(normalized, /unique \( source_system, source_record_id \)/);
  assert.match(normalized, /unique \( source_system, source_record_id, event_type \)/);
  assert.match(normalized, /unique \( participant_id, case_id \)/);
  assert.match(normalized, /unique \( delivery_reference \)/);
});

test("all participant tables are RLS-protected from browser roles", () => {
  for (const table of tables) {
    assert.match(
      normalized,
      new RegExp(`alter table public\\.${table} enable row level security`),
    );
    assert.match(
      normalized,
      new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`),
    );
    assert.match(
      normalized,
      new RegExp(`grant select, insert, update, delete on table public\\.${table} to service_role`),
    );
  }
});

test("statuses and the delivery uniqueness boundary are constrained", () => {
  assert.match(normalized, /status in \('registered', 'active', 'paused', 'completed', 'blocked'\)/);
  assert.match(normalized, /status in \('draft', 'active', 'retired'\)/);
  assert.match(normalized, /status in \('pending', 'sending', 'sent', 'failed', 'cancelled'\)/);
  assert.match(normalized, /attempt_count >= 0/);
});

test("ECO-SP-001 is seeded idempotently without a delivery", () => {
  assert.match(
    normalized,
    /values \( 'eco-sp-001', 1, 'Atalho', 'active' \) on conflict \(id\) do update/,
  );
  const seed = normalized.slice(
    normalized.indexOf("insert into public.eco_cases"),
    normalized.indexOf("create table public.eco_case_deliveries"),
  );
  assert.doesNotMatch(seed, /insert into public\.eco_case_deliveries/);
});

test("ingestion is one service-role-only transactional RPC", () => {
  const rpc = normalized.slice(
    normalized.indexOf("create or replace function public.ingest_eco_participant_event"),
  );
  assert.match(rpc, /language plpgsql security definer set search_path = ''/);
  assert.match(rpc, /pg_advisory_xact_lock/);
  assert.match(rpc, /'result', 'duplicate'/);
  assert.match(rpc, /ingestion_result := 'created'/);
  assert.match(rpc, /ingestion_result := 'linked'/);
  assert.match(rpc, /registered_at = least\(registered_at, p_occurred_at\)/);
  assert.match(rpc, /nullif\(btrim\(name\), ''\) is null and normalized_name is not null/);
  assert.match(rpc, /revoke all on function public\.ingest_eco_participant_event/);
  assert.match(rpc, /to service_role/);
  assert.doesNotMatch(rpc, /insert into public\.eco_case_deliveries/);
});

test("Edge Function uses custom bearer authentication and only the RPC", () => {
  assert.match(edgeFunction, /Deno\.env\.get\("ECO_INGEST_SECRET"\)/);
  assert.match(edgeFunction, /authorization\.startsWith\("Bearer "\)/);
  assert.match(edgeFunction, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(edgeFunction, /\/rest\/v1\/rpc\/ingest_eco_participant_event/);
  assert.doesNotMatch(edgeFunction, /\/rest\/v1\/eco_participants/);
  assert.match(config, /\[functions\.eco-participant-ingest\]\s+verify_jwt = false/);
});

test("ingestion has no email implementation or direct delivery-table write", () => {
  assert.doesNotMatch(
    edgeFunction,
    /postmark|nodemailer|sendgrid|resend|sendEmail|send_email|eco_case_deliveries/i,
  );
});
