"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type RefObject } from "react";
import { FiArrowRight, FiCheck } from "react-icons/fi";
import { safePosthogCapture } from "../../analytics/posthog";
import BuyerForm from "./BuyerForm";
import {
  buildCampaignProgressEndpoint,
  ECO_CAMPAIGN_ID,
  parseCampaignProgress,
} from "./campaign-contract.mjs";
import ShareControls from "./ShareControls";
import {
  getRevealDelay,
  getUnlockStatus,
  isStageVisible,
  LAST_REVEAL_STEP,
  REVEAL_STAGES,
} from "./reveal-timeline.mjs";
import styles from "./EcoCase.module.css";

const ANALYTICS_PROPERTIES = { case_id: "eco-sp-001" };
const ECO_API_BASE_URL = process.env.NEXT_PUBLIC_ECO_API_BASE_URL;
const capturedEvents = new Set<string>();

function captureStageOnce(
  eventName: string,
  properties: Record<string, string | boolean> = {},
) {
  const storageKey = `eco-sp-001:${eventName}`;

  try {
    if (window.sessionStorage.getItem(storageKey)) return;
    window.sessionStorage.setItem(storageKey, "1");
  } catch {
    if (capturedEvents.has(eventName)) return;
    capturedEvents.add(eventName);
  }

  safePosthogCapture(eventName, {
    ...ANALYTICS_PROPERTIES,
    ...properties,
  });
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

function useViewedEvent<T extends HTMLElement>(
  eventName: string,
  enabled: boolean,
): RefObject<T> {
  const elementRef = useRef<T>(null);
  const capturedRef = useRef(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!enabled || !element || capturedRef.current) return;

    if (!("IntersectionObserver" in window)) {
      capturedRef.current = true;
      captureStageOnce(eventName);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || capturedRef.current) return;
        capturedRef.current = true;
        captureStageOnce(eventName);
        observer.disconnect();
      },
      { threshold: 0.35 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, eventName]);

  return elementRef;
}

type CampaignProgress = {
  campaignId: string;
  confirmed: number;
  target: number;
  goalReached: boolean;
  status: "collecting" | "goal_reached" | "closed";
  closesAt: string;
  displayPercent: number;
};

