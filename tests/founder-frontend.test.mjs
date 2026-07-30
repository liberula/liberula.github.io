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
const checkout = await readFile(
  new URL("../app/eco/eco-sp-001/CheckoutContinuation.tsx", import.meta.url),
  "utf8",
);
const normalizedReveal = reveal.replace(/\s+/g, " ");

test("progress exists only after the narrative conclusion and invitation", () => {
  const conclusion = reveal.indexOf("Investigação concluída");
  const invitation = reveal.indexOf("ECO-SP-001 foi liberado");
  const progress = reveal.indexOf("<FounderProgress");
  const price = reveal.indexOf("R$ 79,90");
  assert.ok(conclusion < invitation);
  assert.ok(invitation < progress);
  assert.ok(progress < price);
});

test("loading and failure never render a false zero", () => {
  const fallback = normalizedReveal.slice(
    normalizedReveal.indexOf("function FounderProgress"),
  );
  assert.match(fallback, /A campanha está em andamento/);
  assert.doesNotMatch(fallback, />0 de 100</);
});

test("collecting, reached, and closed presentations stay distinct", () => {
  assert.match(
    normalizedReveal,
    /\{campaign\.confirmed\} de \{campaign\.target\} dossiês confirmados/,
  );
  assert.match(normalizedReveal, /META DE PRODUÇÃO ATINGIDA/);
  assert.match(normalizedReveal, /Novos investigadores ainda podem participar/);
  assert.match(normalizedReveal, /LOTE FUNDADOR ENCERRADO/);
  assert.match(
    normalizedReveal,
    /campaign\?\.status === "closed" \? \(/,
  );
});

test("sharing is secondary, canonical for visitors, and accessible", () => {
  assert.ok(reveal.indexOf("offerCta") < reveal.indexOf("<ShareControls"));
  assert.match(reveal, /: "unknown"/);
  assert.match(sharing, /ECO_CASE_URL/);
  assert.match(sharing, /A campanha está em andamento/);
  assert.match(sharing, /ENVIAR PELO WHATSAPP/);
  assert.match(sharing, /COPIAR LINK/);
  assert.match(sharing, /navigator\.clipboard\?\.writeText/);
  assert.match(sharing, /Link copiado/);
  assert.match(sharing, /aria-live="polite"/);
});

test("referral capture and order analytics never send the code", () => {
  assert.match(experience, /sessionStorage\.setItem\(storageKey, captured\)/);
  assert.match(experience, /eco_referral_code_captured/);
  assert.match(checkout, /eco_referral_order_created/);
  for (const source of [experience, checkout, sharing]) {
    assert.doesNotMatch(source, /referral_code:\s*referralCode/);
    assert.doesNotMatch(source, /referralCode:\s*referralCode/);
  }
});
