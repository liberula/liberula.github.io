import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildCaseAnswerPath,
  normalizeDeliveryReference,
} from "../app/eco/eco-sp-001/delivery-reference.mjs";

const pageUrl = new URL(
  "../app/eco/eco-sp-001/iniciar/page.tsx",
  import.meta.url,
);
const clientUrl = new URL(
  "../app/eco/eco-sp-001/iniciar/DeliveryLanding.tsx",
  import.meta.url,
);
const pageSource = await readFile(pageUrl, "utf8");
const clientSource = await readFile(clientUrl, "utf8");
const combinedSource = `${pageSource}\n${clientSource}`;

test("delivery route source exists and has private canonical metadata", async () => {
  await access(pageUrl);
  assert.match(
    pageSource,
    /Caso ECO-SP-001 \| Material de avaliação/,
  );
  assert.match(
    pageSource,
    /https:\/\/liberula\.com\/eco\/eco-sp-001\/iniciar\//,
  );
  assert.match(pageSource, /index: false/);
  assert.match(pageSource, /follow: false/);
});

test("dossier action is a safe normal link that does not force download", () => {
  assert.match(
    clientSource,
    /\/eco\/eco-sp-001\/eco-sp-001-atalho\.pdf/,
  );
  assert.match(clientSource, /<a[\s\S]*?href=\{DOSSIER_PATH\}/);
  assert.match(clientSource, /target="_blank"/);
  assert.match(clientSource, /rel="noopener noreferrer"/);
  assert.doesNotMatch(clientSource, /\bdownload(?:=|\s|>)/);
  assert.match(clientSource, /abre em uma nova aba/);
});

test("delivery analytics use the existing safe PostHog wrapper", () => {
  assert.match(clientSource, /safePosthogCapture/);
  assert.match(clientSource, /eco_case_delivery_landing_viewed/);
  assert.match(clientSource, /eco_case_dossier_opened/);
  assert.match(clientSource, /case_id: "eco-sp-001"/);
  assert.match(clientSource, /material_type: "pdf"/);
  assert.match(clientSource, /delivery_reference: reference/g);
  assert.doesNotMatch(clientSource, /posthog\.init/);
});

test("delivery-reference validator accepts only safe opaque references", () => {
  const valid = [
    "AbCdEf0123456789",
    "delivery_token-2026_A1",
    "A".repeat(200),
  ];
  for (const value of valid) assert.equal(normalizeDeliveryReference(value), value);

  const invalid = [
    null,
    undefined,
    "short_reference",
    "A".repeat(201),
    "contains a space 123",
    "unsafe@example.com",
    "../../private-token",
    "token?with=query!",
  ];
  for (const value of invalid) assert.equal(normalizeDeliveryReference(value), null);
});

test("answer route preserves only a valid delivery reference", () => {
  assert.equal(
    buildCaseAnswerPath("AbCdEf0123456789"),
    "/eco/eco-sp-001/?delivery=AbCdEf0123456789",
  );
  assert.equal(buildCaseAnswerPath("invalid"), "/eco/eco-sp-001/");
  assert.match(
    clientSource,
    /href=\{buildCaseAnswerPath\(deliveryReference\)\}/,
  );
});

test("delivery client contains no answer, PII, or backend secrets", () => {
  assert.doesNotMatch(combinedSource, /@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  assert.doesNotMatch(
    combinedSource,
    /canonicalAnswer|POSTMARK_SERVER_TOKEN|SUPABASE_SERVICE_ROLE_KEY|MERCADO_PAGO_ACCESS_TOKEN/,
  );
});
