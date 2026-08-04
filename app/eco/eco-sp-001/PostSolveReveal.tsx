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
import {
  getRevealDelay,
  isStageVisible,
  LAST_REVEAL_STEP,
  REVEAL_STAGES,
} from "./reveal-timeline.mjs";
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

function useViewedEvents<T extends HTMLElement>(
  eventNames: readonly string[],
  enabled: boolean,
): RefObject<T> {
  const elementRef = useRef<T>(null);
  const capturedRef = useRef(false);
  const eventKey = eventNames.join("|");
  useEffect(() => {
    const element = elementRef.current;
    if (!enabled || !element || capturedRef.current) return;
    const capture = () => {
      capturedRef.current = true;
      for (const eventName of eventKey.split("|")) captureOnce(eventName);
    };
    if (!("IntersectionObserver" in window)) {
      capture();
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || capturedRef.current) return;
      capture();
      observer.disconnect();
    }, { threshold: 0.3 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, eventKey]);
  return elementRef;
}

function PendingAsset({
  assetId,
  ratio,
  caption,
  editorialDescription,
}: {
  assetId: string;
  ratio: string;
  caption: string;
  editorialDescription: string;
}) {
  return (
    <figure
      className={styles.narrativeAssetPending}
      data-asset-status="placeholder"
      data-asset-id={assetId}
      data-asset-ratio={ratio}
      data-editorial-description={editorialDescription}
    >
      <div style={{ aspectRatio: ratio.replace(":", " / ") }} aria-hidden="true">
        <span>REGISTRO VISUAL PENDENTE</span>
        <code>{assetId}</code>
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

function Transmission({
  label,
  entries,
}: {
  label: string;
  entries: readonly (readonly [string, string, string])[];
}) {
  return (
    <div className={styles.postSolveTransmission} role="log" aria-label={label}>
      {entries.map(([time, speaker, message]) => (
        <p key={`${time}-${speaker}-${message}`}>
          <time dateTime={time}>{time}</time>
          <strong>{speaker}</strong>
          <span>{message}</span>
        </p>
      ))}
    </div>
  );
}

const ENTRY_TRANSMISSION = [
  ["02:17:42", "CONTROLE", "Quina, confirme entrada."],
  ["02:17:46", "QUINA", "Entrada confirmada."],
  ["02:17:51", "CONTROLE", "Alguma anomalia visível?"],
  ["02:17:55", "QUINA", "Só a decoração, até agora."],
] as const;

const DOOR_TRANSMISSION = [
  ["02:20:14", "CONTROLE", "Quina?"],
  ["02:20:20", "QUINA", "Tem alguma coisa muito errada aqui."],
  ["02:20:29", "QUINA", "Estou no quarto do Valença."],
  ["02:20:36", "QUINA", "A porta do escritório está aberta."],
  ["02:20:40", "CONTROLE", "Valença não registrou nenhuma passagem."],
  ["02:20:55", "QUINA", "Isso não cabe dentro do prédio."],
] as const;

const FINAL_TRANSMISSION = [
  ["02:22:03", "CONTROLE", "Imagem recebida. Não avance."],
  ["02:22:07", "QUINA", "Tem outra porta no fim do corredor."],
  ["02:22:18", "CONTROLE", "Aguarde a equipe de apoio."],
  ["02:22:31", "QUINA", "Preciso chegar mais perto."],
  ["02:23:27", "CONTROLE", "Quina, confirme posição."],
  ["02:23:33", "QUINA", "Eu acho que isso sabia que eu estava aqui."],
  ["02:23:41", "SISTEMA", "SINAL INSTÁVEL"],
  ["02:23:50", "CONTROLE", "Quina?"],
  ["02:23:59", "SISTEMA", "SINAL PERDIDO"],
] as const;

export default function PostSolveReveal({ referralCode }: { referralCode: string | null }) {
  const [step, setStep] = useState(0);
  const [campaignPhase, setCampaignPhase] = useState<"loading" | "ready" | "failure">("loading");
  const [campaign, setCampaign] = useState<CampaignProgress | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const confirmationHeadingRef = useRef<HTMLHeadingElement>(null);
  const operationRef = useViewedEvents<HTMLElement>(
    ["eco_case_agent_report_viewed", "eco_case_report_released"],
    isStageVisible(step, REVEAL_STAGES.operation),
  );
  const comparisonRef = useViewedEvents<HTMLElement>(
    ["eco_case_white_room_viewed", "eco_case_photo_1_viewed"],
    isStageVisible(step, REVEAL_STAGES.comparison),
  );
  const passageRef = useViewedEvents<HTMLElement>(
    ["eco_case_quina_log_viewed", "eco_case_red_door_revealed", "eco_case_photo_2_viewed"],
    isStageVisible(step, REVEAL_STAGES.passage),
  );
  const endingRef = useViewedEvents<HTMLElement>(
    ["eco_case_free_ending_completed", "eco_case_report_completed"],
    isStageVisible(step, REVEAL_STAGES.cliffhanger),
  );
  const offerRef = useViewedEvents<HTMLElement>(
    ["eco_case_offer_viewed", "eco_case_liberula_note_viewed"],
    isStageVisible(step, REVEAL_STAGES.offer),
  );

  useEffect(() => {
    captureOnce("eco_case_reveal_started");
    confirmationHeadingRef.current?.focus();
  }, []);

  useEffect(() => {
    if (step >= LAST_REVEAL_STEP) return;
    const timeout = window.setTimeout(
      () => setStep((current) => Math.min(current + 1, LAST_REVEAL_STEP)),
      getRevealDelay(step, reducedMotion),
    );
    return () => window.clearTimeout(timeout);
  }, [reducedMotion, step]);

  useEffect(() => {
    if (!isStageVisible(step, REVEAL_STAGES.offer)) return;
    const endpoint = buildCampaignProgressEndpoint(ECO_API_BASE_URL);
    if (!endpoint) {
      setCampaignPhase("failure");
      safePosthogCapture("eco_founder_progress_error", {
        case_id: "eco-sp-001",
        campaign_id: ECO_CAMPAIGN_ID,
      });
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
        const nextCampaign = parsed as CampaignProgress;
        setCampaign(nextCampaign);
        setCampaignPhase("ready");
        captureOnce("eco_founder_progress_viewed", {
          campaign_id: ECO_CAMPAIGN_ID,
          campaign_state: nextCampaign.status,
        });
        if (nextCampaign.goalReached) {
          captureOnce("eco_founder_goal_reached_viewed", {
            campaign_id: ECO_CAMPAIGN_ID,
            campaign_state: nextCampaign.status,
          });
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setCampaignPhase("failure");
          safePosthogCapture("eco_founder_progress_error", {
            case_id: "eco-sp-001",
            campaign_id: ECO_CAMPAIGN_ID,
          });
        }
      }
    })();
    return () => controller.abort();
  }, [step]);

  return (
    <section className={styles.reveal} aria-labelledby="eco-case-success-title">
      <section className={styles.confirmation} aria-label="Local identificado">
        <span className={styles.statusLabel}><FiCheck aria-hidden="true" /> LOCAL IDENTIFICADO</span>
        <h1 ref={confirmationHeadingRef} id="eco-case-success-title" tabIndex={-1}>Rua Benjamin Constant, 200</h1>
        <p className={styles.resolutionRegion}>Sé, São Paulo</p>
        <p>Sua conclusão permitiu localizar o ponto final das rotas.</p>
        <p>A descoberta foi incorporada ao registro operacional ECO-SP-001.</p>
      </section>

      {step === 0 && (
        <p className={styles.documentReleaseStatus} role="status" aria-live="polite">
          ATUALIZAÇÃO OPERACIONAL RECEBIDA…
        </p>
      )}

      {isStageVisible(step, REVEAL_STAGES.operation) && (
        <section ref={operationRef} className={`${styles.postSolveStage} ${styles.postSolveOperation}`} aria-labelledby="eco-operation-title">
          <div className={styles.postSolveAgentGrid}>
            <figure className={styles.postSolveAgentRecord}>
              <Image
                src="/eco/eco-sp-001/agent-field-record.png"
                alt="Registro fotográfico operacional do agente Quina."
                width={1122}
                height={1402}
                sizes="(max-width: 720px) calc(100vw - 64px), 280px"
                priority
              />
              <figcaption>AGENTE QUINA / RECONHECIMENTO / 02h17</figcaption>
            </figure>
            <div>
              <p className={styles.protocol}>CONSEQUÊNCIA DA LOCALIZAÇÃO</p>
              <h2 id="eco-operation-title">Uma equipe pôde entrar.</h2>
              <p>A partir do endereço identificado por você, a E.C.O. confirmou a central e enviou o agente Quina para uma inspeção imediata.</p>
              <p>Ele entrou pelo acesso lateral. Placas técnicas, numeração e marcas do edifício correspondiam aos registros de Jonas Valença.</p>
              <Transmission label="Primeira transmissão do agente Quina" entries={ENTRY_TRANSMISSION} />
            </div>
          </div>
        </section>
      )}

      {isStageVisible(step, REVEAL_STAGES.comparison) && (
        <section ref={comparisonRef} className={styles.postSolveStage} aria-labelledby="eco-comparison-title">
          <p className={styles.protocol}>MESMO PONTO / DOIS REGISTROS</p>
          <h2 id="eco-comparison-title">No registro de Jonas, não havia passagem.</h2>
          <p className={styles.postSolveLead}>Quina alcançou o mesmo quarto, o mesmo enquadramento e a mesma porta de escritório. A arquitetura ao redor não havia mudado. O que existia depois dela, sim.</p>
          <div className={styles.postSolveComparison}>
            <PendingAsset
              assetId="eco-sp-001-postsolve-jonas-threshold"
              ratio="16:10"
              caption="REGISTRO DE JONAS / ponto correspondente, sem passagem funcional."
              editorialDescription="Mesmo enquadramento do registro de Quina; quarto degradado; porta do escritório fechada ou abertura sem ativação; nenhuma anomalia visível."
            />
            <figure className={styles.postSolveEvidence} data-asset-status="final" data-asset-id="white-room-evidence">
              <Image
                src="/eco/eco-sp-001/white-room-evidence.png"
                alt="Registro do quarto de Jonas com uma passagem aberta para um corredor branco de profundidade incompatível."
                width={1450}
                height={1088}
                sizes="(max-width: 720px) calc(100vw - 64px), 460px"
              />
              <figcaption>REGISTRO DE QUINA / passagem ativa no mesmo ponto.</figcaption>
            </figure>
          </div>
          <Transmission label="Transmissão diante da passagem" entries={DOOR_TRANSMISSION} />
        </section>
      )}

      {isStageVisible(step, REVEAL_STAGES.passage) && (
        <section ref={passageRef} className={`${styles.postSolveStage} ${styles.postSolvePassage}`} aria-labelledby="eco-passage-title">
          <p className={styles.protocol}>REGISTRO AUTOMÁTICO / CANAL INSTÁVEL</p>
          <h2 id="eco-passage-title">A profundidade excedia os limites do prédio.</h2>
          <p className={styles.postSolveLead}>Portas de épocas diferentes, escadas sem continuidade e corredores ligados em ângulos incompatíveis apareciam além da entrada. Quina montou a câmera e avançou.</p>
          <PendingAsset
            assetId="eco-sp-001-postsolve-quina-final-record"
            ratio="16:9"
            caption="ÚLTIMO REGISTRO INTEGRAL / Quina diante de uma segunda porta."
            editorialDescription="Quina pequeno e de costas diante da passagem; arquitetura impossível; superfície reflexiva plausível com presença extremamente sutil, sem marcação, zoom ou contraste artificial."
          />
          <Transmission label="Última transmissão do agente Quina" entries={FINAL_TRANSMISSION} />
        </section>
      )}

      {isStageVisible(step, REVEAL_STAGES.interruption) && (
        <section className={styles.signalInterruption} aria-labelledby="eco-signal-title">
          <p className={styles.protocol}>02h24:03 / TRANSMISSÃO ENCERRADA</p>
          <h2 id="eco-signal-title">Quina não respondeu.</h2>
          <span aria-hidden="true" />
          <p>A equipe de apoio confirmou a anomalia no local.</p>
          <p>O agente não foi encontrado.</p>
        </section>
      )}

      {isStageVisible(step, REVEAL_STAGES.cliffhanger) && (
        <section ref={endingRef} className={styles.postSolveCliffhanger} aria-labelledby="eco-cliffhanger-title">
          <p className={styles.protocol}>INCIDENTE ECO-SP-001 / RECLASSIFICADO</p>
          <h2 id="eco-cliffhanger-title">QUINA NÃO RETORNOU.</h2>
          <p>O ponto foi isolado. Os últimos registros permanecem incompletos.</p>
          <dl>
            <div><dt>Anomalia</dt><dd>LOCALIZADA</dd></div>
            <div><dt>Agente Quina</dt><dd>STATUS DESCONHECIDO</dd></div>
            <div><dt>Novos agentes</dt><dd>REQUERIDOS</dd></div>
          </dl>
        </section>
      )}

      {isStageVisible(step, REVEAL_STAGES.offer) && (
        <section ref={offerRef} className={styles.liberulaNote} aria-labelledby="liberula-note-title">
          <div className={styles.liberulaNoteBrand}>
            <Image src="/eco/liberula-mark.svg" width={44} height={44} alt="" aria-hidden="true" />
            <span>LIBERULA</span>
          </div>
          <p className={styles.liberulaEyebrow}>AGORA, FORA DA FICÇÃO</p>
          <h2 id="liberula-note-title">A investigação gratuita termina aqui.</h2>
          <p>A E.C.O. é um projeto narrativo independente em produção. A continuação será uma nova missão digital, criada se a campanha confirmar que existem agentes suficientes para viabilizá-la.</p>
          <p>O acesso aos próximos registros não será gratuito. Quem entrar agora participa como agente fundador e ajuda a tornar a próxima operação possível.</p>
          <FounderProgress phase={campaignPhase} campaign={campaign} />
          <dl className={styles.digitalCampaignFacts}>
            <div><dt>Valor fundador</dt><dd>R$ 29,90</dd></div>
            <div><dt>Meta</dt><dd>100 agentes</dd></div>
            <div><dt>Formato</dt><dd>Próxima missão digital</dd></div>
            <div><dt>Estado</dt><dd>Produção condicionada à campanha</dd></div>
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
                QUERO SER UM AGENTE <FiArrowRight aria-hidden="true" />
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
      )}
    </section>
  );
}
