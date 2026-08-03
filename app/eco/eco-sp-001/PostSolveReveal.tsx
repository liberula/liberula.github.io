"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type RefObject } from "react";
import { FiArrowRight, FiCheck, FiInstagram } from "react-icons/fi";
import { safePosthogCapture } from "../../analytics/posthog";
import {
  buildCampaignProgressEndpoint,
  buildPurchasePath,
  ECO_CAMPAIGN_ID,
  parseCampaignProgress,
} from "./campaign-contract.mjs";
import FounderProgress, { type CampaignProgress } from "./FounderProgress";
import ShareControls from "./ShareControls";
import { getReportReleaseDelay } from "./reveal-timeline.mjs";
import styles from "./EcoCase.module.css";

const ANALYTICS_PROPERTIES = { case_id: "eco-sp-001" };
const ECO_API_BASE_URL = process.env.NEXT_PUBLIC_ECO_API_BASE_URL;
const capturedEvents = new Set<string>();

function configuredInstagramUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !["instagram.com", "www.instagram.com"].includes(url.hostname)
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}

const ECO_INSTAGRAM_URL = configuredInstagramUrl(
  process.env.NEXT_PUBLIC_ECO_INSTAGRAM_URL,
);

function captureOnce(
  eventName: string,
  properties: Record<string, string | boolean | number> = {},
) {
  const storageKey = `eco-sp-001:${eventName}`;
  try {
    if (window.sessionStorage.getItem(storageKey)) return;
    window.sessionStorage.setItem(storageKey, "1");
  } catch {
    if (capturedEvents.has(eventName)) return;
    capturedEvents.add(eventName);
  }
  safePosthogCapture(eventName, { ...ANALYTICS_PROPERTIES, ...properties });
}

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener?.("change", updatePreference);
    return () => media.removeEventListener?.("change", updatePreference);
  }, []);
  return reducedMotion;
}

