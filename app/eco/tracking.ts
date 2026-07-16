import { safePosthogCapture } from "../analytics/posthog";
import type { EcoAttribution } from "./lead";

type MetaPixel = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  loaded?: boolean;
  version?: string;
  push?: MetaPixel;
};

declare global {
  interface Window {
    fbq?: MetaPixel;
    _fbq?: MetaPixel;
  }
}

let initialized = false;
let pageViewTracked = false;
let viewContentTracked = false;

function getEcoPosthogProperties(attribution: EcoAttribution) {
  return {
    product: "eco-convocacao-74b",
    price_reference: 79,
    utm_source: attribution.utm_source,
    utm_medium: attribution.utm_medium,
    utm_campaign: attribution.utm_campaign,
    utm_content: attribution.utm_content,
    utm_term: attribution.utm_term,
  };
}

function getMetaPixel(): MetaPixel | null {
  if (typeof window === "undefined") return null;

  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if (!pixelId) return null;

  if (!initialized) {
    const existing = window.fbq;

    if (!existing) {
      const fbq: MetaPixel = (...args: unknown[]) => {
        if (fbq.callMethod) fbq.callMethod(...args);
        else fbq.queue?.push(args);
      };
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = "2.0";
      fbq.queue = [];
      window.fbq = fbq;
      window._fbq = fbq;

      const script = document.createElement("script");
      script.async = true;
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      document.head.appendChild(script);
    }

    window.fbq?.("init", pixelId);
    initialized = true;
  }

  return window.fbq ?? null;
}

export function trackEcoPageView(attribution: EcoAttribution): void {
  if (pageViewTracked) return;
  safePosthogCapture("eco_page_view", getEcoPosthogProperties(attribution));
  const fbq = getMetaPixel();
  fbq?.("track", "PageView");
  pageViewTracked = true;
}

export function trackEcoViewContent(attribution: EcoAttribution): void {
  if (viewContentTracked) return;
  safePosthogCapture("eco_view_content", getEcoPosthogProperties(attribution));
  const fbq = getMetaPixel();
  fbq?.("track", "ViewContent", {
    content_name: "Convocação 74-B",
    content_ids: ["eco-convocacao-74b"],
    content_type: "product",
    value: 79,
    currency: "BRL",
  });
  viewContentTracked = true;
}

export function trackEcoLead(attribution: EcoAttribution): void {
  safePosthogCapture("eco_lead", getEcoPosthogProperties(attribution));
  const fbq = getMetaPixel();
  fbq?.("track", "Lead", {
    content_name: "Convocação 74-B",
    content_ids: ["eco-convocacao-74b"],
    value: 79,
    currency: "BRL",
  });
}
