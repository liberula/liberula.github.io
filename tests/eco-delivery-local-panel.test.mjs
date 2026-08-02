import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  filterParticipants,
  getOperatorStatus,
  getOpeningState,
  getSendActionLabel,
  isLocalOperatorHostname,
  isSendEligible,
  toggleParticipantSelection,
} from "../app/internal/eco/deliveries/delivery-panel-model.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const page = read("app/internal/eco/deliveries/page.tsx");
const client = read("app/internal/eco/deliveries/EcoDeliveryPanel.tsx");
const model = read("app/internal/eco/deliveries/delivery-panel-model.mjs");
const participantsProxy = read("app/api/internal/eco/participants/route.ts");
const deliveriesProxy = read("app/api/internal/eco/deliveries/route.ts");
const previewProxy = read("app/api/internal/eco/delivery-preview/route.ts");
const shared = read("app/api/internal/eco/_shared.ts");

const participant = (overrides = {}) => ({
  id: "123e4567-e89b-42d3-a456-426614174000",
  name: "Pessoa Controlada",
  email: "controlled@example.test",
  status: "registered",
  registered_at: "2026-07-31T12:00:00Z",
  delivery_status: null,
  sent_at: null,
  opened_at: null,
  attempt_count: null,
  last_error_code: null,
  ...overrides,
});

test("local panel and preview are unavailable off local development", () => {
  assert.match(client, /E\.C\.O\. — ENVIO DE E-MAILS/);
  assert.match(client, /AMBIENTE LOCAL — AÇÕES PODEM ENVIAR E-MAILS REAIS/);
  assert.match(client, /Painel administrativo indisponível neste ambiente/);
  assert.equal(isLocalOperatorHostname("localhost"), true);
  assert.equal(isLocalOperatorHostname("127.0.0.1"), true);
  assert.equal(isLocalOperatorHostname("liberula.com"), false);
  assert.match(shared, /process\.env\.NODE_ENV !== "development"/);
  assert.match(previewProxy, /isLocalDevelopmentRequest\(request\)/);
  assert.match(previewProxy, /unavailableResponse\(\)/);
});

