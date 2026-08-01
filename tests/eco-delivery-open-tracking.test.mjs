import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildDeliveryOpenEndpoint,
  isTrackableDeliveryLandingHostname,
  sendDeliveryOpen,
} from "../app/eco/eco-sp-001/delivery-open-tracking.mjs";
import { normalizeDeliveryReference } from "../lib/eco/delivery-reference.mjs";
import { getOpeningState } from "../app/internal/eco/deliveries/delivery-panel-model.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const edge = read("supabase/functions/eco-case-delivery-open/index.ts");
const edgeTests = read("supabase/functions/eco-case-delivery-open/index_test.ts");
const migration = read("supabase/migrations/20260801000000_add_eco_delivery_open_rpc.sql");
const config = read("supabase/config.toml");
const landing = read("app/eco/eco-sp-001/iniciar/DeliveryLanding.tsx");
const preview = read("app/api/internal/eco/delivery-preview/route.ts");
const participants = read("app/api/internal/eco/participants/route.ts");
const panel = read("app/internal/eco/deliveries/EcoDeliveryPanel.tsx");
const access = read("app/api/internal/eco/delivery-access/route.ts");
const docs = read("docs/eco-case-delivery-open-tracking.md");
const REFERENCE = "QWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4";

test("one shared opaque-reference validator is used by frontend and backend", () => {
  assert.equal(normalizeDeliveryReference(` ${REFERENCE} `), REFERENCE);
  for (const invalid of ["short", "has spaces 123456", "person@example.test", "https://example.test/token", "A".repeat(201)]) {
    assert.equal(normalizeDeliveryReference(invalid), null);
  }
  assert.match(edge, /lib\/eco\/delivery-reference\.mjs/);
  assert.match(landing, /normalizeDeliveryReference/);
});

test("public function is unauthenticated at the gateway but persists with server credentials", () => {
  assert.match(config, /\[functions\.eco-case-delivery-open\]\s+verify_jwt = false/);
  assert.match(edge, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(landing, /SERVICE_ROLE|ADMIN_SECRET|Authorization|apikey/i);
  assert.doesNotMatch(edge, /ECO_DELIVERY_ADMIN_SECRET|Postmark|sendEmail|provider_message_id/);
  assert.match(edgeTests, /valid-looking outcomes and persistence errors are indistinguishable/);
});

test("RPC is sent-only, atomic, idempotent, and changes no send state", () => {
  const sql = migration.replace(/\s+/g, " ");
  assert.match(sql, /set opened_at = coalesce\(opened_at, pg_catalog\.now\(\)\)/);
  assert.match(sql, /where delivery_reference = pg_catalog\.btrim\(p_delivery_reference\) and status = 'sent'/);
  assert.match(sql, /returning opened_at/);
  assert.match(sql, /revoke all on function public\.record_eco_case_delivery_open\(text\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.record_eco_case_delivery_open\(text\) to service_role/);
  assert.doesNotMatch(sql, /set status|attempt_count\s*=|provider_message_id\s*=|sent_at\s*=|insert into/i);
});

test("browser endpoint derives only from the public Supabase origin", () => {
  assert.equal(buildDeliveryOpenEndpoint("https://project.supabase.co"), "https://project.supabase.co/functions/v1/eco-case-delivery-open");
  assert.equal(buildDeliveryOpenEndpoint("http://localhost:54321/"), "http://localhost:54321/functions/v1/eco-case-delivery-open");
  for (const invalid of [undefined, "", "http://project.supabase.co", "https://user:pass@project.supabase.co", "https://project.supabase.co/rest/v1"] ) {
    assert.equal(buildDeliveryOpenEndpoint(invalid), null);
  }
  assert.match(landing, /NEXT_PUBLIC_LIBERULA_SUPABASE_URL/);
});

test("local landing previews cannot initiate production opening tracking", () => {
  assert.equal(isTrackableDeliveryLandingHostname("liberula.com"), true);
  assert.equal(isTrackableDeliveryLandingHostname("localhost"), false);
  assert.equal(isTrackableDeliveryLandingHostname("127.0.0.1"), false);
  assert.match(landing, /isTrackableDeliveryLandingHostname\(window\.location\.hostname\)/);
});

test("tracking request has the exact JSON contract and no retry behavior", async () => {
  let calls = 0;
  await sendDeliveryOpen("https://project.supabase.co/functions/v1/eco-case-delivery-open", REFERENCE, async (_input, init) => {
    calls += 1;
    assert.equal(init.method, "POST");
    assert.deepEqual(init.headers, { "Content-Type": "application/json" });
    assert.equal(init.body, JSON.stringify({ delivery_reference: REFERENCE }));
    assert.equal(init.keepalive, true);
    return new Response("{\"success\":true}", { status: 202 });
  });
  assert.equal(calls, 1);
});

test("landing tracks after mount and visibility, at most once, independently of PostHog", () => {
  assert.match(landing, /useEffect\(\(\) =>/);
  assert.match(landing, /document\.visibilityState === "visible"/);
  assert.match(landing, /visibilitychange/);
  assert.match(landing, /openTrackingStartedRef\.current/);
  assert.match(landing, /openTrackingStartedRef\.current = true[\s\S]*sendDeliveryOpen/);
  assert.match(landing, /!reference \|\| !endpoint/);
  assert.match(landing, /void sendDeliveryOpen[\s\S]*\.catch/);
  assert.doesNotMatch(landing, /setInterval|setTimeout|location\.replace|router\.push/);
  for (const event of ["eco_case_delivery_landing_viewed", "eco_case_dossier_opened"]) assert(landing.includes(event));
});

test("preview cannot create an opening and real access is an explicit local action", () => {
  assert.match(preview, /https:\/\/liberula\.com\/eco\/eco-sp-001\/iniciar\//);
  assert.doesNotMatch(preview, /\?delivery=|eco-case-delivery-open|opened_at/);
  assert.match(panel, /ABRIR ACESSO/);
  assert.match(panel, /registrará a primeira abertura da landing/);
  assert.match(access, /value\[0\]\.status !== "sent"/);
  assert.match(access, /delivery_reference/);
  assert.match(access, /NextResponse\.redirect/);
});

test("panel exposes opening labels but no raw delivery identifiers", () => {
  assert.equal(getOpeningState({ delivery_status: "pending", opened_at: null }), "not_applicable");
  assert.equal(getOpeningState({ delivery_status: "sent", opened_at: null }), "unopened");
  assert.equal(getOpeningState({ delivery_status: "sent", opened_at: "2026-08-01T20:10:00Z" }), "opened");
  for (const label of ["NÃO ABRIU", "ABRIU", "ABRIU EM", "Abertura"]) assert(panel.includes(label));
  assert.match(participants, /opened_at/);
  assert.doesNotMatch(panel, /delivery_id|delivery_reference/i);
  assert.doesNotMatch(participants, /provider_message_id/);
});

test("documentation covers operations, semantics, smoke test, and deployment", () => {
  for (const term of ["opened_at", "PostHog", "Postmark", "NÃO ABRIU", "ABRIU", "smoke test", "supabase functions deploy eco-case-delivery-open", "npm run build"]) {
    assert(docs.includes(term), `documentation is missing ${term}`);
  }
});