function useViewedEvent<T extends HTMLElement>(eventName: string): RefObject<T> {
  const elementRef = useRef<T>(null);
  const capturedRef = useRef(false);
  useEffect(() => {
    const element = elementRef.current;
    if (!element || capturedRef.current) return;
    if (!("IntersectionObserver" in window)) {
      capturedRef.current = true;
      captureOnce(eventName);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || capturedRef.current) return;
      capturedRef.current = true;
      captureOnce(eventName);
      observer.disconnect();
    }, { threshold: 0.3 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [eventName]);
  return elementRef;
}

function PhotoPlaceholder({
  assetId,
  ratio,
  caption,
  editorialDescription,
  viewedEvent,
}: {
  assetId: string;
  ratio: string;
  caption: string;
  editorialDescription: string;
  viewedEvent: string;
}) {
  const placeholderRef = useViewedEvent<HTMLElement>(viewedEvent);
  return (
    <figure
      ref={placeholderRef}
      className={styles.reportPhotoPlaceholder}
      data-asset-status="placeholder"
      data-asset-id={assetId}
      data-asset-ratio={ratio}
      data-editorial-description={editorialDescription}
    >
      <div style={{ aspectRatio: ratio.replace(":", " / ") }} aria-hidden="true">
        <span>ANEXO FOTOGRÁFICO PENDENTE</span>
        <code>{assetId}</code>
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

const RADIO_ENTRIES = {
  entry: [
    ["02:17:42", "CONTROLE", "Quina, confirme entrada."],
    ["02:17:46", "QUINA", "Entrada confirmada."],
    ["02:17:51", "CONTROLE", "Alguma anomalia visível?"],
    ["02:17:55", "QUINA", "Só a decoração, até agora."],
    ["02:18:02", "CONTROLE", "Mantenha o canal aberto."],
    ["02:18:05", "QUINA", "Sempre mantenho."],
  ],
  room: [
    ["02:20:14", "CONTROLE", "Quina?"],
    ["02:20:20", "QUINA", "Tem alguma coisa muito errada aqui."],
    ["02:20:23", "CONTROLE", "Descreva."],
    ["02:20:29", "QUINA", "Estou no quarto do Valença."],
    ["02:20:32", "CONTROLE", "Confirmado."],
    ["02:20:36", "QUINA", "A porta do escritório está aberta."],
    ["02:20:40", "CONTROLE", "O cômodo foi removido durante a vistoria."],
    ["02:20:44", "QUINA", "Não estou vendo um cômodo."],
    ["02:20:48", "CONTROLE", "Então o que está vendo?"],
    ["02:20:55", "QUINA", "A porta do escritório está levando para um lugar que não está dentro do prédio."],
    ["02:21:11", "CONTROLE", "Registre uma imagem para o arquivo."],
    ["02:21:15", "QUINA", "Vou montar o equipamento."],
  ],
  inspection: [
    ["02:22:03", "CONTROLE", "Imagem recebida. Não avance."],
    ["02:22:07", "QUINA", "Estou vendo uma saída no fim do corredor."],
    ["02:22:10", "CONTROLE", "Uma saída para onde?"],
    ["02:22:14", "QUINA", "Não sei."],
    ["02:22:18", "CONTROLE", "Quina, aguarde a equipe de apoio."],
    ["02:22:22", "QUINA", "Tem alguma coisa escrita na porta."],
    ["02:22:25", "CONTROLE", "Não se aproxime."],
    ["02:22:31", "QUINA", "Eu só preciso chegar perto o suficiente para registrar."],
    ["02:22:34", "CONTROLE", "Negativo. Você está sozinho."],
    ["02:22:49", "QUINA", "Isso é incrível."],
    ["02:22:53", "CONTROLE", "Quina, retorne ao quarto."],
    ["02:22:58", "QUINA", "Preciso documentar isso."],
    ["02:23:01", "CONTROLE", "O equipamento já está registrando."],
    ["02:23:07", "QUINA", "Não. Não é suficiente."],
    ["02:23:10", "CONTROLE", "Quina, recue agora."],
    ["02:23:16", "QUINA", "Eu preciso abrir essa porta."],
    ["02:23:19", "CONTROLE", "Não abra a porta."],
  ],
  interruption: [
    ["02:23:27", "CONTROLE", "Quina, confirme posição."],
    ["02:23:33", "QUINA", "Eu acho que isso sabia que eu estava aqui."],
    ["02:23:36", "CONTROLE", "Repita."],
    ["02:23:50", "CONTROLE", "Quina?"],
    ["02:23:54", "CONTROLE", "Quina, responda."],
    ["02:23:59", "CONTROLE", "Equipe de apoio autorizada. Não interrompam o canal."],
  ],
} as const;

function RadioTranscript({ entries }: { entries: readonly (readonly [string, string, string])[] }) {
  return (
    <div className={styles.reportTranscript} role="log" aria-label="Transcrição do canal operacional">
      {entries.map(([time, speaker, message]) => (
        <p key={`${time}-${speaker}`}>
          <time dateTime={time}>{time}</time>
          <strong>{speaker}</strong>
          <span>{message}</span>
        </p>
      ))}
    </div>
  );
}

export default function PostSolveReveal({ referralCode }: { referralCode: string | null }) {
  const [reportVisible, setReportVisible] = useState(false);
  const [campaignPhase, setCampaignPhase] = useState<"loading" | "ready" | "failure">("loading");
  const [campaign, setCampaign] = useState<CampaignProgress | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const confirmationHeadingRef = useRef<HTMLHeadingElement>(null);
  const reportEndRef = useViewedEvent<HTMLElement>("eco_case_report_completed");
  const noteRef = useViewedEvent<HTMLElement>("eco_case_liberula_note_viewed");

  useEffect(() => {
    captureOnce("eco_case_reveal_started");
    confirmationHeadingRef.current?.focus();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setReportVisible(true);
      captureOnce("eco_case_report_released");
    }, getReportReleaseDelay(reducedMotion));
    return () => window.clearTimeout(timeout);
  }, [reducedMotion]);

  useEffect(() => {
    if (!reportVisible) return;
    const endpoint = buildCampaignProgressEndpoint(ECO_API_BASE_URL);
    if (!endpoint) {
      setCampaignPhase("failure");
      return;
    }
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(endpoint, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        const body: unknown = await response.json().catch(() => null);
        const parsed = response.ok ? parseCampaignProgress(body) : null;
        if (!parsed) throw new Error("campaign_unavailable");
        setCampaign(parsed as CampaignProgress);
        setCampaignPhase("ready");
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setCampaignPhase("failure");
        }
      }
    })();
    return () => controller.abort();
  }, [reportVisible]);

  return (
    <section className={styles.reveal} aria-labelledby="eco-case-success-title">
      <section className={styles.confirmation} aria-label="Local identificado">
        <span className={styles.statusLabel}><FiCheck aria-hidden="true" /> LOCAL IDENTIFICADO</span>
        <h1 ref={confirmationHeadingRef} id="eco-case-success-title" tabIndex={-1}>Rua Benjamin Constant, 200</h1>
        <p className={styles.resolutionRegion}>Sé, São Paulo</p>
        <p>A conclusão foi incorporada ao registro ECO-SP-001.</p>
        <p>Um relatório posterior à avaliação foi autorizado para consulta.</p>
      </section>

      {!reportVisible && (
        <p className={styles.documentReleaseStatus} role="status" aria-live="polite">
          LIBERANDO DOCUMENTO OPERACIONAL…
        </p>
      )}

      {reportVisible && (
        <>
          <article className={styles.reportDocument} aria-labelledby="eco-report-title">
            <header className={styles.reportHeader}>
              <div className={styles.reportAgency}><span>E.C.O.</span><small>ENCONTRAR. CONTER. OCULTAR.</small></div>
              <p>DOCUMENTO OPERACIONAL / ACESSO RESTRITO</p>
              <h2 id="eco-report-title">RELATÓRIO DE RECONHECIMENTO OPERACIONAL</h2>
              <dl className={styles.reportMetadata}>
                <div><dt>Referência</dt><dd>ECO-SP-001</dd></div>
                <div><dt>Operação</dt><dd>Inspeção do ponto de convergência</dd></div>
                <div><dt>Agente de campo</dt><dd>Quina</dd></div>
                <div><dt>Status</dt><dd>Contato interrompido</dd></div>
                <div><dt>Classificação</dt><dd>Restrito</dd></div>
              </dl>
            </header>

            <section className={styles.reportSection} aria-labelledby="report-entry-title">
              <p className={styles.reportSectionNumber}>01</p>
              <h3 id="report-entry-title">Entrada no imóvel</h3>
              <p>Após a identificação do ponto final das rotas investigadas por Jonas Valença, o agente Quina foi enviado ao endereço para uma inspeção preliminar.</p>
              <p>A entrada ocorreu às 02h17 por um acesso lateral já comprometido pela equipe de reconhecimento.</p>
              <p>O imóvel permanecia parcialmente abandonado. Não havia sinais recentes de ocupação nas áreas de circulação, embora parte da rede elétrica continuasse ativa.</p>
              <RadioTranscript entries={RADIO_ENTRIES.entry} />
              <p>Quina avançou até o antigo apartamento de Jonas Valença. A porta principal estava destrancada. O interior havia sido esvaziado após o desaparecimento, mas ainda continha marcas da ocupação anterior e parte da instalação elétrica utilizada por Valença.</p>
            </section>

            <section className={styles.reportSection} aria-labelledby="report-room-title">
              <p className={styles.reportSectionNumber}>02</p>
              <h3 id="report-room-title">Quarto de Jonas Valença</h3>
              <p>Quina entrou no quarto onde os registros pessoais de Jonas haviam sido encontrados.</p>
              <p>Segundo a planta recuperada, a porta do escritório deveria levar a um cômodo pequeno, delimitado pela parede externa do edifício.</p>
              <p>A transmissão permaneceu silenciosa por onze segundos.</p>
              <RadioTranscript entries={RADIO_ENTRIES.room} />
              <p>O agente descreveu um corredor extenso, com paredes deterioradas, divisórias antigas e iluminação irregular. A profundidade observada era incompatível com as dimensões externas do imóvel.</p>
              <p>Também foram relatadas portas laterais em intervalos irregulares e mudanças de direção que não correspondiam à planta.</p>
              <PhotoPlaceholder
                assetId="eco-sp-001-postsolve-room-threshold"
                ratio="16:10"
                viewedEvent="eco_case_photo_1_viewed"
                caption="Vista do quarto de Jonas Valença através da porta anteriormente associada ao escritório. A profundidade registrada excede os limites conhecidos do imóvel."
                editorialDescription="Enquadramento a partir do quarto; porta aberta; começo do ambiente impossível; ainda sem Quina; corredor antigo, abandonado e plausível à primeira vista; nada monstruoso claramente visível."
              />
            </section>

            <section className={styles.reportSection} aria-labelledby="report-passage-title">
              <p className={styles.reportSectionNumber}>03</p>
              <h3 id="report-passage-title">Inspeção da passagem</h3>
              <p>Após montar o equipamento de registro automático, Quina aproximou-se da entrada.</p>
              <p>O controle determinou que ele aguardasse a chegada de uma segunda equipe.</p>
              <RadioTranscript entries={RADIO_ENTRIES.inspection} />
              <p>Quina atravessou a entrada antes que a ordem pudesse ser reiterada.</p>
              <p>Nos segundos seguintes, o agente demonstrou alteração progressiva no padrão de resposta. Sua fala tornou-se menos objetiva e deixou de reconhecer parte das instruções do controle.</p>
              <PhotoPlaceholder
                assetId="eco-sp-001-postsolve-quina-final-record"
                ratio="16:9"
                viewedEvent="eco_case_photo_2_viewed"
                caption="Último registro integral transmitido pelo equipamento automático."
                editorialDescription="Espaço impossível mais profundo; Quina pequeno e de costas diante de uma segunda porta; captura pelo equipamento deixado para trás; arquitetura incoerente; superfície reflexiva plausível sem círculos ou marcações."
              />
            </section>

            <section className={styles.reportSection} aria-labelledby="report-interruption-title">
              <p className={styles.reportSectionNumber}>04</p>
              <h3 id="report-interruption-title">Interrupção</h3>
              <RadioTranscript entries={RADIO_ENTRIES.interruption} />
              <p><strong>Sem resposta.</strong></p>
              <p>O registro visual mostra Quina avançando além da segunda porta.</p>
              <p>Às 02h23:41, a porta se fechou.</p>
              <p>O agente não aparece tocando nela.</p>
              <p>O canal permaneceu aberto por mais nove segundos. Foram registrados apenas interferência e um ruído de impacto sem origem identificada.</p>
              <p>A transmissão foi encerrada às 02h24:03.</p>
              <p>A equipe de apoio enviada ao imóvel confirmou a presença da anomalia de acesso relatada por Quina.</p>
              <p>O agente não foi encontrado.</p>
              <p>O ponto foi isolado pela E.C.O. e permanece sob monitoramento.</p>
            </section>

            <footer ref={reportEndRef} className={styles.reportSituation}>
              <p className={styles.protocol}>SITUAÇÃO ATUAL</p>
              <p>A anomalia de acesso relatada por Jonas Valença e confirmada pelo agente Quina foi localizada pela E.C.O. no imóvel investigado.</p>
              <p>O agente Quina permanece desaparecido.</p>
              <p>O ponto foi isolado e segue sob monitoramento contínuo.</p>
              <dl className={styles.operationalStates}>
                <div><dt>ENCONTRAR</dt><dd>concluído</dd></div>
                <div><dt>CONTER</dt><dd>em andamento</dd></div>
                <div><dt>OCULTAR</dt><dd>ativo</dd></div>
              </dl>
            </footer>
          </article>

          <section ref={noteRef} className={styles.liberulaNote} aria-labelledby="liberula-note-title">
            <div className={styles.liberulaNoteBrand}>
              <Image src="/eco/liberula-mark.svg" width={44} height={44} alt="" aria-hidden="true" />
              <span>LIBERULA</span>
            </div>
            <p className={styles.liberulaEyebrow}>FORA DO ARQUIVO E.C.O.</p>
            <h2 id="liberula-note-title">UMA NOTA DA LIBERULA</h2>
            <p>Você chegou ao fim do caso introdutório da E.C.O.</p>
            <p>Esta é uma experiência narrativa independente criada pela Liberula.</p>
            <p>Produzir uma investigação completa exige semanas de roteiro, arte, desenvolvimento e testes. Por isso, a próxima missão só será criada se pelo menos 100 pessoas reservarem acesso.</p>
            <p>A próxima missão será uma experiência digital inédita, com documentos, fotografias, registros interativos, sistema de pistas, conclusão verificável e epílogo completo.</p>
            <FounderProgress phase={campaignPhase} campaign={campaign} />
            <dl className={styles.digitalCampaignFacts}>
              <div><dt>Preço fundador</dt><dd>R$ 49,90</dd></div>
              <div><dt>Meta</dt><dd>100 participantes</dd></div>
              <div><dt>Prazo de entrega</dt><dd>Até 90 dias após a meta ser atingida</dd></div>
              <div><dt>Se a meta não for atingida</dt><dd>Reembolso integral</dd></div>
            </dl>
            <p className={styles.transparentCampaignNote}><strong>A próxima história ainda não foi anunciada.</strong> A reserva financia sua criação.</p>

            {campaign?.status === "closed" ? (
              <div className={styles.campaignClosed}>
                <strong>CAMPANHA ENCERRADA</strong>
                <p>{campaign.goalReached ? "A meta foi atingida e a próxima missão foi autorizada." : "A meta não foi atingida; os valores pagos serão reembolsados integralmente."}</p>
              </div>
            ) : (
              <>
                <Link
                  className={styles.liberulaCta}
                  href={buildPurchasePath(referralCode)}
                  onClick={() => {
                    captureOnce("eco_case_financing_clicked", {
                      campaign_state: campaign?.status ?? "unknown",
                      has_referral: Boolean(referralCode),
                    });
                    captureOnce("eco_case_offer_cta_clicked");
                    safePosthogCapture("eco_purchase_cta_clicked", {
                      case_id: "eco-sp-001",
                      campaign_state: campaign?.status ?? "unknown",
                      has_referral: Boolean(referralCode),
                    });
                  }}
                >
                  FINANCIAR A PRÓXIMA MISSÃO <FiArrowRight aria-hidden="true" />
                </Link>
                <ShareControls
                  variant={campaignPhase === "ready" && campaign ? campaign.goalReached ? "goal_reached" : "collecting" : "unknown"}
                  campaignState={campaign?.status ?? null}
                />
              </>
            )}

            {ECO_INSTAGRAM_URL && (
              <a className={styles.instagramLink} href={ECO_INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
                <FiInstagram aria-hidden="true" /> Acompanhar a comunidade E.C.O. no Instagram
              </a>
            )}
          </section>
        </>
      )}
    </section>
  );
}
