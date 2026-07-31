import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { normalizeDeliveryReference } from "../app/eco/eco-sp-001/delivery-reference.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260731000000_create_eco_participant_ingestion.sql"),
  "utf8",
);
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260731010000_prepare_eco_case_deliveries.sql"),
  "utf8",
);
const correctiveMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260731020000_fix_delivery_participant_id_ambiguity.sql"),
  "utf8",
);
const sendMigration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260731030000_add_eco_delivery_send_rpcs.sql"),
  "utf8",
);
const edgeFunction = fs.readFileSync(
  path.join(root, "supabase/functions/eco-case-delivery/index.ts"),
  "utf8",
);
const config = fs.readFileSync(path.join(root, "supabase/config.toml"), "utf8");
const normalized = migration.replace(/\s+/g, " ");

test("case catalog stores and validates the explicit ECO-SP-001 entry path", () => {
  assert.match(normalized, /alter table public\.eco_cases add column entry_path text/);
  assert.match(normalized, /alter column entry_path set not null/);
  assert.match(normalized, /entry_path ~ '\^\/\[\^\?#\]\*\$'/);
  assert.match(normalized, /entry_path !~ '\^\/\/'/);
  assert.match(normalized, /entry_path !~ '\^\[A-Za-z\]/);
  assert.match(normalized, /'eco-sp-001'.*?'Atalho'.*?'active'.*?'\/eco\/eco-sp-001\/iniciar\/'/);
  assert.match(normalized, /on conflict \(id\) do update/);
});

test("existing delivery table remains RLS protected with the required contract", () => {
  const base = baseMigration.replace(/\s+/g, " ");
  assert.match(base, /create table public\.eco_case_deliveries/);
  assert.match(base, /unique \( participant_id, case_id \)/);
  assert.match(base, /unique \( delivery_reference \)/);
  assert.match(base, /status in \('pending', 'sending', 'sent', 'failed', 'cancelled'\)/);
  assert.match(base, /alter table public\.eco_case_deliveries enable row level security/);
  assert.match(base, /revoke all on table public\.eco_case_deliveries from public, anon, authenticated/);
});

test("one service-role-only RPC validates the complete batch before writes", () => {
  assert.match(normalized, /create or replace function public\.prepare_eco_case_deliveries/);
  assert.match(normalized, /security definer set search_path = ''/);
  assert.match(normalized, /cardinality\(p_participant_ids\) < 1/);
  assert.match(normalized, /cardinality\(p_participant_ids\) > 10/);
  assert.match(normalized, /count\(distinct supplied\.id\)/);
  assert.match(normalized, /participant\.status not in \('registered', 'active', 'paused'\)/);
  assert(
    normalized.indexOf("participant.status not in") <
      normalized.indexOf("insert into public.eco_case_deliveries"),
    "delivery insert occurs before complete eligibility validation",
  );
  assert.match(normalized, /revoke all on function public\.prepare_eco_case_deliveries\(text, uuid\[\]\) from public, anon, authenticated/);
  assert.match(normalized, /grant execute on function public\.prepare_eco_case_deliveries\(text, uuid\[\]\) to service_role/);
});

test("delivery lookup cannot confuse the loop variable with its column", () => {
  for (const source of [migration, correctiveMigration]) {
    const sql = source.replace(/\s+/g, " ");
    assert.match(sql, /current_participant_id uuid/);
    assert.match(
      sql,
      /delivery\.participant_id = current_participant_id/,
    );
    assert.doesNotMatch(sql, /delivery\.participant_id = participant_id/);
  }
});

test("new deliveries are pending and contain no sending state", () => {
  const insertStart = normalized.indexOf("insert into public.eco_case_deliveries");
  const insertEnd = normalized.indexOf("on conflict do nothing", insertStart);
  const insert = normalized.slice(insertStart, insertEnd);
  assert.match(insert, /'pending'/);
  assert.match(insert, /, 0, null, null, null, null, null \)/);
  assert.doesNotMatch(insert, /'sending'|'sent'/);
  assert.doesNotMatch(normalized, /update public\.eco_case_deliveries/);
});