export default function PostSolveReveal({
  referralCode,
}: {
  referralCode: string | null;
}) {
  const [step, setStep] = useState(0);
  const [buyerFormVisible, setBuyerFormVisible] = useState(false);
  const [campaignPhase, setCampaignPhase] = useState<
    "loading" | "ready" | "failure"
  >("loading");
  const [campaign, setCampaign] = useState<CampaignProgress | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const confirmationHeadingRef = useRef<HTMLHeadingElement>(null);
  const buyerFormHeadingRef = useRef<HTMLHeadingElement>(null);
  const agentReportRef = useViewedEvent<HTMLElement>(
    "eco_case_agent_report_viewed",
    isStageVisible(step, REVEAL_STAGES.report),
  );
  const whiteRoomRef = useViewedEvent<HTMLElement>(
    "eco_case_white_room_viewed",
    isStageVisible(step, REVEAL_STAGES.evidence),
  );
  const conclusionRef = useViewedEvent<HTMLElement>(
    "eco_case_conclusion_viewed",
    isStageVisible(step, REVEAL_STAGES.conclusion),
  );
  const offerRef = useViewedEvent<HTMLElement>(
    "eco_case_offer_viewed",
    isStageVisible(step, REVEAL_STAGES.offer),
  );

  useEffect(() => {
    captureStageOnce("eco_case_reveal_started");
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
    if (buyerFormVisible) buyerFormHeadingRef.current?.focus();
  }, [buyerFormVisible]);

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

    let cancelled = false;
    let lastFetch = 0;
    const controller = new AbortController();

    async function loadProgress() {
      if (document.hidden || Date.now() - lastFetch < 30_000) return;
      lastFetch = Date.now();
      try {
        const response = await fetch(endpoint as string, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        const body: unknown = await response.json().catch(() => null);
        const parsed = response.ok ? parseCampaignProgress(body) : null;
        if (!parsed) throw new Error("campaign_progress_unavailable");
        if (cancelled) return;
        const nextCampaign = parsed as CampaignProgress;
        setCampaign(nextCampaign);
        setCampaignPhase("ready");
        captureStageOnce("eco_founder_progress_viewed", {
          campaign_id: ECO_CAMPAIGN_ID,
          campaign_state: nextCampaign.status,
        });
        if (nextCampaign.goalReached) {
          captureStageOnce("eco_founder_goal_reached_viewed", {
            campaign_id: ECO_CAMPAIGN_ID,
            campaign_state: nextCampaign.status,
          });
        }
      } catch (error) {
        if (
          cancelled ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }
        setCampaignPhase("failure");
        safePosthogCapture("eco_founder_progress_error", {
          case_id: "eco-sp-001",
          campaign_id: ECO_CAMPAIGN_ID,
        });
      }
    }

    const onFocus = () => void loadProgress();
    const interval = window.setInterval(() => void loadProgress(), 60_000);
    window.addEventListener("focus", onFocus);
    void loadProgress();

    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [step]);

  const inUnlockTransition = step < REVEAL_STAGES.report;

  return (
    <section className={styles.reveal} aria-labelledby="eco-case-success-title">
      <div className={styles.confirmation}>
        <span className={styles.statusLabel}>
          <FiCheck aria-hidden="true" /> ANÁLISE CONFIRMADA
        </span>
        <h1
          ref={confirmationHeadingRef}
          id="eco-case-success-title"
          tabIndex={-1}
        >
          Conclusão aceita.
        </h1>
        <p>Você identificou o local ligado à investigação de Jonas Valença.</p>
      </div>

      {inUnlockTransition && (
        <div className={styles.unlockTransition}>
          <span className={styles.scanLine} aria-hidden="true" />
          <p className={styles.unlockLabel} aria-live="polite" role="status">
            {getUnlockStatus(step)}
          </p>
          <span className={styles.progressTrack} aria-hidden="true">
            <span style={{ width: `${((step + 1) / 4) * 100}%` }} />
          </span>
        </div>
      )}

      {isStageVisible(step, REVEAL_STAGES.report) && (
        <section
          ref={agentReportRef}
          className={`${styles.revealSection} ${styles.fieldReport}`}
          aria-labelledby="eco-field-report-title"
        >
          <div className={styles.recordIdentity}>
            <figure className={styles.personnelRecord}>
              <Image
                src="/eco/eco-sp-001/agent-field-record.png"
                alt="Registro fotográfico operacional de Agente Quina, da equipe de reconhecimento da E.C.O."
                width={1122}
                height={1402}
                sizes="(max-width: 640px) calc(100vw - 72px), 300px"
              />
              <figcaption>IDENTIFICAÇÃO VISUAL / USO OPERACIONAL</figcaption>
            </figure>

            <header className={styles.recordHeader}>
              <p className={styles.protocol}>
                TRANSCRIÇÃO PARCIAL / ARQUIVO DE ÁUDIO RECUPERADO
              </p>
              <h2 id="eco-field-report-title">Áudio recuperado</h2>
              <div className={styles.identificationPlate}>
                <strong>ÁUDIO RECUPERADO</strong>
                <span>AGENTE QUINA</span>
                <span>EQUIPE DE RECONHECIMENTO</span>
              </div>
            </header>
          </div>
          <blockquote
            className={styles.transcript}
            aria-label="Transcrição parcial do áudio de Agente Quina"
          >
            <p>
              <span>AGENTE QUINA</span>
              Estou no escritório de Jonas Valença. A porta não está levando ao
              corredor esperado.
            </p>
            <p>
              <span>AGENTE QUINA</span>O ambiente do outro lado não corresponde
              a nenhuma parte da planta do imóvel. Pela profundidade aparente,
              este espaço não poderia existir dentro do edifício.
            </p>
            <p>
              <span>AGENTE QUINA</span>A iluminação disponível não alcança o
              final. O ambiente continua além do campo iluminado.
            </p>
            <p>
              <span>AGENTE QUINA</span>
              Vou deixar a sonda de referência na sala branca, deste lado da
              passagem. Ela deve permanecer como referência física no lado do
              apartamento e continuar transmitindo se a passagem se fechar.
            </p>
            <p>
              <span>AGENTE QUINA</span>
              Vou entrar na anomalia para uma inspeção direta. Iniciando
              travessia.
            </p>
          </blockquote>
        </section>
      )}

      {isStageVisible(step, REVEAL_STAGES.containment) && (
        <section
          className={`${styles.revealSection} ${styles.containmentReport}`}
          aria-labelledby="eco-containment-title"
        >
          <p className={styles.protocol}>RELATÓRIO DE CONTENÇÃO</p>
          <h2 id="eco-containment-title">Agente Quina não retornou</h2>
          <p>
            A equipe de contenção entrou posteriormente no apartamento de Jonas
            Valença. Quando chegou ao imóvel, a porta do escritório já levava
            novamente ao corredor normal.
          </p>
          <ul className={styles.findings}>
            <li>
              A sonda de referência permanecia no ponto em que Agente Quina a
              deixou.
            </li>
            <li>Agente Quina não estava no apartamento.</li>
            <li>
              A câmera externa registrou a porta de entrada do apartamento
              abrindo antes da chegada da equipe.
            </li>
            <li>Nenhuma pessoa foi identificada deixando o local.</li>
          </ul>
          <p className={styles.ambiguousNote}>
            As imagens não permitem determinar quem abriu a entrada nem o que
            ocorreu entre a abertura e a chegada da equipe.
          </p>
        </section>
      )}

      {isStageVisible(step, REVEAL_STAGES.evidence) && (
        <section
          ref={whiteRoomRef}
          className={`${styles.revealSection} ${styles.evidence}`}
          aria-labelledby="eco-white-room-title"
        >
          <div className={styles.evidenceHeading}>
            <p className={styles.protocol}>ANEXO VISUAL RECUPERADO</p>
            <h2 id="eco-white-room-title">
              Ambiente acessado a partir do escritório
            </h2>
          </div>
          <figure>
            <Image
              src="/eco/eco-sp-001/white-room-evidence.png"
              alt="Registro visual recuperado da sala branca acessada pela porta do escritório, parcialmente iluminada e sem limite observável."
              width={1448}
              height={1086}
              sizes="(max-width: 820px) calc(100vw - 28px), 1120px"
            />
            <figcaption>
              Anexo vinculado à transcrição do áudio de Agente Quina.
            </figcaption>
          </figure>
        </section>
      )}

      {isStageVisible(step, REVEAL_STAGES.conclusion) && (
        <section
          ref={conclusionRef}
          className={`${styles.revealSection} ${styles.caseConclusion}`}
          aria-labelledby="eco-conclusion-title"
        >
          <p className={styles.protocol}>CONCLUSÃO DO CASO PÚBLICO</p>
          <h2 id="eco-conclusion-title">Investigação concluída</h2>
          <p>O imóvel permanece sob observação.</p>
          <strong>A ocorrência continua ativa e não foi encerrada.</strong>
        </section>
      )}

      {isStageVisible(step, REVEAL_STAGES.offer) && (
        <section
          ref={offerRef}
          className={`${styles.revealSection} ${styles.invitation}`}
          aria-labelledby="eco-invitation-title"
        >
          <div className={styles.invitationIntro}>
            <p className={styles.protocol}>CONVOCAÇÃO / INVESTIGADORES EXTERNOS</p>
            <h2 id="eco-invitation-title">Investigadores externos</h2>
            <p>
              ECO-SP-001 foi liberado como avaliação inicial.
            </p>
            <p>
              Agora, a E.C.O. está formando seu primeiro grupo de investigadores
              externos.
            </p>
          </div>

          <div className={styles.nextCase}>
            <p className={styles.protocol}>PRÓXIMO CASO E.C.O.</p>
            <p>
              Um novo dossiê físico com documentos, evidências e uma
              investigação inédita.
            </p>
          </div>

          <div className={styles.offer} aria-labelledby="eco-founder-offer-title">
            <p className={styles.protocol}>LOTE FUNDADOR</p>
            <h3 id="eco-founder-offer-title">
              Próximo Caso E.C.O. | Lote Fundador
            </h3>
            <FounderProgress phase={campaignPhase} campaign={campaign} />
            <strong className={styles.price}>R$ 79,90</strong>
            <dl className={styles.offerFacts}>
              <div>
                <dt>Meta de produção</dt>
                <dd>100 investigadores</dd>
              </div>
              <div>
                <dt>Encerramento</dt>
                <dd>
                  <time dateTime="2026-08-31">31/08/2026</time>
                </dd>
              </div>
              <div>
                <dt>Entrega estimada</dt>
                <dd>15 dias</dd>
              </div>
            </dl>
          </div>

          {campaign?.status === "closed" ? (
            <div className={styles.campaignClosed}>
              <strong>LOTE FUNDADOR ENCERRADO</strong>
              <p>
                {campaign.goalReached
                  ? "A meta de produção foi atingida."
                  : "A campanha foi encerrada sem confirmação da meta de produção."}
              </p>
            </div>
          ) : (
            <>
              {!buyerFormVisible && (
                <button
                  className={styles.offerCta}
                  type="button"
                  onClick={() => {
                    captureStageOnce("eco_case_offer_cta_clicked");
                    setBuyerFormVisible(true);
                  }}
                >
                  QUERO PARTICIPAR DO LOTE FUNDADOR
                  <FiArrowRight aria-hidden="true" />
                </button>
              )}

              <ShareControls
                variant={
                  campaignPhase === "ready" && campaign
                    ? campaign.goalReached
                      ? "goal_reached"
                      : "collecting"
                    : "unknown"
                }
                campaignState={campaign?.status ?? null}
              />

              {buyerFormVisible && (
                <div className={styles.buyerFormReveal}>
                  <BuyerForm
                    headingRef={buyerFormHeadingRef}
                    referralCode={referralCode}
                  />
                </div>
              )}
            </>
          )}
        </section>
      )}
    </section>
  );
}

