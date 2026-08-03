import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import {
  getReportReleaseDelay,
  REPORT_RELEASE_DELAY_MS,
} from "../app/eco/eco-sp-001/reveal-timeline.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const reveal = await read("app/eco/eco-sp-001/PostSolveReveal.tsx");
const answer = await read("app/eco/eco-sp-001/CaseAnswerForm.tsx");
const experience = await read("app/eco/eco-sp-001/EcoCaseExperience.tsx");
const purchase = await read("app/eco/eco-sp-001/comprar/PurchaseExperience.tsx");
const css = await read("app/eco/eco-sp-001/EcoCase.module.css");
const normalized = reveal.replace(/\s+/g, " ");

test("correct answers release one operational report after a short transition", () => {
  assert.match(answer, /if \(result\.correct\)/);
  assert.match(answer, /onCorrect\(\)/);
  assert.match(experience, /if \(solved\)/);
  assert.match(reveal, /<article className=\{styles\.reportDocument\}/);
  assert.equal((reveal.match(/className=\{styles\.reportDocument\}/g) ?? []).length, 1);
  assert.equal(REPORT_RELEASE_DELAY_MS, 420);
  assert.equal(getReportReleaseDelay(true), 0);
  assert.ok(getReportReleaseDelay(false) < 1000);
  assert.doesNotMatch(reveal, /REVEAL_STAGES|LAST_REVEAL_STEP|isStageVisible/);
});

test("confirmation is brief and authorizes the report", () => {
  for (const copy of [
    "LOCAL IDENTIFICADO",
    "Rua Benjamin Constant, 200",
    "Sé, São Paulo",
    "A conclusão foi incorporada ao registro ECO-SP-001",
    "Um relatório posterior à avaliação foi autorizado para consulta",
  ]) assert.ok(normalized.includes(copy), copy);
});

test("report header and operational metadata are complete", () => {
  for (const copy of [
    "RELATÓRIO DE RECONHECIMENTO OPERACIONAL",
    "ECO-SP-001",
    "Inspeção do ponto de convergência",
    "Agente de campo",
    "Contato interrompido",
    "Restrito",
  ]) assert.ok(normalized.includes(copy), copy);
});

test("core Quina dialogue and anomaly discovery are preserved", () => {
  for (const copy of [
    "Só a decoração, até agora.",
    "Sempre mantenho.",
    "Tem alguma coisa muito errada aqui.",
    "A porta do escritório está levando para um lugar que não está dentro do prédio.",
    "Isso é incrível.",
    "Eu preciso abrir essa porta.",
    "Eu acho que isso sabia que eu estava aqui.",
  ]) assert.ok(normalized.includes(copy), copy);
});

test("the anomaly remains confirmed and isolated after Quina disappears", () => {
  for (const copy of [
    "confirmou a presença da anomalia de acesso",
    "O agente não foi encontrado",
    "O ponto foi isolado pela E.C.O. e permanece sob monitoramento",
    "O agente Quina permanece desaparecido",
    "segue sob monitoramento contínuo",
  ]) assert.ok(normalized.includes(copy), copy);
  assert.doesNotMatch(reveal, /havia apenas (uma|a) parede|anomalia desapareceu/iu);
});

test("final states are operational, not gamified", () => {
  for (const [label, state] of [
    ["ENCONTRAR", "concluído"],
    ["CONTER", "em andamento"],
    ["OCULTAR", "ativo"],
  ]) {
    assert.match(normalized, new RegExp(`<dt>${label}</dt><dd>${state}</dd>`));
  }
  assert.match(css, /\.operationalStates/);
});

test("exactly two honest photo placeholders preserve editorial contracts", () => {
  assert.equal((reveal.match(/<PhotoPlaceholder/g) ?? []).length, 2);
  for (const [id, ratio] of [
    ["eco-sp-001-postsolve-room-threshold", "16:10"],
    ["eco-sp-001-postsolve-quina-final-record", "16:9"],
  ]) {
    assert.ok(reveal.includes(`assetId="${id}"`), id);
    assert.ok(reveal.includes(`ratio="${ratio}"`), ratio);
  }
  assert.match(reveal, /data-asset-status="placeholder"/);
  assert.match(reveal, /data-editorial-description=/);
  assert.match(reveal, /ANEXO FOTOGRÁFICO PENDENTE/);
});

test("Liberula note breaks the fourth wall only after the document", () => {
  const reportEnd = reveal.indexOf("</article>");
  const note = reveal.indexOf("UMA NOTA DA LIBERULA");
  assert.ok(reportEnd >= 0 && reportEnd < note);
  assert.match(reveal, /\/eco\/liberula-mark\.svg/);
  assert.match(css, /\.liberulaNote[\s\S]*#f2cb32/);
  assert.match(reveal, /FORA DO ARQUIVO E\.C\.O\./);
});

test("offer is digital, transparent, and contains no physical promise", () => {
  for (const source of [reveal, purchase]) {
    for (const copy of [
      "R$ 49,90",
      "100 participantes",
      "90 dias após a meta",
      "reembolso integral",
      "história ainda não foi anunciada",
    ]) assert.ok(
      source.toLocaleLowerCase("pt-BR").includes(copy.toLocaleLowerCase("pt-BR")),
      copy,
    );
  assert.doesNotMatch(source, /dossiê físico|materiais físicos|edição física|apoios pontuais/iu);
  }
  assert.match(reveal, /FINANCIAR A PRÓXIMA MISSÃO/);
  assert.match(reveal, /href=\{buildPurchasePath\(referralCode\)\}/);
});

test("hints are progressive, confirmed, session-preserved, and independently tracked", () => {
  for (const hint of [
    "Compare os pontos intermediários registrados em cada uma das três ocorrências.",
    "No mapa, observe a direção seguida por cada rota depois do último ponto confirmado.",
    "As três rotas convergem na região da Sé, próximas à Rua Benjamin Constant.",
  ]) assert.ok(answer.includes(hint), hint);
  assert.match(answer, /HINTS\.slice\(0, hintLevel\)/);
  assert.match(answer, /confirmingHint/);
  assert.match(answer, /sessionStorage\.setItem\(HINT_STORAGE_KEY/);
  assert.match(answer, /eco_case_hint_used/);
  assert.match(answer, /hint_level: nextLevel/);
});

test("report, images, ending, note, and financing analytics contain no answer or PII", () => {
  for (const event of [
    "eco_case_report_released",
    "eco_case_photo_1_viewed",
    "eco_case_photo_2_viewed",
    "eco_case_report_completed",
    "eco_case_liberula_note_viewed",
    "eco_case_financing_clicked",
  ]) assert.ok(reveal.includes(event), event);
  assert.doesNotMatch(reveal, /answer:|buyer_email:|participant_email:/);
});

test("no new case image asset was added", async () => {
  const assets = await readdir(new URL("../public/eco/eco-sp-001/", import.meta.url));
  assert.deepEqual(assets.sort(), [
    "agent-field-record.png",
    "eco-sp-001-atalho.pdf",
    "white-room-evidence.png",
  ]);
});
