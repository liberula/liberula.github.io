import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const reveal = await readFile(
  new URL("../app/eco/eco-sp-001/PostSolveReveal.tsx", import.meta.url),
  "utf8",
);
const sharing = await readFile(
  new URL("../app/eco/eco-sp-001/ShareControls.tsx", import.meta.url),
  "utf8",
);
const experience = await readFile(
  new URL("../app/eco/eco-sp-001/EcoCaseExperience.tsx", import.meta.url),
  "utf8",
);
const buyerForm = await readFile(
  new URL("../app/eco/eco-sp-001/BuyerForm.tsx", import.meta.url),
  "utf8",
);
const normalizedReveal = reveal.replace(/\s+/g, " ");

test("progress appears after the final evidence and commercial invitation", () => {
  const evidence = reveal.indexOf("NOVA EVIDÊNCIA / CÂMERA EXTERNA");
  const invitation = reveal.indexOf("AUTORIZAÇÃO DE CONTINUIDADE");
  const progress = reveal.indexOf("<FounderProgress");
  const price = reveal.indexOf("R$ 79,90");
  assert.ok(evidence < invitation);
  assert.ok(invitation < progress);
  assert.ok(progress < price);
});

test("loading and failure never render a false zero", async () => {
  const progress = await readFile(
    new URL("../app/eco/eco-sp-001/FounderProgress.tsx", import.meta.url),
    "utf8",
  );
  assert.match(progress, /A campanha está em andamento/);
  assert.doesNotMatch(progress, />0 de 100</);
});

test("collecting, reached, and closed presentations stay distinct", () => {
  assert.match(reveal, /campaign\?\.status === "closed" \? \(/);
  assert.match(normalizedReveal, /LOTE FUNDADOR ENCERRADO/);
});

test("sharing is below the primary CTA and remains secondary", () => {
  assert.ok(reveal.indexOf("offerCta") < reveal.indexOf("<ShareControls"));
  assert.match(sharing, /ECO_CASE_URL/);
  assert.match(sharing, /ENVIAR PELO WHATSAPP/);
  assert.match(sharing, /COPIAR LINK/);
  assert.match(sharing, /navigator\.clipboard\?\.writeText/);
  assert.match(sharing, /aria-live="polite"/);
});

test("referral capture and order analytics never send the code", () => {
  assert.match(experience, /sessionStorage\.setItem\(storageKey, captured\)/);
  assert.match(experience, /eco_referral_code_captured/);
  assert.match(buyerForm, /eco_referral_order_created/);
  for (const source of [experience, buyerForm, sharing]) {
    assert.doesNotMatch(source, /referral_code:\s*referralCode/);
    assert.doesNotMatch(source, /referralCode:\s*referralCode/);
  }
});
