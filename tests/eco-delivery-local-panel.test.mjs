import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  filterParticipants,
  getDeliveryUrl,
  isLocalOperatorHostname,
  isSendEligible,
  toggleParticipantSelection,
} from "../app/internal/eco/deliveries/delivery-panel-model.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pagePath = path.join(root, "app/internal/eco/deliveries/page.tsx");
const clientPath = path.join(root, "app/internal/eco/deliveries/EcoDeliveryPanel.tsx");
const participantsPath = path.join(root, "app/api/internal/eco/participants/route.ts");
const deliveriesPath = path.join(root, "app/api/internal/eco/deliveries/route.ts");
const sharedPath = path.join(root, "app/api/internal/eco/_shared.ts");
const page = fs.readFileSync(pagePath, "utf8");
const client = fs.readFileSync(clientPath, "utf8");
const participantsProxy = fs.readFileSync(participantsPath, "utf8");
const deliveriesProxy = fs.readFileSync(deliveriesPath, "utf8");
const shared = fs.readFileSync(sharedPath, "utf8");

const participant = (overrides = {}) => ({
  id: "123e4567-e89b-42d3-a456-426614174000",
  name: "Pessoa Controlada",
  email: "controlled@example.test",
  status: "registered",
  registered_at: "2026-07-31T12:00:00Z",
  delivery_id: null,
  delivery_status: null,
  delivery_reference: null,
  sent_at: null,
  attempt_count: null,
  last_error_code: null,
  ...overrides,
});

test("local panel route exists and is explicitly unavailable off localhost", () => {
  assert(fs.existsSync(pagePath));
  assert.match(client, /E\.C\.O\. — OPERAÇÕES DE ENTREGA/);
  assert.match(client, /AMBIENTE LOCAL — AÇÕES PODEM ENVIAR E-MAILS REAIS/);
  assert.match(client, /Painel administrativo indisponível neste ambiente\./);
  assert.equal(isLocalOperatorHostname("localhost"), true);
  assert.equal(isLocalOperatorHostname("127.0.0.1"), true);
  assert.equal(isLocalOperatorHostname("liberula.com"), false);
  assert.match(shared, /process\.env\.NODE_ENV !== "development"/);
});

