"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiAlertCircle } from "react-icons/fi";
import { safePosthogCapture } from "../../../analytics/posthog";
import BuyerForm from "../BuyerForm";
import {
  buildCampaignProgressEndpoint,
  ECO_CAMPAIGN_ID,
  normalizeReferralCode,
  parseCampaignProgress,
} from "../campaign-contract.mjs";
import FounderProgress, {
  type CampaignProgress,
} from "../FounderProgress";
import { parseOrderReference } from "../payment-status-contract.mjs";
import PaymentStatusView from "../status/PaymentStatus";
import styles from "../EcoCase.module.css";

const ECO_API_BASE_URL = process.env.NEXT_PUBLIC_ECO_API_BASE_URL;
const REFERRAL_STORAGE_KEY = "eco-sp-001:referral-code";
const RETURN_KEYS = [
  "collection_id",
  "collection_status",
  "payment_id",
  "status",
  "external_reference",
  "merchant_order_id",
  "preference_id",
];

export default function PurchaseExperience() {
  const searchParams = useSearchParams();
  const pageHeadingRef = useRef<HTMLHeadingElement>(null);
  const viewedRef = useRef(false);
  const returnedRef = useRef(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [campaignPhase, setCampaignPhase] = useState<
    "loading" | "ready" | "failure"
  >("loading");
  const [campaign, setCampaign] = useState<CampaignProgress | null>(null);
  const orderReference = useMemo(
    () => parseOrderReference(searchParams.get("order")),
    [searchParams],
  );
  const hasCheckoutReturn = useMemo(
    () => RETURN_KEYS.some((key) => searchParams.has(key)),
    [searchParams],
  );

  useEffect(() => {
    const fromUrl = normalizeReferralCode(searchParams.get("ref"));
    let fromSession: string | null = null;
    try {
      fromSession = normalizeReferralCode(
        window.sessionStorage.getItem(REFERRAL_STORAGE_KEY),
      );
    } catch {
      // URL attribution remains available without storage.
    }
    const captured = fromUrl ?? fromSession;
    if (captured) {
      setReferralCode(captured);
      try {
        window.sessionStorage.setItem(REFERRAL_STORAGE_KEY, captured);
      } catch {
        // Component state preserves attribution for this visit.
      }
    }

    if (!viewedRef.current) {
      viewedRef.current = true;
      safePosthogCapture("eco_purchase_page_viewed", {
        case_id: "eco-sp-001",
        has_referral: Boolean(captured),
      });
    }
    if ((orderReference || hasCheckoutReturn) && !returnedRef.current) {
      returnedRef.current = true;
      safePosthogCapture("eco_checkout_returned", {
        case_id: "eco-sp-001",
        has_order_context: Boolean(orderReference),
      });
    }
    pageHeadingRef.current?.focus();
  }, [hasCheckoutReturn, orderReference, searchParams]);

  useEffect(() => {
    if (orderReference) return;
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
  }, [orderReference]);

  if (orderReference) {
    return (
      <div className={styles.purchaseStatus}>
        <h1 ref={pageHeadingRef} tabIndex={-1} className={styles.visuallyHidden}>
          Status da reserva da próxima missão digital
        </h1>
        <PaymentStatusView />
        <p className={styles.statusSecurityNote}>
          O estado exibido vem do servidor da E.C.O. Parâmetros retornados pelo
          checkout não confirmam pagamento.
        </p>
      </div>
    );
  }

  if (hasCheckoutReturn) {
    return (
      <section className={styles.purchaseRecovery}>
        <FiAlertCircle aria-hidden="true" />
        <p className={styles.protocol}>CONTEXTO DO PEDIDO AUSENTE</p>
        <h1 ref={pageHeadingRef} tabIndex={-1}>
          Não foi possível recuperar este pedido
        </h1>
        <p>
          Nenhum pagamento foi presumido. Retorne ao cadastro para iniciar uma
          consulta vinculada com segurança ao seu próprio pedido.
        </p>
        <Link href="/eco/eco-sp-001/comprar">VOLTAR AO CADASTRO</Link>
      </section>
    );
  }

  const closed = campaign?.status === "closed";
  return (
    <>
      <section className={styles.purchaseIntro}>
        <p className={styles.protocol}>FINANCIAMENTO COLETIVO / ACESSO FUNDADOR</p>
        <h1 ref={pageHeadingRef} tabIndex={-1}>
          Próxima missão digital da E.C.O.
        </h1>
        <p>
          Uma investigação digital inédita da E.C.O., criada do zero após a
          confirmação da campanha.
        </p>
      </section>

      <section
        className={styles.purchaseSummary}
        aria-labelledby="eco-purchase-summary"
      >
        <h2 id="eco-purchase-summary">Reserva de acesso fundador</h2>
        <FounderProgress phase={campaignPhase} campaign={campaign} />
        <strong className={styles.price}>R$ 29,90</strong>
        <dl className={styles.offerFacts}>
          <div>
            <dt>Formato</dt>
            <dd>Experiência exclusivamente digital, com acesso online e nenhuma impressão necessária</dd>
          </div>
          <div>
            <dt>Conteúdo previsto</dt>
            <dd>Documentos, fotografias, registros interativos, sistema de pistas, conclusão verificável e epílogo completo</dd>
          </div>
          <div>
            <dt>Duração estimada</dt>
            <dd>60 a 120 minutos</dd>
          </div>
          <div>
            <dt>Meta</dt>
            <dd>100 participantes</dd>
          </div>
          <div>
            <dt>Encerramento</dt>
            <dd>
              <time dateTime="2026-08-31">31/08/2026</time>
            </dd>
          </div>
          <div>
            <dt>Prazo de entrega</dt>
            <dd>Até 90 dias após a meta ser atingida</dd>
          </div>
          <div>
            <dt>Se a meta não for atingida</dt>
            <dd>Reembolso integral: a missão não será produzida e os valores pagos serão devolvidos pelo meio original</dd>
          </div>
          <div>
            <dt>Devolução</dt>
            <dd>Direito de arrependimento em até 7 dias da contratação ou do recebimento, conforme aplicável, com restituição integral</dd>
          </div>
        </dl>
        <p className={styles.provisionalNote}>
          A próxima história ainda não foi anunciada. A reserva financia sua
          criação e não representa a compra de uma missão já concluída.
        </p>
      </section>

      {closed ? (
        <section className={styles.campaignClosed}>
          <strong>CAMPANHA ENCERRADA</strong>
          <p>
            {campaign.goalReached
              ? "A meta foi atingida e a próxima missão foi autorizada."
              : "A meta não foi atingida; os valores pagos serão reembolsados integralmente."}
          </p>
        </section>
      ) : (
        <section className={styles.purchaseFormPanel}>
          <BuyerForm referralCode={referralCode} />
        </section>
      )}

      <p className={styles.purchaseCampaignId}>
        Campanha: <span>{ECO_CAMPAIGN_ID}</span>
      </p>
    </>
  );
}
