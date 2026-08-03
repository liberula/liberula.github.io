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

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const revealSource = await read("app/eco/eco-sp-001/PostSolveReveal.tsx");
const answerSource = await read("app/eco/eco-sp-001/CaseAnswerForm.tsx");
const experienceSource = await read("app/eco/eco-sp-001/EcoCaseExperience.tsx");
const pageSource = await read("app/eco/eco-sp-001/page.tsx");
const apiSource = await read("supabase/functions/eco-sp-001-api/index.ts");
const purchaseSource = await read("app/eco/eco-sp-001/comprar/PurchaseExperience.tsx");
const revealText = revealSource.replace(/\s+/g, " ");

test("incorrect answers keep the current attempt flow and reveal nothing", () => {
  assert.match(answerSource, /if \(result\.correct\)/);
  assert.match(answerSource, /else \{\s*setState\("incorrect"\)/);
  assert.match(answerSource, /onCorrect\(\)/);
  assert.match(experienceSource, /if \(solved\)/);
  assert.match(experienceSource, /<CaseAnswerForm onCorrect=/);
  assert.match(pageSource, /<EcoCaseExperience \/>/);
  assert.doesNotMatch(answerSource, /Quina|porta vermelha|R\$ 79,90/);
});

test("backend decides correctness and the client reveals the location only after correct", () => {
  assert.match(apiSource, /return json\(200, \{ correct \}, origin\)/);
  assert.doesNotMatch(answerSource, /parseCaseResolution|invalid_resolution|result\.resolution/);
  assert.match(experienceSource, /if \(solved\)/);
  assert.match(revealSource, /Rua Benjamin Constant, 200/);
  assert.match(revealSource, /Sé — São Paulo/);
  assert.doesNotMatch(answerSource, /Benjamin Constant|Rua Benjamin|Sé — São Paulo/);
});

test("unlock and narrative stages are progressive with short reduced-motion waits", () => {
  assert.deepEqual(UNLOCK_STATUSES, [
    "CONCLUSÃO RECEBIDA",
    "CRUZANDO REGISTROS",
    "LOCAL CONFIRMADO",
    "ABRINDO ATUALIZAÇÃO OPERACIONAL",
  ]);
  assert.equal(getUnlockStatus(0), UNLOCK_STATUSES[0]);
  assert.equal(getUnlockStatus(99), UNLOCK_STATUSES.at(-1));
  const order = [
    REVEAL_STAGES.operation,
    REVEAL_STAGES.interior,
    REVEAL_STAGES.comparison,
    REVEAL_STAGES.transmission,
    REVEAL_STAGES.impossibleSpace,
    REVEAL_STAGES.closure,
    REVEAL_STAGES.evidence,
    REVEAL_STAGES.reclassification,
    REVEAL_STAGES.restricted,
    REVEAL_STAGES.offer,
  ];
  assert.ok(order.every((stage, index) => index === 0 || stage > order[index - 1]));
  assert.equal(isStageVisible(REVEAL_STAGES.reclassification, REVEAL_STAGES.offer), false);
  for (let step = 0; step < REVEAL_STAGES.offer; step += 1) {
    assert.ok(getRevealDelay(step, true) < getRevealDelay(step, false));
    assert.ok(getRevealDelay(step, true) <= 30);
  }
});

test("Quina physically enters the real central building and confirms it", () => {
  for (const copy of [
    "Após a confirmação do ponto final das rotas, o agente Quina foi enviado ao local",
    "entrada física ocorreu às 02h17 por um acesso de serviço",
    "estava na central real",
    "sequência de pontos intermediários",
    "central no fim da rota",
    "tinta descascando",
    "piso antigo",
    "salas desocupadas",
    "toda a central fosse um espaço sobrenatural",
  ]) assert.ok(revealText.includes(copy), copy);
});

test("Jonas and Quina records show the same point without and with the red door", () => {
  for (const copy of [
    "mesmo corredor, paredes, elementos laterais e perspectiva",
    "recuo, as marcas de batente",
    "não havia porta",
    "REGISTRO DE JONAS / SEM PORTA",
    "REGISTRO DE QUINA / PORTA VERMELHA",
    "Mesmo enquadramento",
    "porta vermelha ocupa exatamente o ponto vazio",
  ]) assert.ok(revealText.includes(copy), copy);
});

test("the immaculate red door opens to a non-Euclidean space", () => {
  for (const copy of [
    "vermelha, impecável, limpa e sem poeira, riscos ou desgaste",
    "nova demais",
    "profundidade maior que o edifício",
    "portas repetidas",
    "ângulos incoerentes",
    "luz sem fonte",
    "Isso não cabe dentro do prédio",
    "ESPAÇO NÃO EUCLIDIANO / VISÃO PARCIAL",
  ]) assert.ok(revealText.includes(copy), copy);
  assert.doesNotMatch(revealSource, /origem do espaço|natureza da porta é/iu);
});

test("Quina crosses, contact is lost, the door closes, and Jonas's wall returns", () => {
  for (const copy of [
    "02:17:42",
    "confirme o ponto registrado por Valença",
    "Valença não registrou nenhuma porta",
    "abrindo",
    "Quina atravessou",
    "sinal foi perdido",
    "A porta se fechou onze segundos após a passagem do agente",
    "parede registrada nas fotos de Jonas",
    "permanece desaparecido",
  ]) assert.ok(revealText.includes(copy), copy);
  assert.doesNotMatch(revealSource, /<audio|audio controls/i);
});

test("escape evidence remains explicitly ambiguous", () => {
  for (const copy of [
    "câmera externa registrou uma figura deixando o edifício",
    "Nenhuma entrada anterior correspondente foi registrada",
    "aparentemente carregava uma peça de roupa",
    "A figura não pode ser identificada",
    "parece corresponder a item associado a Lia Martins",
    "não confirma que a figura seja Lia",
  ]) assert.ok(revealText.includes(copy), copy);
  assert.doesNotMatch(revealSource, /Lia está viva|era Lia|criatura escapou|Quina voltou/iu);
});

test("unfinished visual assets are honest code placeholders", () => {
  assert.match(revealSource, /data-asset-status="placeholder"/);
  for (const label of [
    "INTERIOR DEGRADADO DA CENTRAL",
    "REGISTRO DE JONAS / SEM PORTA",
    "REGISTRO DE QUINA / PORTA VERMELHA",
    "PORTA VERMELHA IMPECÁVEL",
    "ESPAÇO NÃO EUCLIDIANO / VISÃO PARCIAL",
    "FRAME DA CÂMERA EXTERNA",
    "SILHUETA / PEÇA DE ROUPA",
  ]) assert.ok(revealSource.includes(label), label);
  assert.match(revealSource, /IMAGEM PENDENTE/);
});

test("reclassification ends the free story before restricted access and commerce", () => {
  const reclassification = revealSource.indexOf("INCIDENTE ECO-SP-001: RECLASSIFICADO");
  const restricted = revealSource.indexOf("Acesso ao dossiê completo");
  const offer = revealSource.indexOf("AUTORIZAÇÃO DE CONTINUIDADE");
  const price = revealSource.indexOf("R$ 79,90");
  assert.ok(reclassification >= 0 && reclassification < restricted);
  assert.ok(restricted < offer && offer < price);
  for (const copy of ["DESAPARECIDO", "FALHA", "AMEAÇA NÃO CONTIDA"]) {
    assert.ok(revealSource.includes(copy), copy);
  }
  assert.match(revealSource, /O registro gratuito termina sem determinar/);
});

test("paid continuation is framed as developing restricted material with a narrative CTA", () => {
  assert.match(revealSource, /MATERIAL RESTRITO \/ EDIÇÃO EM DESENVOLVIMENTO/);
  assert.match(revealSource, /Conteúdo e materiais sujeitos à conclusão editorial/);
  assert.match(revealSource, /CONTINUAR A INVESTIGAÇÃO/);
  assert.doesNotMatch(revealSource, /COMPRAR AGORA|FINALIZAR PEDIDO|IR PARA O CHECKOUT/);
  assert.match(revealSource, /href=\{buildPurchasePath\(referralCode\)\}/);
  assert.doesNotMatch(revealSource, /<BuyerForm/);
});

test("price, format, goal, deadline, delivery, failed-goal, and return terms are clear before payment", () => {
  for (const source of [revealSource, purchaseSource]) {
    for (const copy of [
      "R$ 79,90",
      "Dossiê físico",
      "100 investigadores",
      "31/08/2026",
      "15 dias após a confirmação da produção",
      "produção será cancelada",
      "devolvidos integralmente",
      "Direito de arrependimento em até 7 dias",
    ]) assert.ok(source.includes(copy), copy);
  }
});

test("existing and narrative-specific events contain no PII", () => {
  for (const event of [
    "eco_case_reveal_started",
    "eco_case_agent_report_viewed",
    "eco_case_white_room_viewed",
    "eco_case_quina_log_viewed",
    "eco_case_red_door_revealed",
    "eco_case_offer_viewed",
    "eco_case_offer_cta_clicked",
    "eco_purchase_cta_clicked",
    "eco_case_free_ending_completed",
  ]) assert.ok(revealSource.includes(event), event);
  assert.match(revealSource, /case_id: "eco-sp-001"/);
  assert.doesNotMatch(revealSource, /participant_email:|buyer_email:|answer:|location: resolution|region: resolution/);
});

test("the case public directory remains unchanged", async () => {
  const assets = await readdir(new URL("../public/eco/eco-sp-001/", import.meta.url));
  assert.deepEqual(assets.sort(), [
    "agent-field-record.png",
    "eco-sp-001-atalho.pdf",
    "white-room-evidence.png",
  ]);
});
