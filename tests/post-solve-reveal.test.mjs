import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import {
  getRevealDelay,
  getUnlockStatus,
  isStageVisible,
  REVEAL_STAGES,
  UNLOCK_STATUSES,
} from "../app/eco/eco-sp-001/reveal-timeline.mjs";

const revealSource = await readFile(
  new URL("../app/eco/eco-sp-001/PostSolveReveal.tsx", import.meta.url),
  "utf8",
);
const answerSource = await readFile(
  new URL("../app/eco/eco-sp-001/CaseAnswerForm.tsx", import.meta.url),
  "utf8",
);
const experienceSource = await readFile(
  new URL("../app/eco/eco-sp-001/EcoCaseExperience.tsx", import.meta.url),
  "utf8",
);
const pageSource = await readFile(
  new URL("../app/eco/eco-sp-001/page.tsx", import.meta.url),
  "utf8",
);
const revealText = revealSource.replace(/\s+/g, " ");

test("correct answers remove the briefing and answer form before the reveal", () => {
  assert.match(answerSource, /if \(result\.correct\) \{\s*setState\("correct"\)/);
  assert.match(answerSource, /onCorrect\(\)/);
  assert.match(
    experienceSource,
    /if \(solved\) \{\s*return <PostSolveReveal referralCode=\{referralCode\} \/>;\s*\}/,
  );
  assert.ok(
    experienceSource.indexOf("return <PostSolveReveal") <
      experienceSource.indexOf("ARQUIVO DE INVESTIGAÇÃO / SÃO PAULO"),
  );
  assert.match(experienceSource, /<CaseAnswerForm onCorrect=/);
  assert.match(pageSource, /<EcoCaseExperience \/>/);
  assert.doesNotMatch(answerSource, /R\$ 79,90/);
});

test("unlock transition is ordered and reduced motion shortens every wait", () => {
  assert.deepEqual(UNLOCK_STATUSES, [
    "CONCLUSÃO RECEBIDA",
    "CRUZANDO REGISTROS",
    "LOCAL CONFIRMADO",
    "RECUPERANDO ARQUIVO DE ÁUDIO",
  ]);
  assert.equal(getUnlockStatus(0), UNLOCK_STATUSES[0]);
  assert.equal(getUnlockStatus(99), UNLOCK_STATUSES.at(-1));
  for (let step = 0; step < REVEAL_STAGES.offer; step += 1) {
    assert.ok(getRevealDelay(step, true) < getRevealDelay(step, false));
    assert.ok(getRevealDelay(step, true) <= 40);
  }
});

test("offer appears only after the final narrative evidence", () => {
  assert.ok(REVEAL_STAGES.report < REVEAL_STAGES.containment);
  assert.ok(REVEAL_STAGES.containment < REVEAL_STAGES.evidence);
  assert.ok(REVEAL_STAGES.evidence < REVEAL_STAGES.offer);
  assert.equal(
    isStageVisible(REVEAL_STAGES.evidence, REVEAL_STAGES.offer),
    false,
  );
  assert.match(revealSource, /href=\{buildPurchasePath\(referralCode\)\}/);
  assert.doesNotMatch(revealSource, /<BuyerForm/);
});

test("recovered audio is timed, sequential, and preserves Quina's account", () => {
  const requiredCopy = [
    "TRANSCRIÇÃO PARCIAL / ARQUIVO DE ÁUDIO RECUPERADO",
    "AGENTE QUINA",
    "Estou no escritório de Jonas Valença",
    "não está levando ao corredor esperado",
    "não corresponde a nenhuma parte da planta do imóvel",
    "não poderia existir dentro do edifício",
    "continua além do campo iluminado",
    "sonda de referência",
    "continuar transmitindo se a passagem se fechar",
    "inspeção direta",
    "Iniciando travessia",
  ];
  for (const copy of requiredCopy) assert.ok(revealText.includes(copy), copy);

  const timestamps = [...revealSource.matchAll(/\[(\d{2}):(\d{2})\]/g)].map(
    ([, minutes, seconds]) => Number(minutes) * 60 + Number(seconds),
  );
  assert.deepEqual(timestamps, [3, 8, 14, 22, 30, 37, 44, 53]);
  assert.ok(
    timestamps.every(
      (value, index) => index === 0 || value > timestamps[index - 1],
    ),
  );
  assert.match(revealSource, /<time className=\{styles\.transcriptTime\}/);
  assert.doesNotMatch(revealSource, /<audio|audio controls/i);
});

test("white-room evidence remains the final narrative visual before commerce", () => {
  const containmentIndex = revealSource.indexOf("RELATÓRIO DE CONTENÇÃO");
  const evidenceIndex = revealSource.indexOf("ANEXO VISUAL RECUPERADO");
  const invitationIndex = revealSource.indexOf(
    "ECO-SP-001 foi liberado como avaliação inicial",
  );
  const priceIndex = revealSource.indexOf("R$ 79,90");
  assert.ok(containmentIndex < evidenceIndex);
  assert.ok(evidenceIndex < invitationIndex);
  assert.ok(invitationIndex < priceIndex);
  assert.doesNotMatch(revealSource, /CONCLUSÃO DO CASO PÚBLICO/);
  assert.doesNotMatch(revealSource, /Investigação concluída/);
  assert.doesNotMatch(revealSource, /continua ativa e não foi encerrada/);
  assert.doesNotMatch(
    revealSource,
    /Outras ocorrências permanecem sem solução/,
  );

  const publicImageSources = [...revealSource.matchAll(/\bsrc="([^"]+)"/g)].map(
    ([, source]) => source,
  );
  assert.deepEqual(publicImageSources, [
    "/eco/eco-sp-001/agent-field-record.png",
    "/eco/eco-sp-001/white-room-evidence.png",
  ]);
});

test("the case public directory contains only approved public assets", async () => {
  const publicCaseAssets = await readdir(
    new URL("../public/eco/eco-sp-001/", import.meta.url),
  );
  assert.deepEqual(publicCaseAssets.sort(), [
    "agent-field-record.png",
    "eco-sp-001-atalho.pdf",
    "white-room-evidence.png",
  ]);
});

test("funnel events remain scoped and contain no buyer data", () => {
  for (
    const event of [
      "eco_case_reveal_started",
      "eco_case_agent_report_viewed",
      "eco_case_white_room_viewed",
      "eco_case_offer_viewed",
      "eco_case_offer_cta_clicked",
      "eco_purchase_cta_clicked",
    ]
  ) {
    assert.ok(revealSource.includes(event), event);
  }
  assert.match(revealSource, /case_id: "eco-sp-001"/);
  assert.doesNotMatch(revealSource, /canonicalAnswer|preparedPayload|postalCode/);
});
