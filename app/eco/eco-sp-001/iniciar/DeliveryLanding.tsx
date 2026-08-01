"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FiArrowRight, FiExternalLink } from "react-icons/fi";
import { safePosthogCapture } from "../../../analytics/posthog";
import {
  buildCaseAnswerPath,
  normalizeDeliveryReference,
} from "../delivery-reference.mjs";
import {
  buildDeliveryOpenEndpoint,
  isTrackableDeliveryLandingHostname,
  sendDeliveryOpen,
} from "../delivery-open-tracking.mjs";
import styles from "./DeliveryLanding.module.css";

const DOSSIER_PATH = "/eco/eco-sp-001/eco-sp-001-atalho.pdf";
const EVENT_PROPERTIES = {
  case_id: "eco-sp-001",
  material_type: "pdf",
} as const;

function readDeliveryReference() {
  return normalizeDeliveryReference(
    new URLSearchParams(window.location.search).get("delivery"),
  );
}

export default function DeliveryActions() {
  const viewCapturedRef = useRef(false);
  const openTrackingStartedRef = useRef(false);
  const [deliveryReference, setDeliveryReference] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const reference = readDeliveryReference();
    setDeliveryReference(reference);

    if (!viewCapturedRef.current) {
      viewCapturedRef.current = true;
      safePosthogCapture("eco_case_delivery_landing_viewed", {
        ...EVENT_PROPERTIES,
        ...(reference ? { delivery_reference: reference } : {}),
      });
    }

    const endpoint = buildDeliveryOpenEndpoint(
      process.env.NEXT_PUBLIC_LIBERULA_SUPABASE_URL,
    );
    if (
      !reference || !endpoint ||
      !isTrackableDeliveryLandingHostname(window.location.hostname)
    ) return;

    const sendOnce = () => {
      if (openTrackingStartedRef.current) return;
      openTrackingStartedRef.current = true;
      void sendDeliveryOpen(endpoint, reference).catch(() => {
        if (process.env.NODE_ENV === "development") {
          console.warn("Delivery open tracking failed.");
        }
      });
    };

    if (document.visibilityState === "visible") {
      sendOnce();
      return;
    }

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      sendOnce();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener(
      "visibilitychange",
      onVisibilityChange,
    );
  }, []);

  function trackDossierOpen() {
    const reference = readDeliveryReference();
    safePosthogCapture("eco_case_dossier_opened", {
      ...EVENT_PROPERTIES,
      ...(reference ? { delivery_reference: reference } : {}),
    });
  }

  return (
    <div className={styles.actions}>
      <a
        className={styles.primaryAction}
        href={DOSSIER_PATH}
        target="_blank"
        rel="noopener noreferrer"
        onClick={trackDossierOpen}
      >
        ABRIR DOSSIÊ
        <FiExternalLink aria-hidden="true" />
        <span className={styles.visuallyHidden}>(abre em uma nova aba)</span>
      </a>

      <p className={styles.nextStep}>
        Depois de analisar o material, retorne ao canal de resposta para
        registrar sua conclusão.
      </p>
      <Link
        className={styles.secondaryAction}
        href={buildCaseAnswerPath(deliveryReference)}
      >
        ACESSAR CANAL DE RESPOSTA
        <FiArrowRight aria-hidden="true" />
      </Link>
    </div>
  );
}