test("client contains no server secret, persistence, or administrative analytics", () => {
  const publicSources = `${page}\n${client}\n${fs.readFileSync(path.join(root, "app/internal/eco/deliveries/delivery-panel-model.mjs"), "utf8")}`;
  assert.doesNotMatch(
    publicSources,
    /ECO_ADMIN_SUPABASE|ECO_DELIVERY_ADMIN_SECRET|SECRET_KEY|SERVICE_ROLE|POSTMARK_SERVER_TOKEN|NEXT_PUBLIC_.*ADMIN/i,
  );
  assert.doesNotMatch(publicSources, /localStorage|sessionStorage|indexedDB/i);
  assert.doesNotMatch(publicSources, /posthog|analytics|capture\(/i);
});

test("participant proxy is server-only, bounded, and exposes only approved columns", () => {
  assert.match(shared, /process\.env\.ECO_ADMIN_SUPABASE_URL/);
  assert.match(shared, /process\.env\.ECO_ADMIN_SUPABASE_SECRET_KEY/);
  assert.match(shared, /startsWith\("sb_secret_"\)/);
  assert.match(shared, /process\.env\.ECO_DELIVERY_ADMIN_SECRET/);
  assert.match(participantsProxy, /registered_at\.desc/);
  assert.match(participantsProxy, /apikey: configuration\.secretKey/);
  assert.doesNotMatch(participantsProxy, /Authorization:/);
  assert.match(participantsProxy, /searchParams\.set\("limit", "100"\)/);
  assert.match(participantsProxy, /id,name,email,status,registered_at/);
  assert.match(participantsProxy, /delivery_reference,sent_at,attempt_count,last_error_code/);
  assert.doesNotMatch(participantsProxy, /provider_message_id|consent|metadata|source_record|ingested_event/i);
  assert.doesNotMatch(`${participantsProxy}\n${deliveriesProxy}`, /console\.|stack|response\.text\(/);
  assert.match(participantsProxy, /configuration_missing/);
  assert.match(participantsProxy, /participant_query_failed/);
});

test("client-side participant filters cover identity and both statuses", () => {
  const records = [
    participant(),
    participant({
      id: "223e4567-e89b-42d3-a456-426614174001",
      name: "Outra Pessoa",
      email: "other@example.test",
      status: "paused",
      delivery_id: "323e4567-e89b-42d3-a456-426614174002",
      delivery_status: "sent",
    }),
  ];
  assert.equal(filterParticipants(records, { search: "CONTROLLED" }).length, 1);
  assert.equal(filterParticipants(records, { search: "other@" }).length, 1);
  assert.equal(filterParticipants(records, { participantStatus: "paused" }).length, 1);
  assert.equal(filterParticipants(records, { deliveryStatus: "sent" }).length, 1);
  assert.equal(filterParticipants(records, { onlyWithoutDelivery: true }).length, 1);
});

test("selection is deliberate, has no select-all, and stops at ten", () => {
  let selected = new Set();
  for (let index = 0; index < 10; index += 1) {
    const id = `123e4567-e89b-42d3-a456-${String(index).padStart(12, "0")}`;
    selected = toggleParticipantSelection(selected, id, true).selectedIds;
  }
  const rejected = toggleParticipantSelection(
    selected,
    "223e4567-e89b-42d3-a456-426614174001",
    true,
  );
  assert.equal(rejected.selectedIds.size, 10);
  assert.equal(rejected.limitReached, true);
  assert.doesNotMatch(client, /Selecionar todos|Enviar para todos/i);
});

test("prepare and send remain separate explicit operations", () => {
  assert.match(client, /action: "prepare"/);
  assert.match(client, /case_id: "eco-sp-001"/);
  assert.match(client, /action: "send"/);
  assert.match(client, /Entregas ausentes não serão preparadas automaticamente/);
  assert.match(client, /Você está prestes a enviar.*e-mail\(s\) reais pelo Postmark/);
  assert.match(client, /Esta ação não é uma pré-visualização/);
  assert.match(client, /participant\.delivery_status === "pending"/);
  assert.match(client, /participant\.delivery_status === "failed"/);
  assert.doesNotMatch(client, /participant\.delivery_status === "sent"[\s\S]{0,160}confirmSend/);
  assert.equal(isSendEligible(participant({ delivery_status: "pending" })), true);
  assert.equal(isSendEligible(participant({ delivery_status: "failed", attempt_count: 2 })), true);
  assert.equal(isSendEligible(participant({ delivery_status: "failed", attempt_count: 3 })), false);
  assert.equal(isSendEligible(participant({ delivery_status: "sent" })), false);
});

test("operations proxy validates explicit bounded IDs and sanitizes results", () => {
  assert.match(deliveriesProxy, /value\.participant_ids\.length <= 10/);
  assert.match(deliveriesProxy, /value\.delivery_ids\.length <= 10/);
  assert.match(deliveriesProxy, /new Set\(value\.participant_ids\)/);
  assert.match(deliveriesProxy, /new Set\(value\.delivery_ids\)/);
  assert.match(deliveriesProxy, /sanitizeOperationResponse/);
  assert.match(deliveriesProxy, /prepare_failed/);
  assert.match(deliveriesProxy, /send_failed/);
  assert.doesNotMatch(deliveriesProxy, /provider_message_id|raw provider|sql error/i);
});

test("delivery URL preserves the opaque reference and opening is a safe new tab", () => {
  const reference = "QWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4";
  const record = participant({ delivery_reference: reference });
  assert.equal(
    getDeliveryUrl(record),
    `https://liberula.com/eco/eco-sp-001/iniciar/?delivery=${reference}`,
  );
  assert.match(client, /window\.open\(url, "_blank", "noopener,noreferrer"\)/);
  assert.match(client, /await refreshParticipants\(\)/);
  assert.match(client, /RESULTADO DA OPERAÇÃO/);
});

test("global PostHog provider skips every internal route", () => {
  const provider = fs.readFileSync(path.join(root, "app/PostHogProvider.tsx"), "utf8");
  assert.match(provider, /pathname\?\.startsWith\("\/internal\/"\)/);
  assert.match(provider, /if \(isInternalRoute\) return/);
  const goatCounter = fs.readFileSync(path.join(root, "app/GoatCounterScript.tsx"), "utf8");
  assert.match(goatCounter, /pathname\?\.startsWith\("\/internal\/"\)/);
  assert.match(goatCounter, /return null/);
});
