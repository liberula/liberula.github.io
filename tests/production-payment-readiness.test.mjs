import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const api = await read("supabase/functions/eco-sp-001-api/index.ts");
const webhook = await read("supabase/functions/eco-sp-001-mercado-pago-webhook/index.ts");
const productionMigration = await read(
  "supabase/migrations/20260804010000_prepare_eco_payments_production.sql",
);
const envExample = await read(".env.example");
const operations = await read("docs/eco-sp-001-production-launch.md");

test("new payment creation is guarded by an explicit server-side kill switch", () => {
  assert.match(api, /paymentsEnabled\?: boolean/);
  assert.match(api, /Deno\.env\.get\("ECO_PAYMENTS_ENABLED"\) === "true"/);
  assert.match(api, /config\.paymentsEnabled !== true/);
  assert.match(envExample, /ECO_PAYMENTS_ENABLED=false/);
  assert.doesNotMatch(envExample, /NEXT_PUBLIC_(?:MERCADO_PAGO|ECO_PAYMENTS)/);
});

test("development, test, and production Mercado Pago environments are explicit and fail closed", () => {
  assert.match(api, /type MercadoPagoEnvironment = "development" \| "test" \| "production"/);
  assert.match(api, /environment !== "development"/);
  assert.match(api, /environment !== "test"/);
  assert.match(api, /environment !== "production"/);
  assert.match(webhook, /type MercadoPagoEnvironment = "development" \| "test" \| "production"/);
  assert.match(webhook, /payment\.liveMode !==/);
  assert.match(webhook, /mercadoPagoEnvironment === "production"/);
  assert.match(envExample, /MERCADO_PAGO_ENVIRONMENT=development/);
});

test("checkout URLs use exact hosts and the database accepts production safely", () => {
  assert.match(api, /SANDBOX_CHECKOUT_HOSTS/);
  assert.match(api, /PRODUCTION_CHECKOUT_HOSTS/);
  assert.match(api, /url\.username !== ""/);
  assert.match(api, /url\.password !== ""/);
  assert.match(api, /url\.port !== ""/);
  assert.match(
    productionMigration,
    /\^https:\/\/\(sandbox\|www\)\\\.mercadopago\\\.com\(\\\.br\)\?\//,
  );
});

test("database idempotency is bound to the original normalized buyer", () => {
  assert.match(productionMigration, /eco_order_idempotency_mismatch/);
  for (const field of [
    "buyer_name",
    "buyer_email",
    "buyer_whatsapp",
    "site_origin",
  ]) {
    assert.match(productionMigration, new RegExp(`selected_order\\.${field} is distinct from p_${field}`));
  }
});

test("authoritative webhook reconciliation includes environment and preference", () => {
  assert.match(webhook, /GET|\/v1\/payments\//);
  assert.match(webhook, /payment\.preferenceId !== null/);
  assert.match(webhook, /order\.preferenceId !== payment\.preferenceId/);
  assert.match(webhook, /order\.amountCents !== Math\.round\(payment\.amount \* 100\)/);
  assert.match(webhook, /payment\.currency !== "BRL"/);
  assert.match(webhook, /payment\.externalReference/);
});

test("operations guide covers staging, real smoke, diagnostics, and rollback", () => {
  for (const expected of [
    "20260803000000_convert_eco_founder_to_digital.sql",
    "20260804000000_set_eco_founder_price_2990.sql",
    "20260804010000_prepare_eco_payments_production.sql",
    "Teste em sandbox",
    "Teste real controlado",
    "Rollback operacional",
    "ECO_PAYMENTS_ENABLED=false",
  ]) assert.ok(operations.includes(expected), expected);
});
