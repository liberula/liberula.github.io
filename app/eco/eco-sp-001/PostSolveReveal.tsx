"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type RefObject } from "react";
import { FiArrowRight, FiCheck } from "react-icons/fi";
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
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || capturedRef.current) return;
      capturedRef.current = true;
      captureStageOnce(eventName);
      observer.disconnect();
    }, { threshold: 0.35 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, eventName]);
  return elementRef;
}

function EvidencePlaceholder({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  return (
    <figure className={styles.evidencePlaceholder} data-asset-status="placeholder">
      <div aria-hidden="true"><span>IMAGEM PENDENTE</span></div>
      <figcaption><strong>{label}</strong>{description}</figcaption>
    </figure>
  );
}

export default function PostSolveReveal({
  referralCode,
}: {
  referralCode: string | null;
}) {
  const [step, setStep] = useState(0);
  const [campaignPhase, setCampaignPhase] = useState<"loading" | "ready" | "failure">("loading");
  const [campaign, setCampaign] = useState<CampaignProgress | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const confirmationHeadingRef = useRef<HTMLHeadingElement>(null);
  const operationRef = useViewedEvent<HTMLElement>(
    "eco_case_agent_report_viewed",
    isStageVisible(step, REVEAL_STAGES.operation),
  );
  const comparisonRef = useViewedEvent<HTMLElement>(
    "eco_case_white_room_viewed",
    isStageVisible(step, REVEAL_STAGES.comparison),
  );
  const quinaLogRef = useViewedEvent<HTMLElement>(
    "eco_case_quina_log_viewed",
    isStageVisible(step, REVEAL_STAGES.transmission),
  );
  const redDoorRef = useViewedEvent<HTMLElement>(
    "eco_case_red_door_revealed",
    isStageVisible(step, REVEAL_STAGES.impossibleSpace),
  );
  const conclusionRef = useViewedEvent<HTMLElement>(
    "eco_case_free_ending_completed",
    isStageVisible(step, REVEAL_STAGES.reclassification),
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
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) return;
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

  const inUnlockTransition = step < REVEAL_STAGES.operation;

  return (
    <section className={styles.reveal} aria-labelledby="eco-case-success-title">
      <section className={styles.confirmation} aria-label="Local identificado">
        <span className={styles.statusLabel}><FiCheck aria-hidden="true" /> LOCAL IDENTIFICADO</span>
        <h1 ref={confirmationHeadingRef} id="eco-case-success-title" tabIndex={-1}>
          Rua Benjamin Constant, 200
        </h1>
        <p className={styles.resolutionRegion}>Sé — São Paulo</p>
        <p>A conclusão foi incorporada ao registro operacional ECO-SP-001.</p>
      </section>

      {inUnlockTransition && (
        <div className={styles.unlockTransition}>
          <span className={styles.scanLine} aria-hidden="true" />
          <p className={styles.unlockLabel} aria-live="polite" role="status">{getUnlockStatus(step)}</p>
          <span className={styles.progressTrack} aria-hidden="true">
            <span style={{ width: `${((step + 1) / REVEAL_STAGES.operation) * 100}%` }} />
          </span>
        </div>
      )}

      {isStageVisible(step, REVEAL_STAGES.operation) && (
        <section ref={operationRef} className={`${styles.revealSection} ${styles.fieldReport}`} aria-labelledby="eco-operation-title">
          <div className={styles.recordIdentity}>
            <figure className={styles.personnelRecord}>
              <Image
                src="/eco/eco-sp-001/agent-field-record.png"
                alt="Registro fotográfico operacional do agente Quina."
                width={1122}
                height={1402}
                sizes="(max-width: 640px) calc(100vw - 72px), 300px"
              />
              <figcaption>AGENTE QUINA / EQUIPE DE RECONHECIMENTO</figcaption>
            </figure>
            <div className={styles.recordHeader}>
              <p className={styles.protocol}>ATUALIZAÇÃO OPERACIONAL / 02h17</p>
              <h2 id="eco-operation-title">Entrada na central</h2>
              <p className={styles.reportContext}>
                Após a confirmação do ponto final das rotas, o agente Quina foi enviado ao local. A entrada física ocorreu às 02h17 por um acesso de serviço preparado pela E.C.O.
              </p>
              <p className={styles.reportContext}>
                Placas técnicas, numeração de salas, equipamentos e marcas do edifício confirmaram que ele estava na central real. As portas remotas dos relatos não levavam diretamente até ali: os registros indicam uma sequência de pontos intermediários, com a central no fim da rota.
              </p>
            </div>
          </div>
        </section>
      )}

      {isStageVisible(step, REVEAL_STAGES.interior) && (
        <section className={`${styles.revealSection} ${styles.fieldReport}`} aria-labelledby="eco-interior-title">
          <p className={styles.protocol}>RECONHECIMENTO INTERNO / CENTRAL CONFIRMADA</p>
          <h2 id="eco-interior-title">Um prédio real, antigo e degradado</h2>
          <p className={styles.reportContext}>O interior permanecia administrativo e técnico: tinta descascando, piso antigo, divisórias gastas, corredores vazios, iluminação deficiente e salas desocupadas. Nada indicava que toda a central fosse um espaço sobrenatural.</p>
          <EvidencePlaceholder label="INTERIOR DEGRADADO DA CENTRAL" description="Placeholder do registro com placas técnicas, corredores gastos e sinais de abandono parcial." />
        </section>
      )}

      {isStageVisible(step, REVEAL_STAGES.comparison) && (
        <section ref={comparisonRef} className={`${styles.revealSection} ${styles.comparisonPanel}`} aria-labelledby="eco-comparison-title">
          <p className={styles.protocol}>COMPARAÇÃO FORENSE / MESMO ENQUADRAMENTO</p>
          <h2 id="eco-comparison-title">O ponto registrado por Jonas</h2>
          <p className={styles.reportContext}>Quina alcançou o mesmo ponto fotografado por Jonas: mesmo corredor, paredes, elementos laterais e perspectiva. No registro anterior, o recuo, as marcas de batente e o término incorreto da parede sugeriam uma abertura — mas não havia porta.</p>
          <div className={styles.comparisonGrid}>
            <EvidencePlaceholder label="REGISTRO DE JONAS / SEM PORTA" description="Mesmo enquadramento. Parede degradada, recuo e marcas de batente; nenhuma porta visível." />
            <EvidencePlaceholder label="REGISTRO DE QUINA / PORTA VERMELHA" description="Mesmo enquadramento e elementos laterais. Agora, uma porta vermelha ocupa exatamente o ponto vazio." />
          </div>
        </section>
      )}

      {isStageVisible(step, REVEAL_STAGES.transmission) && (
        <section ref={quinaLogRef} className={`${styles.revealSection} ${styles.transmissionPanel}`} aria-labelledby="eco-transmission-title">
          <p className={styles.protocol}>TRANSMISSÃO DE CAMPO / CANAL ATIVO</p>
          <h2 id="eco-transmission-title">Registro operacional</h2>
          <div className={styles.operationLog} role="log" aria-label="Transmissão do agente Quina dentro da central">
            <p><time dateTime="02:17:42">02:17:42</time><strong>QUINA</strong><span>entrada confirmada</span></p>
            <p><time dateTime="02:18:11">02:18:11</time><strong>QUINA</strong><span>corredor norte</span></p>
            <p><time dateTime="02:18:19">02:18:19</time><strong>CONTROLE</strong><span>confirme o ponto registrado por Valença</span></p>
            <p><time dateTime="02:18:27">02:18:27</time><strong>QUINA</strong><span>confirmado</span></p>
            <p><time dateTime="02:18:31">02:18:31</time><strong>QUINA</strong><span>há uma porta aqui</span></p>
            <p><time dateTime="02:18:36">02:18:36</time><strong>CONTROLE</strong><span>Valença não registrou nenhuma porta</span></p>
            <p><time dateTime="02:18:41">02:18:41</time><strong>QUINA</strong><span>eu sei</span></p>
            <p><time dateTime="02:18:55">02:18:55</time><strong>QUINA</strong><span>abrindo</span></p>
          </div>
        </section>
      )}

      {isStageVisible(step, REVEAL_STAGES.impossibleSpace) && (
        <section ref={redDoorRef} className={`${styles.revealSection} ${styles.impossibleSpace}`} aria-labelledby="eco-impossible-title">
          <p className={styles.protocol}>ABERTURA REGISTRADA / INCOMPATIBILIDADE ESPACIAL</p>
          <h2 id="eco-impossible-title">Geometria incompatível</h2>
          <p className={styles.reportContext}>A porta era vermelha, impecável, limpa e sem poeira, riscos ou desgaste. Parecia nova demais contra a tinta descascada e o corredor gasto da central.</p>
          <p className={styles.reportContext}>Depois dela havia profundidade maior que o edifício, portas repetidas, ângulos incoerentes, luz sem fonte e escadas que pareciam retornar ao mesmo ponto. Fragmentos dos lugares descritos nas rotas surgiam ligados sem lógica aparente.</p>
          <blockquote className={styles.quinaStatement}>
            <p>“Isso não cabe dentro do prédio.”</p>
            <cite>02:19:08 — QUINA</cite>
          </blockquote>
          <div className={styles.evidenceGrid}>
            <EvidencePlaceholder label="PORTA VERMELHA IMPECÁVEL" description="Placeholder do contraste entre a porta perfeita e o corredor deteriorado da central." />
            <EvidencePlaceholder label="ESPAÇO NÃO EUCLIDIANO / VISÃO PARCIAL" description="Placeholder da profundidade impossível além da porta. A natureza do espaço permanece indeterminada." />
          </div>
        </section>
      )}

      {isStageVisible(step, REVEAL_STAGES.closure) && (
        <section className={`${styles.revealSection} ${styles.containmentReport}`} aria-labelledby="eco-closure-title">
          <p className={styles.protocol}>RELATÓRIO DE CONTENÇÃO / ACESSO NEGADO</p>
          <h2 id="eco-closure-title">A porta se fechou</h2>
          <p>Quina atravessou. A porta se fechou onze segundos após a passagem do agente e o sinal foi perdido.</p>
          <p className={styles.signalStatus}>02:19:19 — SINAL PERDIDO</p>
          <p>Quando a equipe de contenção alcançou o corredor, havia apenas a parede registrada nas fotos de Jonas. Nenhuma abertura foi localizada e a planta voltou a corresponder ao edifício.</p>
          <p>Quina não respondeu às tentativas de contato e permanece desaparecido.</p>
        </section>
      )}

      {isStageVisible(step, REVEAL_STAGES.evidence) && (
        <section className={`${styles.revealSection} ${styles.evidence}`} aria-labelledby="eco-external-evidence-title">
          <div className={styles.evidenceHeading}>
            <p className={styles.protocol}>NOVA EVIDÊNCIA / CÂMERA EXTERNA / 02h31</p>
            <h2 id="eco-external-evidence-title">Movimento sem entrada correspondente</h2>
            <p>Às 02h31, a câmera externa registrou uma figura deixando o edifício. Nenhuma entrada anterior correspondente foi registrada.</p>
            <p>A figura aparentemente carregava uma peça de roupa semelhante a um item associado a Lia Martins. A imagem não permite confirmar a correspondência.</p>
          </div>
          <div className={styles.evidenceGrid}>
            <EvidencePlaceholder label="FRAME DA CÂMERA EXTERNA" description="A imagem final ainda depende de liberação para publicação." />
            <EvidencePlaceholder label="SILHUETA / PEÇA DE ROUPA" description="A figura não pode ser identificada. Uma peça de roupa parece corresponder a item associado a Lia Martins." />
          </div>
          <p className={styles.ambiguousNote}>
            O registro não confirma que a figura seja Lia, que Quina tenha retornado ou que qualquer entidade tenha deixado o local.
          </p>
        </section>
      )}

      {isStageVisible(step, REVEAL_STAGES.reclassification) && (
        <section ref={conclusionRef} className={`${styles.revealSection} ${styles.caseConclusion}`} aria-labelledby="eco-reclassification-title">
          <p className={styles.protocol}>RECLASSIFICAÇÃO OPERACIONAL</p>
          <h2 id="eco-reclassification-title">INCIDENTE ECO-SP-001: RECLASSIFICADO</h2>
          <dl className={styles.classificationGrid}>
            <div><dt>Agente Quina</dt><dd>DESAPARECIDO</dd></div>
            <div><dt>Status de contenção</dt><dd>FALHA</dd></div>
            <div><dt>Avaliação atual</dt><dd>AMEAÇA NÃO CONTIDA</dd></div>
          </dl>
          <p>O registro gratuito termina sem determinar quem deixou o edifício, o que permaneceu do outro lado ou o destino dos envolvidos.</p>
        </section>
      )}

      {isStageVisible(step, REVEAL_STAGES.restricted) && (
        <section className={`${styles.revealSection} ${styles.restrictedAccess}`} aria-labelledby="eco-restricted-title">
          <p className={styles.protocol}>MATERIAL RESTRITO / EDIÇÃO EM DESENVOLVIMENTO</p>
          <h2 id="eco-restricted-title">Acesso ao dossiê completo</h2>
          <p>O material gratuito termina neste ponto. Os registros seguintes permanecem restritos a agentes autorizados.</p>
          <p>A edição em desenvolvimento prevê:</p>
          <ul className={styles.restrictedContents}>
            <li>transmissão completa do agente Quina;</li>
            <li>imagens do espaço além da porta;</li>
            <li>comparação integral dos registros de Jonas e Quina;</li>
            <li>relatório sobre a figura registrada na saída;</li>
            <li>novos dados sobre Lia e a conclusão da investigação do desaparecimento de Jonas;</li>
            <li>tentativa de contenção da E.C.O.;</li>
            <li>materiais físicos previstos para a edição.</li>
          </ul>
          <p className={styles.provisionalNote}>Conteúdo e materiais sujeitos à conclusão editorial e à viabilização do lote fundador.</p>
        </section>
      )}

      {isStageVisible(step, REVEAL_STAGES.offer) && (
        <section ref={offerRef} className={`${styles.revealSection} ${styles.invitation}`} aria-labelledby="eco-invitation-title">
          <div className={styles.invitationIntro}>
            <p className={styles.protocol}>AUTORIZAÇÃO DE CONTINUIDADE</p>
            <h2 id="eco-invitation-title">Continuar a investigação</h2>
            <p>Você está solicitando participação no lote fundador do próximo dossiê físico E.C.O., atualmente em desenvolvimento.</p>
          </div>
          <div className={styles.offer} aria-labelledby="eco-founder-offer-title">
            <p className={styles.protocol}>PRÓXIMO CASO E.C.O. / LOTE FUNDADOR</p>
            <h3 id="eco-founder-offer-title">Dossiê físico com documentos, evidências e investigação inédita</h3>
            <FounderProgress phase={campaignPhase} campaign={campaign} />
            <strong className={styles.price}>R$ 79,90</strong>
            <dl className={styles.offerFacts}>
              <div><dt>Formato</dt><dd>Dossiê físico; não inclui edição digital integral. Apoios pontuais poderão ser digitais</dd></div>
              <div><dt>Meta de produção</dt><dd>100 investigadores</dd></div>
              <div><dt>Encerramento</dt><dd><time dateTime="2026-08-31">31/08/2026</time></dd></div>
              <div><dt>Entrega estimada</dt><dd>15 dias após a confirmação da produção</dd></div>
              <div><dt>Se a meta não for atingida</dt><dd>A produção será cancelada e os valores pagos serão devolvidos integralmente pelo meio original</dd></div>
              <div><dt>Devolução</dt><dd>Direito de arrependimento em até 7 dias da contratação ou do recebimento, conforme aplicável, com restituição integral</dd></div>
            </dl>
          </div>

          {campaign?.status === "closed" ? (
            <div className={styles.campaignClosed}>
              <strong>LOTE FUNDADOR ENCERRADO</strong>
              <p>{campaign.goalReached ? "A meta de produção foi atingida." : "A campanha foi encerrada sem confirmação da meta de produção."}</p>
            </div>
          ) : (
            <>
              <Link
                className={styles.offerCta}
                href={buildPurchasePath(referralCode)}
                onClick={() => {
                  captureStageOnce("eco_case_offer_cta_clicked");
                  safePosthogCapture("eco_purchase_cta_clicked", {
                    case_id: "eco-sp-001",
                    campaign_state: campaign?.status ?? "unknown",
                    has_referral: Boolean(referralCode),
                  });
                }}
              >
                CONTINUAR A INVESTIGAÇÃO <FiArrowRight aria-hidden="true" />
              </Link>
              <ShareControls
                variant={campaignPhase === "ready" && campaign ? campaign.goalReached ? "goal_reached" : "collecting" : "unknown"}
                campaignState={campaign?.status ?? null}
              />
            </>
          )}
        </section>
      )}
    </section>
  );
}
