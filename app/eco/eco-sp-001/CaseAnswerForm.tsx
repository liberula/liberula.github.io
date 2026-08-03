"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { FiArrowRight, FiLoader, FiRefreshCw } from "react-icons/fi";
import { safePosthogCapture } from "../../analytics/posthog";
import { normalizeAnswer } from "./answer-normalization.mjs";
import { buildValidationEndpoint } from "./eco-api-contract.mjs";
import styles from "./EcoCase.module.css";

const ECO_API_BASE_URL = process.env.NEXT_PUBLIC_ECO_API_BASE_URL;
const HINT_STORAGE_KEY = "eco-sp-001:hint-level";
const HINTS = [
  "Compare os pontos intermediários registrados em cada uma das três ocorrências.",
  "No mapa, observe a direção seguida por cada rota depois do último ponto confirmado.",
  "As três rotas convergem na região da Sé, próximas à Rua Benjamin Constant.",
] as const;

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

export default function CaseAnswerForm({
  onCorrect,
}: {
  onCorrect: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const [state, setState] = useState<SubmissionState>("initial");
  const [fieldError, setFieldError] = useState("");
  const [hintLevel, setHintLevel] = useState(0);
  const [confirmingHint, setConfirmingHint] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    safePosthogCapture("eco_case_view", { case_id: "eco-sp-001" });
    try {
      const stored = Number(window.sessionStorage.getItem(HINT_STORAGE_KEY));
      if (Number.isInteger(stored) && stored >= 1 && stored <= HINTS.length) {
        setHintLevel(stored);
      }
    } catch {
      // Hints remain available without browser storage.
    }
  }, []);

  function revealNextHint() {
    const nextLevel = Math.min(hintLevel + 1, HINTS.length);
    setHintLevel(nextLevel);
    setConfirmingHint(false);
    try {
      window.sessionStorage.setItem(HINT_STORAGE_KEY, String(nextLevel));
    } catch {
      // Component state preserves progress for the current visit.
    }
    safePosthogCapture("eco_case_hint_used", {
      case_id: "eco-sp-001",
      hint_level: nextLevel,
    });
  }

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
        onCorrect();
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
    return null;
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
        Registre o nome ou endereço do local indicado pelas evidências.
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

      <aside className={styles.hintPanel} aria-labelledby="eco-hints-title">
        <p className={styles.protocol}>ORIENTAÇÃO OPCIONAL</p>
        <h3 id="eco-hints-title">Precisa de uma direção?</h3>
        <p>As pistas são progressivas e não são necessárias para concluir o caso.</p>
        {hintLevel > 0 && (
          <ol className={styles.hintList} aria-live="polite">
            {HINTS.slice(0, hintLevel).map((hint, index) => (
              <li key={hint}><strong>PISTA {index + 1}</strong><span>{hint}</span></li>
            ))}
          </ol>
        )}
        {hintLevel < HINTS.length && !confirmingHint && (
          <button className={styles.hintButton} type="button" onClick={() => setConfirmingHint(true)}>
            {hintLevel === 0 ? "SOLICITAR ORIENTAÇÃO" : "SOLICITAR PRÓXIMA ORIENTAÇÃO"}
          </button>
        )}
        {confirmingHint && (
          <div className={styles.hintConfirmation} role="group" aria-label={`Confirmar pista ${hintLevel + 1}`}>
            <p>Revelar a pista {hintLevel + 1}?</p>
            <div>
              <button type="button" onClick={revealNextHint}>REVELAR PISTA</button>
              <button type="button" onClick={() => setConfirmingHint(false)}>CANCELAR</button>
            </div>
          </div>
        )}
      </aside>
    </section>
  );
}
