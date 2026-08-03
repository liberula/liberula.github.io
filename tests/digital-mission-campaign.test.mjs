import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const api = await read("supabase/functions/eco-sp-001-api/index.ts");
const webhook = await read("supabase/functions/eco-sp-001-mercado-pago-webhook/index.ts");
const migration = await read("supabase/migrations/20260803000000_convert_eco_founder_to_digital.sql");
const buyer = await read("app/eco/eco-sp-001/BuyerForm.tsx");
const validation = await read("app/eco/eco-sp-001/buyer-validation.mjs");
const progress = await read("app/eco/eco-sp-001/FounderProgress.tsx");

test("new orders are fixed to the R$ 49,90 digital mission", () => {
  assert.match(api, /title: "Próxima missão digital E\.C\.O\. \| Acesso Fundador"/);
  assert.match(api, /amountCents: 4990/);
  assert.match(api, /unitPrice: 49\.90/);
  assert.match(migration, /alter column amount_cents set default 4990/);
});

test("digital orders collect no delivery address or provider shipment", () => {
  assert.doesNotMatch(buyer, /Endereço de entrega|FiMapPin|addressFields/);
  assert.doesNotMatch(validation, /street|postalCode|address:/);
  assert.doesNotMatch(api, /buyer\.address|shipments:/);
  for (const column of [
    "delivery_street",
    "delivery_number",
    "delivery_neighborhood",
    "delivery_city",
    "delivery_state",
    "delivery_postal_code",
  ]) assert.match(migration, new RegExp(`alter column ${column} drop not null`));
});

test("webhook verifies the new amount and preserves historical payment compatibility", () => {
  assert.match(webhook, /\[49\.90, 79\.90\]\.includes\(payment\.amount\)/);
  assert.match(webhook, /order\.amountCents !== Math\.round\(payment\.amount \* 100\)/);
  assert.match(migration, /amount_cents in \(4990, 7990\)/);
});

test("progress above 100 remains capped visually while showing the real count", () => {
  assert.match(progress, /width: "100%"/);
  assert.match(progress, /Total atual: \{campaign\.confirmed\} participantes/);
});
