"use client";

import { FormEvent, useRef, useState, type RefObject } from "react";
import {
  FiArrowRight,
  FiLoader,
  FiRefreshCw,
  FiShield,
} from "react-icons/fi";
import { safePosthogCapture } from "../../analytics/posthog";
import { validateBuyerInput } from "./buyer-validation.mjs";
import {
  buildOrderEndpoint,
  createOrderRequest,
  parseOrderResponse,
} from "./checkout-contract.mjs";
import styles from "./EcoCase.module.css";

const ECO_API_BASE_URL = process.env.NEXT_PUBLIC_ECO_API_BASE_URL;

export type BuyerPayload = {
  name: string;
  email: string;
  whatsapp: string;
};

type BuyerField = "name" | "email" | "whatsapp";

type BuyerErrors = Partial<Record<BuyerField, string>>;

const fields: Array<{
  name: BuyerField;
  label: string;
  type?: string;
  inputMode?: "email" | "tel" | "numeric" | "text";
  autoComplete: string;
  maxLength: number;
  className?: string;
}> = [
  {
    name: "name",
    label: "Nome completo",
    autoComplete: "name",
    maxLength: 120,
    className: styles.fullField,
  },
  {
    name: "email",
    label: "E-mail",
    type: "email",
    inputMode: "email",
    autoComplete: "email",
    maxLength: 320,
    className: styles.fullField,
  },
  {
    name: "whatsapp",
    label: "WhatsApp",
    type: "tel",
    inputMode: "tel",
    autoComplete: "tel",
    maxLength: 30,
    className: styles.fullField,
  },
];

function inputFromForm(formData: FormData) {
  return fields.reduce<Record<BuyerField, string>>(
    (result, field) => {
      result[field.name] = String(formData.get(field.name) ?? "");
      return result;
    },
    {} as Record<BuyerField, string>,
  );
}

export default function BuyerForm({
  headingRef,
  referralCode,
}: {
  headingRef?: RefObject<HTMLHeadingElement>;
  referralCode?: string | null;
} = {}) {
  const [errors, setErrors] = useState<BuyerErrors>({});
  const [checkoutState, setCheckoutState] = useState<
    "ready" | "submitting" | "failure"
  >("ready");
  const idempotencyKeyRef = useRef<string | null>(null);
  const submittingRef = useRef(false);
  const startedRef = useRef(false);

  function trackStarted() {
    if (startedRef.current) return;
    startedRef.current = true;
    safePosthogCapture("eco_purchase_form_started", {
      case_id: "eco-sp-001",
      has_referral: Boolean(referralCode),
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const form = event.currentTarget;
    const result = validateBuyerInput(inputFromForm(new FormData(form)));
    const nextErrors = result.errors as BuyerErrors;
    setErrors(nextErrors);

    if (!result.payload) {
      safePosthogCapture("eco_founder_form_error", {
        case_id: "eco-sp-001",
        invalid_fields: Object.keys(nextErrors),
      });
      const firstInvalidField = fields.find((field) => nextErrors[field.name]);
      if (firstInvalidField) {
        (
          form.elements.namedItem(firstInvalidField.name) as
            | HTMLInputElement
            | null
        )?.focus();
      }
      return;
    }

    submittingRef.current = true;
    setCheckoutState("submitting");
    safePosthogCapture("eco_purchase_form_submitted", {
      case_id: "eco-sp-001",
      has_referral: Boolean(referralCode),
    });

    try {
      const idempotencyKey =
        idempotencyKeyRef.current ?? globalThis.crypto.randomUUID();
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
        body: JSON.stringify(
          createOrderRequest(result.payload, referralCode ?? null),
        ),
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
      safePosthogCapture("eco_checkout_redirect_started", {
        case_id: "eco-sp-001",
        has_referral: Boolean(referralCode),
      });
      window.location.assign(order.checkoutUrl);
    } catch {
      setCheckoutState("failure");
      safePosthogCapture("eco_checkout_error", {
        case_id: "eco-sp-001",
      });
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <form
      className={styles.buyerForm}
      onSubmit={handleSubmit}
      onFocusCapture={trackStarted}
      noValidate
    >
      <div className={styles.formSectionHeading}>
        <h2 ref={headingRef} tabIndex={headingRef ? -1 : undefined}>
          Dados do comprador
        </h2>
        <p>
          Informe seus dados de contato. Ao enviar, você seguirá
          diretamente para o ambiente seguro do Mercado Pago.
        </p>
      </div>

      <div className={styles.buyerGrid}>
        {fields.map((field) => (
          <BuyerFieldInput
            key={field.name}
            field={field}
            error={errors[field.name]}
            disabled={checkoutState === "submitting"}
            clearError={() =>
              setErrors((current) => ({ ...current, [field.name]: undefined }))}
          />
        ))}
      </div>

      <p className={styles.dataNote}>
        <FiShield aria-hidden="true" /> Seus dados serão enviados somente ao
        servidor da E.C.O. para criar a reserva de acesso e preparar o pagamento.
      </p>

      <button
        className={styles.submitButton}
        type="submit"
        disabled={checkoutState === "submitting"}
      >
        {checkoutState === "submitting" ? (
          <>
            <FiLoader className={styles.spinner} aria-hidden="true" />
            PREPARANDO PAGAMENTO...
          </>
        ) : checkoutState === "failure" ? (
          <>
            TENTAR NOVAMENTE <FiRefreshCw aria-hidden="true" />
          </>
        ) : (
          <>
            CONTINUAR NO MERCADO PAGO <FiArrowRight aria-hidden="true" />
          </>
        )}
      </button>
      <div className={styles.checkoutFeedback} role="alert" aria-live="polite">
        {checkoutState === "failure" && (
          <p>
            Não foi possível preparar o pagamento. Seus dados foram preservados;
            tente novamente.
          </p>
        )}
      </div>
    </form>
  );
}

function BuyerFieldInput({
  field,
  error,
  disabled,
  clearError,
}: {
  field: (typeof fields)[number];
  error?: string;
  disabled: boolean;
  clearError: () => void;
}) {
  const errorId = `eco-buyer-${field.name}-error`;
  return (
    <div className={`${styles.field} ${field.className ?? ""}`}>
      <label htmlFor={`eco-buyer-${field.name}`}>{field.label}</label>
      <input
        id={`eco-buyer-${field.name}`}
        name={field.name}
        type={field.type ?? "text"}
        inputMode={field.inputMode}
        autoComplete={field.autoComplete}
        maxLength={field.maxLength}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={error ? clearError : undefined}
        disabled={disabled}
      />
      {error && (
        <p id={errorId} className={styles.fieldError}>
          {error}
        </p>
      )}
    </div>
  );
}
