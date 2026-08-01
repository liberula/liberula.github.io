import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  ECO_EMAIL_COLORS,
  renderEcoDeliveryEmail,
} from "../lib/eco/delivery-email.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rendererSource = fs.readFileSync(path.join(root, "lib/eco/delivery-email.mjs"), "utf8");
const senderSource = fs.readFileSync(path.join(root, "supabase/functions/eco-case-delivery/index.ts"), "utf8");
const previewSource = fs.readFileSync(path.join(root, "app/api/internal/eco/delivery-preview/route.ts"), "utf8");
const url = "https://liberula.com/eco/eco-sp-001/iniciar/?delivery=QWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4";

test("sender and preview import the one shared renderer", () => {
  assert.match(senderSource, /import \{ renderEcoDeliveryEmail \} from "\.\.\/\.\.\/\.\.\/lib\/eco\/delivery-email\.mjs"/);
  assert.match(senderSource, /const content = renderEcoDeliveryEmail\(email\)/);
  assert.match(previewSource, /import \{ renderEcoDeliveryEmail \} from/);
  assert.match(previewSource, /const content = renderEcoDeliveryEmail/);
  assert.equal((senderSource.match(/https:\/\/api\.postmarkapp\.com\/email/g) ?? []).length, 1);
});

test("renderer produces the required subject, hierarchy, copy, button, and fallback URL", () => {
  const email = renderEcoDeliveryEmail({
    caseId: "eco-sp-001",
    participantName: "  Gabriel   Fazzio de Paula  ",
    deliveryUrl: url,
  });
  assert.equal(email.subject, "E.C.O. — Caso ECO-SP-001 disponível");
  assert.equal(email.preheader, "Seu acesso individual ao Caso ECO-SP-001 está disponível.");
  for (const value of [
    "E.C.O.",
    "Encontrar. Conter. Ocultar.",
    "TRANSMISSÃO ECO-SP-001",
    "ASPIRANTE: GABRIEL FAZZIO DE PAULA",
    "Seu primeiro caso está disponível.",
    "ACESSAR CASO",
    "Este acesso é individual. Não compartilhe o link.",
    url,
  ]) {
    assert(email.textBody.includes(value), `text is missing ${value}`);
    assert(email.htmlBody.includes(value.replaceAll("&", "&amp;")), `html is missing ${value}`);
  }
  assert.match(email.htmlBody, new RegExp(`<a href="${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>ACESSAR CASO<`));
});

test("missing names render only ASPIRANTE and unsafe names are escaped", () => {
  const generic = renderEcoDeliveryEmail({ caseId: "eco-sp-001", participantName: null, deliveryUrl: url });
  assert.match(generic.textBody, /\nASPIRANTE\n/);
  assert.doesNotMatch(JSON.stringify(generic), /IDENTIDADE NÃO REGISTRADA|ASPIRANTE:/);
  const escaped = renderEcoDeliveryEmail({ caseId: "eco-sp-001", participantName: "Nome <script>", deliveryUrl: url });
  assert(escaped.textBody.includes("ASPIRANTE: NOME <SCRIPT>"));
  assert(escaped.htmlBody.includes("ASPIRANTE: NOME &lt;SCRIPT&gt;"));
  assert.doesNotMatch(escaped.htmlBody, /<script>/i);
});

test("email uses copied site constants and conservative compatible HTML", () => {
  const email = renderEcoDeliveryEmail({ caseId: "eco-sp-001", participantName: "Pessoa", deliveryUrl: url });
  assert.match(rendererSource, /copied from the participant-facing experience/);
  assert.match(rendererSource, /EcoCase\.module\.css/);
  assert.match(rendererSource, /DeliveryLanding\.module\.css/);
  for (const color of ["#080909", "#111313", "#f0ede5", "#bbb7ae", "#8e8a82", "#d94b55", "#b62430"]) {
    assert(Object.values(ECO_EMAIL_COLORS).includes(color));
    assert(email.htmlBody.includes(color));
  }
  assert.match(email.htmlBody, /max-width:600px/);
  assert.match(email.htmlBody, /role="presentation"/);
  assert.doesNotMatch(email.htmlBody, /<img\b|<svg\b|<script\b|<link\b|background-image|var\(--/i);
  assert.doesNotMatch(email.htmlBody, /eco-emblem\.webp/i);
});

test("email excludes forbidden product, recruiting, promotional, payment, and answer copy", () => {
  const email = renderEcoDeliveryEmail({ caseId: "eco-sp-001", participantName: "Pessoa", deliveryUrl: url });
  assert.doesNotMatch(
    JSON.stringify(email),
    /material de avaliação|recrutamento|contratação|aprovad[oa] para|segredo absoluto|promoção|oferta|pagamento|canonical answer|resposta correta/i,
  );
});

test("preview and send HTML are identical for equivalent renderer input", () => {
  const input = { caseId: "eco-sp-001", participantName: "Pessoa", deliveryUrl: url };
  const postmarkContent = renderEcoDeliveryEmail(input);
  const previewContent = renderEcoDeliveryEmail(input);
  assert.equal(previewContent.htmlBody, postmarkContent.htmlBody);
  assert.equal(previewContent.textBody, postmarkContent.textBody);
});
