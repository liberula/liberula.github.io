import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relative) => readFile(new URL(`../${relative}`, import.meta.url), "utf8");
const migration = (await read("supabase/migrations/20260802000000_add_eco_automatic_delivery.sql")).replace(/\s+/g, " ");
const ingestion = await read("supabase/functions/eco-participant-ingest/index.ts");
const delivery = await read("supabase/functions/eco-case-delivery/index.ts");
const dispatcher = await read("supabase/functions/eco-automatic-delivery-dispatch/index.ts");
const settings = await read("supabase/functions/eco-automation-settings/index.ts");
const panel = await read("app/internal/eco/deliveries/EcoDeliveryPanel.tsx");
const settingsProxy = await read("app/api/internal/eco/automation-settings/route.ts");
const participantProxy = await read("app/api/internal/eco/participants/route.ts");

test("runtime setting is persistent, protected, and disabled by default", () => {
  assert.match(migration, /create table public\.eco_runtime_settings/);
  assert.match(migration, /automatic_case_delivery_enabled', false/);
  assert.match(migration, /alter table public\.eco_runtime_settings enable row level security/);
  assert.match(migration, /from public, anon, authenticated/);
  assert.doesNotMatch(settings, /Deno\.env\.get\(".*AUTOMATIC.*ENABLED/);
});

test("durable jobs are unique, bounded, and claimed once concurrently", () => {
  assert.match(migration, /create table public\.eco_automatic_delivery_jobs/);
  assert.match(migration, /unique \( source_event_id, case_id \)/);
  assert.match(migration, /status in \('pending', 'processing', 'completed', 'failed', 'cancelled'\)/);
  assert.match(migration, /attempt_count between 0 and 3/);
  assert.match(migration, /for update skip locked/);
  assert.match(migration, /limit p_limit/);
  assert.match(migration, /order by job\.available_at, job\.created_at, job\.id/);
});

test("enqueue is transactional, live-only, setting-gated, and duplicate-safe", () => {
  assert.match(migration, /p_delivery_mode text default 'none'/);
  assert.match(migration, /p_delivery_mode = 'automatic_if_enabled'/);
  assert.match(migration, /ingestion_result in \('created', 'linked'\)/);
  assert.match(migration, /select enabled into automation_enabled/);
  assert.match(migration, /for update/);
  assert.match(migration, /coalesce\(automation_enabled, false\)/);
  assert.match(migration, /on conflict \(source_event_id, case_id\) do nothing/);
  assert.match(migration, /delivery\.status = 'sent'/);
  assert.match(ingestion, /automaticJobEnqueued/);
  assert.match(ingestion, /dispatchPending/);
});

test("toggle-off cancels pending work and toggle-on scans no participants", () => {
  const setter = migration.slice(migration.indexOf("set_eco_automatic_delivery_enabled"), migration.indexOf("claim_eco_automatic_delivery_jobs"));
  assert.match(setter, /where status = 'pending'/);
  assert.match(setter, /status = 'cancelled'/);
  assert.doesNotMatch(setter, /insert into public\.eco_automatic_delivery_jobs[\s\S]*select/);
});

test("retry policy is bounded and ambiguous results never retry", () => {
  assert.match(migration, /selected_job\.attempt_count < 3/);
  assert.match(migration, /interval '5 minutes'/);
  assert.match(migration, /interval '30 minutes'/);
  const retryable = migration.match(/retryable := p_error_code in \((.*?)\)/)?.[1] ?? "";
  for (const code of ["postmark_timeout", "postmark_network_error", "postmark_server_error", "temporary_dispatch_failure"]) {
    assert.match(retryable, new RegExp(code));
  }
  assert.doesNotMatch(retryable, /postmark_result_unknown/);
  assert.match(dispatcher, /postmark_result_unknown/);
  assert.match(migration, /recover_stale_eco_automatic_delivery_jobs/);
  assert.match(migration, /delivery_status = 'sending'/);
  assert.match(migration, /last_error_code = 'postmark_result_unknown'/);
});

test("automatic dispatcher reuses the existing delivery function", () => {
  assert.match(dispatcher, /action: "prepare_automatic"/);
  assert.match(dispatcher, /action: "send"/);
  assert.match(dispatcher, /eco-case-delivery/);
  assert.doesNotMatch(dispatcher, /api\.postmarkapp\.com|renderEcoDeliveryEmail|X-Postmark-Server-Token/);
  assert.match(delivery, /renderEcoDeliveryEmail/);
  assert.match(delivery, /api\.postmarkapp\.com\/email/);
});

test("manual and automatic preparation record an origin without exposing IDs", () => {
  assert.match(migration, /origin in \('manual', 'automatic'\)/);
  assert.match(migration, /prepare_eco_case_deliveries_manual/);
  assert.match(migration, /prepare_eco_case_deliveries_automatic/);
  assert.match(participantProxy, /delivery_origin/);
  assert.match(panel, /AUTOMÁTICO/);
  assert.match(panel, /MANUAL/);
  assert.doesNotMatch(panel, /job_id|delivery_id|delivery_reference/);
});

test("panel uses the server proxy, explicit states, confirmation, and counters", () => {
  assert.match(panel, /ENVIO AUTOMÁTICO DE NOVAS INSCRIÇÕES/);
  assert.match(panel, /LIGADO/);
  assert.match(panel, /DESLIGADO/);
  assert.match(panel, /ATIVAR ENVIO AUTOMÁTICO/);
  assert.match(panel, /DESATIVAR ENVIO AUTOMÁTICO/);
  assert.match(panel, /Envios automáticos pendentes/);
  assert.match(panel, /Envios automáticos falhos/);
  assert.match(panel, /concluídos nas últimas 24 horas/);
  assert.match(settingsProxy, /ECO_DELIVERY_ADMIN_SECRET|deliveryAdminSecret/);
  assert.doesNotMatch(panel, /ECO_DELIVERY_ADMIN_SECRET|SUPABASE_SERVICE_ROLE_KEY|POSTMARK_SERVER_TOKEN|NEXT_PUBLIC_.*ADMIN/);
});

test("preview and landing paths do not invoke automation", async () => {
  const preview = await read("app/api/internal/eco/delivery-preview/route.ts");
  const opening = await read("supabase/functions/eco-case-delivery-open/index.ts");
  for (const source of [preview, opening]) {
    assert.doesNotMatch(source, /eco_automatic_delivery_jobs|automatic-delivery-dispatch|automatic_case_delivery_enabled/);
  }
});

test("logs are generic and contain no participant PII or secrets", () => {
  for (const source of [settings, dispatcher]) {
    assert.doesNotMatch(source, /console\.(?:info|error).*participantEmail|console\.(?:info|error).*participantName/);
    assert.doesNotMatch(source, /console\.(?:info|error).*adminSecret|console\.(?:info|error).*serviceRoleKey/);
  }
});
