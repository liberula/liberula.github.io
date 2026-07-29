"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { FiArrowRight, FiCheck, FiLoader, FiRefreshCw } from "react-icons/fi";
import { safePosthogCapture } from "../../analytics/posthog";
import { normalizeAnswer } from "./answer-normalization.mjs";
import BuyerForm from "./BuyerForm";
import { buildValidationEndpoint } from "./eco-api-contract.mjs";
import styles from "./EcoCase.module.css";

const ECO_API_BASE_URL = process.env.NEXT_PUBLIC_ECO_API_BASE_URL;

type SubmissionState =
  | "initial"
  | "submitting"
  | "incorrect"
  | "failure"
  | "correct";

type ValidationResponse = {
  correct?: boolean;
};

async function readValidationResponse(
  response: Response,
): Promise<ValidationResponse> {
  try {
    return (await response.json()) as ValidationResponse;
  } catch {
    return {};
  }
}

export default function CaseAnswerForm() {
  const [answer, setAnswer] = useState("");
  const [state, setState] = useState<SubmissionState>("initial");
  const [fieldError, setFieldError] = useState("");
  const submittingRef = useRef(false);

  useEffect(() => {
    safePosthogCapture("eco_case_view", { case_id: "eco-sp-001" });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || state === "correct") return;

    const normalizedAnswer = normalizeAnswer(answer);
    if (!normalizedAnswer) {
      setFieldError("Informe sua conclusão antes de enviar.");
      setState("initial");
      safePosthogCapture("eco_case_answer_error", {
        case_id: "eco-sp-001",
        error: "empty_answer",
      });
      return;
    }

    setFieldError("");
    setState("submitting");
    submittingRef.current = true;
    safePosthogCapture("eco_case_answer_submitted", {
      case_id: "eco-sp-001",
    });

    try {
      const validationEndpoint = buildValidationEndpoint(ECO_API_BASE_URL);
      if (!validationEndpoint) throw new Error("validation_not_configured");

      const response = await fetch(validationEndpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ answer: normalizedAnswer }),
      });
      const result = await readValidationResponse(response);

      if (!response.ok || typeof result.correct !== "boolean") {
        throw new Error("validation_unavailable");
      }

      if (result.correct) {
        setState("correct");
        safePosthogCapture("eco_case_answer_correct", {
          case_id: "eco-sp-001",
        });
      } else {
        setState("incorrect");
        safePosthogCapture("eco_case_answer_incorrect", {
          case_id: "eco-sp-001",
        });
      }
    } catch {
      setState("failure");
      safePosthogCapture("eco_case_answer_error", {
        case_id: "eco-sp-001",
        error: "request_failed",
      });
    } finally {
      submittingRef.current = false;
    }
  }

  if (state === "correct") {
    return (
      <section
        className={`${styles.panel} ${styles.successPanel} ${styles.offerPanel}`}
        aria-labelledby="eco-case-success-title"
      >
        <div role="status">
          <span className={styles.statusLabel}>
            <FiCheck aria-hidden="true" /> ANÁLISE CONFIRMADA
          </span>
          <h2 id="eco-case-success-title">Conclusão aceita.</h2>
          <p>
            Você concluiu o caso e pode conhecer a oferta provisória do lote
            fundador.
          </p>
        </div>

        <div className={styles.offer} aria-labelledby="eco-founder-offer-title">
          <p className={styles.protocol}>LOTE FUNDADOR / OFERTA PROVISÓRIA</p>
          <h3 id="eco-founder-offer-title">Lote fundador ECO-SP-001</h3>
          <strong className={styles.price}>R$ 79,90</strong>
          <dl className={styles.offerFacts}>
            <div>
              <dt>Meta do lote</dt>
              <dd>100 compradores</dd>
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
          <p className={styles.provisionalNote}>
            Esta apresentação é provisória. As condições finais serão exibidas
            antes de qualquer pagamento.
          </p>
        </div>

        <BuyerForm />
      </section>
    );
  }

  const describedBy = [
    "eco-answer-hint",
    fieldError ? "eco-answer-error" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={styles.panel} aria-labelledby="eco-answer-title">
      <p className={styles.protocol}>FORMULÁRIO DE CONCLUSÃO</p>
      <h2 id="eco-answer-title">Identifique o local investigado</h2>
      <p className={styles.formIntro}>
        Registre o nome completo do estabelecimento indicado pelas evidências do
        caso.
      </p>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label htmlFor="eco-case-answer">Sua conclusão</label>
          <input
            id="eco-case-answer"
            name="answer"
            type="text"
            value={answer}
            onChange={(event) => {
              setAnswer(event.target.value);
              if (fieldError) setFieldError("");
              if (state === "incorrect" || state === "failure") {
                setState("initial");
              }
            }}
            autoComplete="off"
            spellCheck="false"
            maxLength={200}
            aria-invalid={Boolean(fieldError)}
            aria-describedby={describedBy}
            disabled={state === "submitting"}
          />
          <p id="eco-answer-hint" className={styles.hint}>
            A resposta não diferencia maiúsculas, acentos ou espaços repetidos.
          </p>
          {fieldError && (
            <p id="eco-answer-error" className={styles.fieldError}>
              {fieldError}
            </p>
          )}
        </div>

        <button
          className={styles.submitButton}
          type="submit"
          disabled={state === "submitting"}
        >
          {state === "submitting" ? (
            <>
              <FiLoader className={styles.spinner} aria-hidden="true" />
              ANALISANDO...
            </>
          ) : state === "failure" ? (
            <>
              TENTAR NOVAMENTE <FiRefreshCw aria-hidden="true" />
            </>
          ) : (
            <>
              ENVIAR CONCLUSÃO <FiArrowRight aria-hidden="true" />
            </>
          )}
        </button>

        <div className={styles.feedback} aria-live="polite" role="status">
          {state === "incorrect" && (
            <p className={styles.incorrect}>
              A conclusão não corresponde às evidências. Revise o caso e tente
              novamente.
            </p>
          )}
          {state === "failure" && (
            <p className={styles.failure}>
              Não foi possível validar sua conclusão agora. Sua resposta foi
              preservada; tente novamente em instantes.
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
