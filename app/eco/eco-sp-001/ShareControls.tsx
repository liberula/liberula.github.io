"use client";

import { useState } from "react";
import { FiCheck, FiClipboard, FiMessageCircle } from "react-icons/fi";
import { safePosthogCapture } from "../../analytics/posthog";
import {
  buildReferralUrl,
  buildShareMessage,
  buildWhatsAppUrl,
  ECO_CAMPAIGN_ID,
  ECO_CASE_URL,
} from "./campaign-contract.mjs";
import styles from "./EcoCase.module.css";

type ShareVariant =
  | "collecting"
  | "goal_reached"
  | "unknown"
  | "personal_pending"
  | "personal_paid";

export default function ShareControls({
  variant,
  referralCode,
  campaignState,
}: {
  variant: ShareVariant;
  referralCode?: string | null;
  campaignState: "collecting" | "goal_reached" | "closed" | null;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failure">(
    "idle",
  );
  const personal = variant.startsWith("personal_");
  const shareUrl = personal ? buildReferralUrl(referralCode) : ECO_CASE_URL;
  const message = buildShareMessage(variant, shareUrl);
  const whatsappUrl = buildWhatsAppUrl(message);

  const content = variant === "collecting"
    ? {
      title: "Ajude a autorizar a missão",
      description:
        "A criação começa quando 100 participantes reservarem acesso.",
      invitation:
        "Envie o caso para alguém que também gostaria de investigar.",
    }
    : variant === "unknown"
    ? {
      title: "Compartilhe a investigação",
      description: "A campanha está em andamento.",
      invitation:
        "Envie o caso para alguém que também gostaria de investigar.",
    }
    : variant === "goal_reached"
    ? {
      title: "Convide outro investigador",
      description: "A próxima missão já foi autorizada.",
      invitation:
        "Novos participantes ainda podem garantir acesso fundador enquanto a campanha estiver aberta.",
    }
    : variant === "personal_paid"
    ? {
      title: "Convide outro investigador",
      description: "Seu acesso fundador à próxima missão digital foi confirmado.",
      invitation:
        "Compartilhe seu link com alguém que também gostaria de jogar a próxima missão digital.",
    }
    : {
      title: "Convide outro investigador",
      description: "Seu pedido foi criado e aguarda confirmação.",
      invitation:
        "Você já pode compartilhar seu link, sem que isso altere o estado do pagamento.",
    };

  function analyticsProperties(channel: "whatsapp" | "clipboard") {
    return {
      case_id: "eco-sp-001",
      campaign_id: ECO_CAMPAIGN_ID,
      share_channel: channel,
      has_referral: personal && Boolean(referralCode),
      ...(campaignState ? { campaign_state: campaignState } : {}),
    };
  }

  async function copyLink() {
    safePosthogCapture(
      "eco_share_clicked",
      analyticsProperties("clipboard"),
    );
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard_missing");
      await navigator.clipboard.writeText(shareUrl);
      setCopyState("copied");
      safePosthogCapture(
        "eco_share_link_copied",
        analyticsProperties("clipboard"),
      );
    } catch {
      setCopyState("failure");
    }
  }

  return (
    <section className={styles.sharePanel} aria-labelledby={`eco-share-${variant}`}>
      <p className={styles.protocol}>COMPARTILHAR INVESTIGAÇÃO</p>
      <h3 id={`eco-share-${variant}`}>{content.title}</h3>
      <p>{content.description}</p>
      <p>{content.invitation}</p>
      <div className={styles.shareActions}>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            safePosthogCapture(
              "eco_share_clicked",
              analyticsProperties("whatsapp"),
            );
          }}
        >
          <FiMessageCircle aria-hidden="true" />
          ENVIAR PELO WHATSAPP
        </a>
        <button type="button" onClick={copyLink}>
          {copyState === "copied" ? (
            <FiCheck aria-hidden="true" />
          ) : (
            <FiClipboard aria-hidden="true" />
          )}
          {personal ? "COPIAR MEU LINK" : "COPIAR LINK"}
        </button>
      </div>
      <p className={styles.shareFeedback} role="status" aria-live="polite">
        {copyState === "copied" && "Link copiado."}
        {copyState === "failure" &&
          "Não foi possível copiar automaticamente. Selecione o link abaixo."}
      </p>
      {copyState === "failure" && (
        <label className={styles.shareFallback}>
          Link para copiar
          <input value={shareUrl} readOnly onFocus={(event) => event.target.select()} />
        </label>
      )}
    </section>
  );
}
