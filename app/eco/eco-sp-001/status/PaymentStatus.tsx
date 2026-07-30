"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  FiAlertCircle,
  FiCheck,
  FiClock,
  FiRefreshCw,
  FiRotateCcw,
  FiX,
} from "react-icons/fi";
import { safePosthogCapture } from "../../../analytics/posthog";
import {
  buildStatusEndpoint,
  parseOrderReference,
  parseOrderStatusResponse,
} from "../payment-status-contract.mjs";
import ShareControls from "../ShareControls";
import styles from "../EcoCase.module.css";

type PaymentStatus =
  | "pending"
  | "paid"
  | "rejected"
  | "cancelled"
  | "refunded";

type ViewPhase = "loading" | "ready" | "failure" | "invalid";

const statusContent: Record<
  PaymentStatus,
  {
    label: string;
    title: string;
    description: string;
    icon: typeof FiClock;
    tone: string;
  }
> = {
  pending: {
    label: "PAGAMENTO PENDENTE",
    title: "Aguardando confirmação",
    description:
      "O pagamento ainda está sendo processado. Esta página será atualizada automaticamente.",
    icon: FiClock,
    tone: styles.statusPending,
  },
  paid: {
    label: "PAGAMENTO CONFIRMADO",
    title: "Pedido confirmado",
    description:
      "O provedor confirmou o pagamento. Guarde esta página como referência.",
    icon: FiCheck,
    tone: styles.statusPaid,
  },
  rejected: {
    label: "PAGAMENTO REJEITADO",
    title: "Pagamento não aprovado",
    description:
      "O provedor não aprovou o pagamento. Nenhuma confirmação foi registrada.",
    icon: FiX,
    tone: styles.statusNegative,
  },
  cancelled: {
    label: "PAGAMENTO CANCELADO",
    title: "Checkout cancelado",
    description:
      "O pagamento foi cancelado. Você pode retornar ao caso quando desejar.",
    icon: FiX,
    tone: styles.statusNegative,
  },
  refunded: {
    label: "PAGAMENTO REEMBOLSADO",
    title: "Pagamento reembolsado",
    description:
      "O provedor informou que o valor deste pagamento foi reembolsado.",
    icon: FiRotateCcw,
    tone: styles.statusRefunded,
  },
};

const MAX_AUTOMATIC_POLLS = 12;
const POLL_INTERVAL_MS = 5_000;
const ECO_API_BASE_URL = process.env.NEXT_PUBLIC_ECO_API_BASE_URL;

export default function PaymentStatusView() {
  const searchParams = useSearchParams();
  const orderReference = useMemo(
    () => parseOrderReference(searchParams.get("order")),
    [searchParams],
  );
  const [phase, setPhase] = useState<ViewPhase>(
    orderReference ? "loading" : "invalid",
  );
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!orderReference) {
      setPhase("invalid");
      return;
    }

    const endpoint = buildStatusEndpoint(ECO_API_BASE_URL, orderReference);
    if (!endpoint) {
      setPhase("invalid");
      return;
    }
    const statusEndpoint: string = endpoint;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let pollCount = 0;
    const controller = new AbortController();

    async function poll() {
      pollCount += 1;
      try {
        const response = await fetch(statusEndpoint, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal: controller.signal,
        });
        const body: unknown = await response.json().catch(() => null);
        const result = response.ok ? parseOrderStatusResponse(body) : null;
        if (!result) throw new Error("status_unavailable");
        if (cancelled) return;

        const nextStatus = result.status as PaymentStatus;
        setStatus(nextStatus);
        setUpdatedAt(result.updatedAt);
        setReferralCode(result.referralCode);
        setPhase("ready");
        safePosthogCapture("eco_payment_status_viewed", {
          case_id: "eco-sp-001",
          status: nextStatus,
        });

        if (
          nextStatus === "pending" &&
          pollCount < MAX_AUTOMATIC_POLLS &&
          !cancelled
        ) {
          timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
        setPhase("failure");
        safePosthogCapture("eco_payment_status_error", {
          case_id: "eco-sp-001",
        });
      }
    }

    setPhase("loading");
    void poll();

    return () => {
      cancelled = true;
      controller.abort();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [orderReference, refreshKey]);

  if (phase === "invalid") {
    return (
      <StatusMessage
        icon={FiAlertCircle}
        label="REFERÊNCIA INVÁLIDA"
        title="Não foi possível localizar o pedido"
        description="Abra esta página usando o link de retorno fornecido pelo checkout."
        tone={styles.statusNegative}
      />
    );
  }

  if (phase === "loading" && !status) {
    return (
      <StatusMessage
        icon={FiRefreshCw}
        label="CONSULTANDO PEDIDO"
        title="Verificando o pagamento"
        description="Aguarde enquanto consultamos o estado registrado pelo servidor."
        tone={styles.statusPending}
        spinning
      />
    );
  }

  if (phase === "failure") {
    return (
      <StatusMessage
        icon={FiAlertCircle}
        label="CONSULTA INDISPONÍVEL"
        title="Não foi possível verificar agora"
        description="Nenhum estado foi presumido. Tente consultar novamente em instantes."
        tone={styles.statusNegative}
        action={() => setRefreshKey((current) => current + 1)}
      />
    );
  }

  const content = status ? statusContent[status] : null;
  if (!content) return null;
  const StatusIcon = content.icon;

  return (
    <>
      <section className={`${styles.statusCard} ${content.tone}`} role="status">
        <StatusIcon className={styles.statusIcon} aria-hidden="true" />
        <p className={styles.protocol}>{content.label}</p>
        <h1>{content.title}</h1>
        <p>{content.description}</p>
        {updatedAt && (
          <p className={styles.statusTimestamp}>
            Última atualização:{" "}
            <time dateTime={updatedAt}>
              {new Intl.DateTimeFormat("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(updatedAt))}
            </time>
          </p>
        )}
        {status === "pending" && (
          <button
            className={styles.statusRefreshButton}
            type="button"
            onClick={() => setRefreshKey((current) => current + 1)}
          >
            <FiRefreshCw aria-hidden="true" /> ATUALIZAR AGORA
          </button>
        )}
      </section>
      {referralCode && (status === "pending" || status === "paid") && (
        <div className={styles.statusShare}>
          <ShareControls
            variant={status === "paid" ? "personal_paid" : "personal_pending"}
            referralCode={referralCode}
            campaignState={null}
          />
        </div>
      )}
    </>
  );
}

function StatusMessage({
  icon: Icon,
  label,
  title,
  description,
  tone,
  spinning = false,
  action,
}: {
  icon: typeof FiClock;
  label: string;
  title: string;
  description: string;
  tone: string;
  spinning?: boolean;
  action?: () => void;
}) {
  return (
    <section className={`${styles.statusCard} ${tone}`} role="status">
      <Icon
        className={`${styles.statusIcon} ${spinning ? styles.spinner : ""}`}
        aria-hidden="true"
      />
      <p className={styles.protocol}>{label}</p>
      <h1>{title}</h1>
      <p>{description}</p>
      {action && (
        <button
          className={styles.statusRefreshButton}
          type="button"
          onClick={action}
        >
          <FiRefreshCw aria-hidden="true" /> TENTAR NOVAMENTE
        </button>
      )}
    </section>
  );
}