test("client exposes no secret, persistence, analytics, delivery identifier, or reference", () => {
  const publicSources = `${page}\n${client}\n${model}`;
  assert.doesNotMatch(publicSources, /ECO_ADMIN_SUPABASE|ECO_DELIVERY_ADMIN_SECRET|SECRET_KEY|SERVICE_ROLE|POSTMARK_SERVER_TOKEN|NEXT_PUBLIC_.*ADMIN/i);
  assert.doesNotMatch(publicSources, /localStorage|sessionStorage|indexedDB/i);
  assert.doesNotMatch(publicSources, /posthog|analytics|capture\(/i);
  assert.doesNotMatch(client, /delivery_id|delivery_reference/i);
  assert.doesNotMatch(participantsProxy, /delivery_reference|provider_message_id/i);
});

test("participant proxy remains read-only, bounded, and exposes operational fields only", () => {
  assert.match(participantsProxy, /registered_at\.desc/);
  assert.match(participantsProxy, /apikey: configuration\.secretKey/);
  assert.doesNotMatch(participantsProxy, /Authorization:/);
  assert.match(participantsProxy, /searchParams\.set\("limit", "100"\)/);
  assert.match(participantsProxy, /id,name,email,status,registered_at/);
  assert.match(participantsProxy, /participant_id,status,sent_at,opened_at,attempt_count,last_error_code/);
  assert.doesNotMatch(participantsProxy, /method: "(?:POST|PATCH|DELETE)"[\s\S]{0,120}rest\/v1\/eco_/i);
  assert.doesNotMatch(`${participantsProxy}\n${deliveriesProxy}\n${previewProxy}`, /console\.|stack|response\.text\(/);
});

test("operator statuses hide internal preparation state", () => {
  assert.equal(getOperatorStatus(participant()), "not_sent");
  assert.equal(getOperatorStatus(participant({ delivery_status: "pending" })), "not_sent");
  assert.equal(getOperatorStatus(participant({ delivery_status: "sending" })), "sending");
  assert.equal(getOperatorStatus(participant({ delivery_status: "sent" })), "sent");
  assert.equal(getOperatorStatus(participant({ delivery_status: "failed" })), "failed");
  assert.equal(getOperatorStatus(participant({ status: "blocked" })), "blocked");
  assert.equal(getOperatorStatus(participant({ delivery_status: "cancelled" })), "blocked");
  for (const label of ["NÃO ENVIADO", "ENVIANDO", "ENVIADO", "FALHOU", "BLOQUEADO"]) {
    assert(client.includes(label));
  }
  assert.doesNotMatch(client, />PREPARAR DELIVERY<|>Preparar<|Delivery ID|Delivery reference|Pronta para/i);
});

test("main table contains only requested operational columns", () => {
  const header = client.match(/<thead><tr>([\s\S]*?)<\/tr><\/thead>/)?.[1] ?? "";
  for (const label of ["Seleção", "Nome", "E-mail", "Envio", "Abertura", "Último envio", "Ações"]) {
    assert(header.includes(label));
  }
  assert.doesNotMatch(header, /Tentativas|Registro|Referência|ID|Delivery/i);
});

test("opening state is operator-facing and sent-only", () => {
  assert.equal(getOpeningState(participant()), "not_applicable");
  assert.equal(getOpeningState(participant({ delivery_status: "pending" })), "not_applicable");
  assert.equal(getOpeningState(participant({ delivery_status: "sent" })), "unopened");
  assert.equal(getOpeningState(participant({ delivery_status: "sent", opened_at: "2026-08-01T20:10:00Z" })), "opened");
  for (const label of ["NÃO ABRIU", "ABRIU", "ABRIR ACESSO"]) assert(client.includes(label));
});

test("filters and deliberate selection remain bounded to ten with no select-all", () => {
  const records = [participant(), participant({ name: "Outra Pessoa", email: "other@example.test", delivery_status: "sent" })];
  assert.equal(filterParticipants(records, { search: "CONTROLLED" }).length, 1);
  assert.equal(filterParticipants(records, { search: "other@" }).length, 1);
  assert.equal(filterParticipants(records, { operatorStatus: "sent" }).length, 1);
  let selected = new Set();
  for (let index = 0; index < 10; index += 1) {
    selected = toggleParticipantSelection(selected, `123e4567-e89b-42d3-a456-${String(index).padStart(12, "0")}`, true).selectedIds;
  }
  assert.equal(toggleParticipantSelection(selected, "223e4567-e89b-42d3-a456-426614174001", true).limitReached, true);
  assert.doesNotMatch(client, /Selecionar todos|Enviar para todos/i);
});

test("normal send uses participant IDs and lists count, real-provider warning, and recipients", () => {
  assert.match(client, /action: "send_participants"/);
  assert.match(client, /case_id: "eco-sp-001"/);
  assert.match(client, /participant_ids: recipients\.map/);
  assert.match(client, /e-mail\(s\) reais pelo Postmark/);
  assert.match(client, /Destinatários:/);
  assert.match(client, /recipients\.map\(\(participant\) => `• \$\{participant\.email\}`\)/);
  assert.match(client, />ENVIAR E-MAIL</);
  assert.equal(isSendEligible(participant()), true);
  assert.equal(isSendEligible(participant({ delivery_status: "pending" })), true);
  assert.equal(isSendEligible(participant({ delivery_status: "failed", attempt_count: 2 })), true);
  assert.equal(isSendEligible(participant({ delivery_status: "failed", attempt_count: 3 })), false);
  assert.equal(isSendEligible(participant({ delivery_status: "sent" })), false);
  assert.equal(isSendEligible(participant({ status: "blocked" })), false);
  assert.equal(getSendActionLabel(participant({ delivery_status: "failed" })), "TENTAR NOVAMENTE");
});

test("send_participants orchestrates existing prepare and send without returning internal IDs", () => {
  assert.match(deliveriesProxy, /value\.action === "send_participants"/);
  assert.match(deliveriesProxy, /callDeliveryFunction\(configuration, "prepare"/);
  assert.match(deliveriesProxy, /callDeliveryFunction\(configuration, "send"/);
  assert.match(deliveriesProxy, /preparedByParticipant/);
  assert.match(deliveriesProxy, /participant_id: participantId/);
  assert.match(deliveriesProxy, /already_sent/);
  assert.match(deliveriesProxy, /retry_limit_reached/);
  assert.match(deliveriesProxy, /return "blocked"/);
  assert.doesNotMatch(deliveriesProxy.match(/async function sendParticipants[\s\S]*?\n}\n\nexport async function POST/)?.[0] ?? "", /provider_message_id|delivery_reference/);
});

test("legacy prepare and delivery-ID send contracts remain accepted", () => {
  assert.match(deliveriesProxy, /value\.action === "prepare"/);
  assert.match(deliveriesProxy, /value\.action === "send"/);
  assert.match(deliveriesProxy, /value\.delivery_ids\.length <= 10/);
  assert.match(deliveriesProxy, /sanitizeOperationResponse/);
});

test("preview is renderer-backed, side-effect-free, and offers all presentation modes", () => {
  assert.match(previewProxy, /renderEcoDeliveryEmail/);
  assert.match(previewProxy, /https:\/\/liberula\.com\/eco\/eco-sp-001\/iniciar\//);
  assert.doesNotMatch(previewProxy, /\?delivery=/);
  assert.match(previewProxy, /PARTICIPANTE DE EXEMPLO/);
  assert.match(previewProxy, /method: "GET"/);
  assert.doesNotMatch(previewProxy, /method: "(?:POST|PATCH|DELETE)"|deliveryFunctionUrl|Postmark|analytics|capture\(/i);
  for (const label of ["PRÉ-VISUALIZAR E-MAIL", "DESKTOP", "MOBILE", "TEXTO", "ABRIR EM NOVA ABA"]) {
    assert(client.includes(label));
  }
  assert.match(client, /srcDoc=\{preview\.htmlBody\}/);
  assert.match(client, /preview\.textBody/);
  assert.match(client, /selectedParticipants\.length === 1/);
  assert.match(client, /EXEMPLO — nenhuma pessoa selecionada/);
});

test("result feedback is bounded and operator-facing", () => {
  for (const label of ["ENVIADO", "FALHOU", "JÁ ENVIADO", "BLOQUEADO", "NÃO ENCONTRADO", "LIMITE DE TENTATIVAS"]) {
    assert(client.includes(label));
  }
  assert.doesNotMatch(client, /raw Postmark|raw Supabase|provider response/i);
});

test("global analytics providers skip internal routes", () => {
  const provider = read("app/PostHogProvider.tsx");
  const goatCounter = read("app/GoatCounterScript.tsx");
  assert.match(provider, /pathname\?\.startsWith\("\/internal\/"\)/);
  assert.match(provider, /if \(isInternalRoute\) return/);
  assert.match(goatCounter, /pathname\?\.startsWith\("\/internal\/"\)/);
  assert.match(goatCounter, /return null/);
});
