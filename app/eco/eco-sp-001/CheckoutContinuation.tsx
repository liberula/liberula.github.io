"use client";

import { useRef, useState } from "react";
import { FiArrowRight, FiCheck, FiLoader, FiRefreshCw } from "react-icons/fi";
import { safePosthogCapture } from "../../analytics/posthog";
import type { BuyerPayload } from "./BuyerForm";
import {
  buildOrderEndpoint,
  createOrderRequest,
  parseOrderResponse,
} from "./checkout-contract.mjs";
import styles from "./EcoCase.module.css";

type CheckoutState = "ready" | "submitting" | "failure";

const ECO_API_BASE_URL = process.env.NEXT_PUBLIC_ECO_API_BASE_URL;

function createIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

export default function CheckoutContinuation({
  buyer,
  referralCode,
}: {
  buyer: BuyerPayload;
  referralCode: string | null;
}) {
  const [state, setState] = useState<CheckoutState>("ready");
  const idempotencyKeyRef = useRef<string | null>(null);
  const submittingRef = useRef(false);

  async function startCheckout() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setState("submitting");
    safePosthogCapture("eco_checkout_requested", {
      case_id: "eco-sp-001",
    });

    try {
      const idempotencyKey =
        idempotencyKeyRef.current ?? createIdempotencyKey();
      idempotencyKeyRef.current = idempotencyKey;
      const orderEndpoint = buildOrderEndpoint(ECO_API_BASE_URL);
      if (!orderEndpoint) throw new Error("checkout_not_configured");

      const response = await fetch(orderEndpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(createOrderRequest(buyer, referralCode)),
      });
      const body: unknown = await response.json().catch(() => null);
      const order = response.ok ? parseOrderResponse(body) : null;
      if (!order) throw new Error("checkout_unavailable");

      if (order.referralAttributed) {
        safePosthogCapture("eco_referral_order_created", {
          case_id: "eco-sp-001",
          campaign_id: "eco-sp-001-founder",
          has_referral: true,
        });
      }
      safePosthogCapture("eco_checkout_redirected", {
        case_id: "eco-sp-001",
      });
      window.location.assign(order.checkoutUrl);
    } catch {
      setState("failure");
      safePosthogCapture("eco_checkout_error", {
        case_id: "eco-sp-001",
      });
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <div className={styles.localContinuation}>
      <span className={styles.statusLabel}>
        <FiCheck aria-hidden="true" /> DADOS PRONTOS
      </span>
      <h3>Cadastro preparado para a próxima etapa.</h3>
      <p>
        Ao continuar, o futuro serviço seguro criará um pedido pendente e abrirá
        o ambiente sandbox do Mercado Pago.
      </p>
      <button
        className={styles.submitButton}
        type="button"
        onClick={startCheckout}
        disabled={state === "submitting"}
      >
        {state === "submitting" ? (
          <>
            <FiLoader className={styles.spinner} aria-hidden="true" />
            PREPARANDO CHECKOUT...
          </>
        ) : state === "failure" ? (
          <>
            TENTAR NOVAMENTE <FiRefreshCw aria-hidden="true" />
          </>
        ) : (
          <>
            CONTINUAR PARA O SANDBOX <FiArrowRight aria-hidden="true" />
          </>
        )}
      </button>
      <div className={styles.checkoutFeedback} role="status" aria-live="polite">
        {state === "failure" && (
          <p>
            O checkout ainda não está disponível. Seus dados continuam
            preenchidos nesta página; tente novamente mais tarde.
          </p>
        )}
      </div>
    </div>
  );
}