function FounderProgress({
  phase,
  campaign,
}: {
  phase: "loading" | "ready" | "failure";
  campaign: CampaignProgress | null;
}) {
  if (phase !== "ready" || !campaign) {
    return (
      <div className={styles.progressFallback}>
        <p>A campanha está em andamento.</p>
        {phase === "loading" && (
          <span className={styles.progressSkeleton} aria-hidden="true" />
        )}
      </div>
    );
  }

  if (campaign.status === "closed") {
    return null;
  }

  if (campaign.goalReached) {
    return (
      <div className={styles.founderProgress}>
        <strong>META DE PRODUÇÃO ATINGIDA</strong>
        <div
          className={styles.progressBar}
          role="img"
          aria-label="Meta de produção atingida"
        >
          <span style={{ width: "100%" }} />
        </div>
        <p>O lote fundador está confirmado.</p>
        <p>
          Novos investigadores ainda podem participar enquanto as inscrições
          estiverem abertas.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.founderProgress}>
      <strong>
        {campaign.confirmed} de {campaign.target} dossiês confirmados
      </strong>
      <div
        className={styles.progressBar}
        role="progressbar"
        aria-label={`${campaign.confirmed} de ${campaign.target} dossiês confirmados`}
        aria-valuemin={0}
        aria-valuemax={campaign.target}
        aria-valuenow={campaign.confirmed}
      >
        <span style={{ width: `${campaign.displayPercent}%` }} />
      </div>
      <p>
        A produção será confirmada quando o lote atingir 100 investigadores.
      </p>
    </div>
  );
}