test("reference generation is cryptographic, URL-safe, and collision retryable", () => {
  assert.match(normalized, /extensions\.gen_random_bytes\(24\)/);
  assert.match(normalized, /translate\(.*?'\+\/', '-_'/);
  assert.match(normalized, /rtrim\(.*?'='/);
  assert.match(normalized, /for attempt in 1\.\.5 loop/);
  assert.match(normalized, /on conflict do nothing/);
  assert.match(
    normalized,
    /where delivery\.participant_id = current_participant_id and delivery\.case_id = selected_case\.id/,
  );
  const representativeReference = "QWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4";
  assert.equal(normalizeDeliveryReference(representativeReference), representativeReference);
  assert(!representativeReference.includes("eco-sp-001"));
});

test("Edge Function uses custom bearer auth and the transactional delivery RPCs", () => {
  assert.match(config, /\[functions\.eco-case-delivery\]\s+verify_jwt = false/);
  assert.match(edgeFunction, /ECO_DELIVERY_ADMIN_SECRET/);
  assert.match(edgeFunction, /ECO_PUBLIC_BASE_URL/);
  assert.match(edgeFunction, /\/rest\/v1\/rpc\/prepare_eco_case_deliveries/);
  assert.match(edgeFunction, /p_participant_ids: request\.participantIds/);
  assert.match(edgeFunction, /claim_eco_case_delivery_send/);
  assert.match(edgeFunction, /complete_eco_case_delivery_send/);
  assert.match(edgeFunction, /fail_eco_case_delivery_send/);
  assert.doesNotMatch(edgeFunction, /select all|newest|oldest|participant_email\s*:/i);
});

test("preparation migration contains no e-mail or external-provider integration", () => {
  assert.doesNotMatch(
    migration,
    /postmark|smtp|nodemailer|telegram|sendgrid|resend|\/api\/email|send_email|sendEmail|email queue/i,
  );
  assert.doesNotMatch(migration, /insert into public\.eco_case_deliveries[\s\S]*?'sent'/i);
});

test("send RPCs are atomic, state-guarded, and service-role only", () => {
  const sql = sendMigration.replace(/\s+/g, " ");
  assert.match(sql, /create or replace function public\.claim_eco_case_delivery_send\( p_delivery_id uuid \)/);
  assert.match(sql, /for update/);
  assert.match(sql, /selected_delivery\.status not in \('pending', 'failed'\)/);
  assert.match(sql, /selected_delivery\.status = 'failed' and selected_delivery\.attempt_count >= 3/);
  assert.match(sql, /set status = 'sending', attempt_count = attempt_count \+ 1, last_error_code = null/);
  assert.match(sql, /where id = p_delivery_id and status = 'sending'/);
  assert.match(sql, /set status = 'sent', sent_at = now\(\), email_provider = 'postmark'/);
  assert.match(sql, /set status = 'failed', email_provider = 'postmark', provider_message_id = null/);
  assert.doesNotMatch(sql, /opened_at\s*=/);
  for (const signature of [
    "claim_eco_case_delivery_send\\(uuid\\)",
    "complete_eco_case_delivery_send\\(uuid, text\\)",
    "fail_eco_case_delivery_send\\(uuid, text\\)",
  ]) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${signature} from public, anon, authenticated`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${signature} to service_role`));
  }
});

test("send validation covers participant, case, reference, and missing related rows", () => {
  const sql = sendMigration.replace(/\s+/g, " ");
  assert.match(sql, /selected_participant\.status in \('blocked', 'completed'\)/);
  assert.match(sql, /selected_participant\.email.*?~ '\^\[\^\[:space:\]@\]\+@/);
  assert.match(sql, /selected_case\.status <> 'active'/);
  assert.match(sql, /selected_case\.entry_path !~ '\^\/\[\^\?#\]\*\$'/);
  assert.match(sql, /selected_delivery\.delivery_reference !~ '\^\[A-Za-z0-9_-\]\{16,200\}\$'/);
  assert.match(sql, /if not found then return pg_catalog\.jsonb_build_object\( 'result', 'not_found'/);
});

test("Postmark can only be reached from an explicit send action", () => {
  assert.match(edgeFunction, /payload\.action === "send"/);
  assert.match(edgeFunction, /https:\/\/api\.postmarkapp\.com\/email/);
  assert.match(edgeFunction, /"X-Postmark-Server-Token"/);
  assert.match(edgeFunction, /signal: controller\.signal/);
  assert.match(edgeFunction, /setTimeout\(\(\) => controller\.abort\(\), POSTMARK_TIMEOUT_MS\)/);
  assert.doesNotMatch(edgeFunction, /Attachment|Attachments/);
  assert.doesNotMatch(edgeFunction, /cron|schedule|setInterval|opened_at/i);
  assert(
    edgeFunction.indexOf("claim = await dependencies.claimDelivery") <
      edgeFunction.indexOf("await dependencies.sendEmail"),
    "provider call must occur only after the atomic database claim",
  );
});
