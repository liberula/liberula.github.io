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
  assert.doesNotMatch(pageSource, /Onde as evidências convergem/);
  assert.doesNotMatch(answerSource, /R\$ 79,90/);
  assert.match(answerSource, /setState\("incorrect"\)/);
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

test("offer and buyer form remain unavailable until the narrative conclusion", () => {
  assert.ok(REVEAL_STAGES.report < REVEAL_STAGES.containment);
  assert.ok(REVEAL_STAGES.containment < REVEAL_STAGES.evidence);
  assert.ok(REVEAL_STAGES.evidence < REVEAL_STAGES.conclusion);
  assert.ok(REVEAL_STAGES.conclusion < REVEAL_STAGES.offer);
  assert.equal(
    isStageVisible(REVEAL_STAGES.conclusion, REVEAL_STAGES.offer),
    false,
  );
  assert.match(
    revealSource,
    /isStageVisible\(step, REVEAL_STAGES\.offer\) && \(/,
  );
  assert.match(revealSource, /!buyerFormVisible && \(/);
  assert.match(revealSource, /setBuyerFormVisible\(true\)/);
});

test("recovered audio contains Quina's first-person operational account", () => {
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
  assert.doesNotMatch(revealSource, /AGENTE \[IDENTIFICAÇÃO OMITIDA\]/);
  assert.doesNotMatch(revealSource, /INTERFERÊNCIA/);
  assert.doesNotMatch(revealSource, /Sinal do agente perdido/);
  assert.doesNotMatch(
    revealSource,
    /Nenhum registro da exploração direta foi recuperado/,
  );
});

test("containment, recovered image, conclusion, and offer follow the approved order", () => {
  const requiredCopy = [
    "Agente Quina não retornou",
    "porta do escritório já levava novamente ao corredor normal",
    "sonda de referência permanecia",
    "Agente Quina não estava no apartamento",
    "porta de entrada do apartamento abrindo",
    "Nenhuma pessoa foi identificada deixando o local",
    "ANEXO VISUAL RECUPERADO",
    "Investigação concluída",
    "continua ativa e não foi encerrada",
    "ECO-SP-001 foi liberado como avaliação inicial",
    "formando seu primeiro grupo de investigadores externos",
    "Um novo dossiê físico com documentos, evidências e uma investigação inédita",
  ];

  for (const copy of requiredCopy) assert.ok(revealText.includes(copy), copy);
  const containmentIndex = revealSource.indexOf("RELATÓRIO DE CONTENÇÃO");
  const evidenceIndex = revealSource.indexOf("ANEXO VISUAL RECUPERADO");
  const conclusionIndex = revealSource.indexOf("Investigação concluída");
  const invitationIndex = revealSource.indexOf(
    "ECO-SP-001 foi liberado como avaliação inicial",
  );
  const priceIndex = revealSource.indexOf("R$ 79,90");

  assert.ok(containmentIndex < evidenceIndex);
  assert.ok(evidenceIndex < conclusionIndex);
  assert.ok(conclusionIndex < invitationIndex);
  assert.ok(invitationIndex < priceIndex);
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
  assert.match(revealSource, /ANEXO VISUAL/);
  assert.doesNotMatch(revealSource, /imagem final/i);
});

test("the case public directory contains only the two approved assets", async () => {
  const publicCaseAssets = await readdir(
    new URL("../public/eco/eco-sp-001/", import.meta.url),
  );

  assert.deepEqual(publicCaseAssets.sort(), [
    "agent-field-record.png",
    "white-room-evidence.png",
  ]);
});

test("funnel events are scoped and deduplicated without answer or buyer data", () => {
  const events = [
    "eco_case_reveal_started",
    "eco_case_agent_report_viewed",
    "eco_case_white_room_viewed",
    "eco_case_conclusion_viewed",
    "eco_case_offer_viewed",
    "eco_case_offer_cta_clicked",
  ];

  for (const event of events) assert.ok(revealSource.includes(event), event);
  assert.match(revealSource, /case_id: "eco-sp-001"/);
  assert.match(revealSource, /sessionStorage\.getItem\(storageKey\)/);
  assert.doesNotMatch(revealSource, /canonicalAnswer|preparedPayload|postalCode/);
});
