import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import {
  getRevealDelay,
  isStageVisible,
  LAST_REVEAL_STEP,
  REVEAL_STAGES,
} from "../app/eco/eco-sp-001/reveal-timeline.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const reveal = await read("app/eco/eco-sp-001/PostSolveReveal.tsx");
const answer = await read("app/eco/eco-sp-001/CaseAnswerForm.tsx");
const experience = await read("app/eco/eco-sp-001/EcoCaseExperience.tsx");
const purchase = await read("app/eco/eco-sp-001/comprar/PurchaseExperience.tsx");
const api = await read("supabase/functions/eco-sp-001-api/index.ts");
const css = await read("app/eco/eco-sp-001/EcoCase.module.css");
const normalized = reveal.replace(/\s+/g, " ");

test("correct answers start a short automatic post-solve sequence", () => {
  assert.match(answer, /if \(result\.correct\)/);
  assert.match(answer, /onCorrect\(\)/);
  assert.match(experience, /if \(solved\)/);
  assert.equal(LAST_REVEAL_STEP, REVEAL_STAGES.offer);
  assert.equal(getRevealDelay(0, true), 0);
  assert.ok(getRevealDelay(0, false) < 1000);
  assert.ok(isStageVisible(REVEAL_STAGES.passage, REVEAL_STAGES.comparison));
  assert.match(reveal, /window\.setTimeout/);
  assert.match(reveal, /Math\.min\(current \+ 1, LAST_REVEAL_STEP\)/);
});

test("confirmation rewards the player and uses only the canonical address", () => {
  for (const copy of [
    "LOCAL IDENTIFICADO",
    "Rua Benjamin Constant, 200",
    "Sé, São Paulo",
    "Sua conclusão permitiu localizar o ponto final das rotas",
    "incorporada ao registro operacional ECO-SP-001",
  ]) assert.ok(normalized.includes(copy), copy);
  assert.doesNotMatch(reveal, /Rua Benjamin Constant, 19[6]/);
});

test("essential stages preserve consequence, Quina, impossible space, and interruption", () => {
  for (const copy of [
    "Uma equipe pôde entrar.",
    "agente Quina",
    "Só a decoração, até agora.",
    "No registro de Jonas, não havia passagem.",
    "Isso não cabe dentro do prédio.",
    "A profundidade excedia os limites do prédio.",
    "Eu acho que isso sabia que eu estava aqui.",
    "SINAL PERDIDO",
    "Quina não respondeu.",
  ]) assert.ok(normalized.includes(copy), copy);
});

test("the final status stays unknown and the entity is never explained", () => {
  assert.match(normalized, /<dt>Agente Quina<\/dt><dd>STATUS DESCONHECIDO<\/dd>/);
  assert.match(normalized, /QUINA NÃO RETORNOU/);
  assert.match(normalized, /O ponto foi isolado/);
  assert.doesNotMatch(reveal, /Quina morreu|criatura|monstro|entidade era|origem da passagem/iu);
});

test("approved repository assets replace every narrative placeholder", () => {
  assert.match(reveal, /src="\/eco\/eco-sp-001\/agent-field-record\.png"/);
  assert.match(reveal, /src="\/eco\/eco-sp-001\/postsolve-jonas-threshold\.png"/);
  assert.match(reveal, /src="\/eco\/eco-sp-001\/white-room-evidence\.png"/);
  assert.match(reveal, /src="\/eco\/eco-sp-001\/postsolve-quina-final-record\.png"/);
  assert.match(reveal, /data-asset-status="final"/);
  assert.doesNotMatch(reveal, /PendingAsset|data-asset-status="placeholder"|REGISTRO VISUAL PENDENTE/);
});

test("the final-record alt text does not announce the subtle presence", () => {
  const altTexts = [...reveal.matchAll(/alt="([^"]*)"/g)].map((match) => match[1]);
  assert.ok(altTexts.length >= 3);
  assert.equal(altTexts.some((alt) => /entidade|criatura|reflexo/iu.test(alt)), false);
});

test("fiction ends before the visually distinct Liberula offer", () => {
  const cliffhanger = reveal.indexOf("QUINA NÃO RETORNOU");
  const note = reveal.indexOf("AGORA, FORA DA FICÇÃO");
  const price = reveal.indexOf("R$ 29,90");
  assert.ok(cliffhanger >= 0 && cliffhanger < note && note < price);
  assert.match(reveal, /\/eco\/liberula-mark\.svg/);
  assert.match(css, /\.liberulaNote[\s\S]*#f2cb32/);
});

test("Liberula progress copy is black and the footer links to its Instagram", () => {
  assert.match(css, /\.liberulaNote \.founderProgress strong,[\s\S]*color: #171815/);
  assert.match(css, /\.liberulaNote \.founderProgress p/);
  assert.match(reveal, /Gostou\? Nos marque no insta e compartilhe com os amigos!/);
  assert.match(reveal, /href="https:\/\/www\.instagram\.com\/liberulagames\/"/);
  assert.match(reveal, /> @liberulagames/);
});

test("post-solve presentation and financial integration use R$ 29,90", () => {
  assert.match(reveal, /R\$ 29,90/);
  assert.doesNotMatch(reveal, /R\$ 49,90/);
  assert.match(purchase, /R\$ 29,90/);
  assert.match(api, /amountCents: 2990/);
  assert.match(api, /unitPrice: 29\.90/);
});

test("founder CTA preserves the existing purchase and referral contract", () => {
  assert.match(reveal, /QUERO SER UM AGENTE/);
  assert.match(reveal, /href=\{buildPurchasePath\(referralCode\)\}/);
  assert.doesNotMatch(reveal, /<BuyerForm/);
});

test("legacy and current analytics remain covered without PII", () => {
  for (const event of [
    "eco_case_reveal_started",
    "eco_case_agent_report_viewed",
    "eco_case_report_released",
    "eco_case_white_room_viewed",
    "eco_case_red_door_revealed",
    "eco_case_free_ending_completed",
    "eco_case_offer_viewed",
    "eco_case_offer_cta_clicked",
    "eco_purchase_cta_clicked",
    "eco_founder_progress_error",
  ]) assert.ok(reveal.includes(event), event);
  assert.doesNotMatch(reveal, /answer:|buyer_email:|participant_email:/);
});

test("responsive logs and reduced motion remain explicit", () => {
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.postSolveTransmission p/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.postSolveStage/);
  assert.match(reveal, /prefers-reduced-motion: reduce/);
});

test("the third hint narrows the geography without naming the answer street", () => {
  assert.match(answer, /Segundo nossos agentes, a rua que você procura desemboca na Praça da Sé\./);
  const hints = answer.slice(answer.indexOf("const HINTS"), answer.indexOf("] as const"));
  assert.doesNotMatch(hints, /Benjamin Constant/);
});

test("case asset inventory contains the approved post-solve images", async () => {
  const assets = await readdir(new URL("../public/eco/eco-sp-001/", import.meta.url));
  assert.deepEqual(assets.sort(), [
    "agent-field-record.png",
    "eco-sp-001-atalho.pdf",
    "postsolve-jonas-threshold.png",
    "postsolve-quina-final-record.png",
    "white-room-evidence.png",
  ]);
});
