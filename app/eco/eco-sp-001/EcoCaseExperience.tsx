"use client";

import { useEffect, useState } from "react";
import { safePosthogCapture } from "../../analytics/posthog";
import {
  ECO_CAMPAIGN_ID,
  normalizeReferralCode,
} from "./campaign-contract.mjs";
import CaseAnswerForm from "./CaseAnswerForm";
import styles from "./EcoCase.module.css";
import PostSolveReveal from "./PostSolveReveal";

export default function EcoCaseExperience() {
  const [solved, setSolved] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  useEffect(() => {
    const storageKey = "eco-sp-001:referral-code";
    const fromUrl = normalizeReferralCode(
      new URLSearchParams(window.location.search).get("ref"),
    );
    let fromSession: string | null = null;
    try {
      fromSession = normalizeReferralCode(
        window.sessionStorage.getItem(storageKey),
      );
    } catch {
      // The URL referral still works when browser storage is unavailable.
    }
    const captured = fromUrl ?? fromSession;
    if (!captured) return;
    try {
      window.sessionStorage.setItem(storageKey, captured);
    } catch {
      // Referral remains in component state for this page journey.
    }
    setReferralCode(captured);
    if (fromUrl) {
      const analyticsKey = "eco-sp-001:referral-captured-event";
      let alreadyCaptured = false;
      try {
        alreadyCaptured = window.sessionStorage.getItem(analyticsKey) === "1";
        window.sessionStorage.setItem(analyticsKey, "1");
      } catch {
        // A single component mount still produces only one event.
      }
      if (!alreadyCaptured) {
        safePosthogCapture("eco_referral_code_captured", {
          case_id: "eco-sp-001",
          campaign_id: ECO_CAMPAIGN_ID,
          has_referral: true,
        });
      }
    }
  }, []);

  if (solved) {
    return <PostSolveReveal referralCode={referralCode} />;
  }

  return (
    <>
      <article className={styles.briefing}>
        <p className={styles.eyebrow}>ARQUIVO DE INVESTIGAÇÃO / SÃO PAULO</p>
        <h1>Onde as evidências convergem?</h1>
        <p className={styles.lead}>
          Você recebeu um conjunto de indícios vinculados a uma ocorrência na
          cidade de São Paulo. Examine o material disponibilizado, identifique o
          estabelecimento e registre sua conclusão.
        </p>

        <section className={styles.dossier} aria-labelledby="case-directive">
          <h2 id="case-directive">DIRETRIZ OPERACIONAL</h2>
          <p>
            Informe o nome do local com a maior precisão possível. Variações de
            caixa, acentuação e espaçamento não alteram a análise.
          </p>
        </section>
      </article>

      <CaseAnswerForm onCorrect={() => setSolved(true)} />
    </>
  );
}
