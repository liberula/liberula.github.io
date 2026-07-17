import { safePosthogCapture } from "../analytics/posthog";
import { ECO_FUNNEL, type EcoAttribution } from "./lead";

type MetaPixel = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  loaded?: boolean;
  version?: string;
  push?: MetaPixel;
};

declare global {
  interface Window { fbq?: MetaPixel; _fbq?: MetaPixel; }
}

let pixelInitialized = false;
const trackedOnce = new Set<string>();

function getMetaPixel(): MetaPixel | null {
  if (typeof window === "undefined" || !process.env.NEXT_PUBLIC_META_PIXEL_ID) return null;
  if (!pixelInitialized) {
    if (!window.fbq) {
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
    window.fbq?.("init", process.env.NEXT_PUBLIC_META_PIXEL_ID);
    pixelInitialized = true;
  }
  return window.fbq ?? null;
}

function captureOnce(event: string, properties?: Record<string, unknown>): boolean {
  if (trackedOnce.has(event)) return false;
  trackedOnce.add(event);
  safePosthogCapture(event, properties);
  return true;
}

export function trackEcoLandingView(attribution: EcoAttribution): void {
  if (!captureOnce("eco_recruitment_landing_view", { funnel: ECO_FUNNEL, ...attribution })) return;
  getMetaPixel()?.("track", "PageView");
}

export function trackEcoCtaClick(location: string): void {
  safePosthogCapture("eco_recruitment_cta_click", { cta: "start_recruitment", location });
}

export function trackEcoFormStarted(): void {
  captureOnce("eco_recruitment_form_started", { funnel: ECO_FUNNEL });
}

export function trackEcoFormError(field: string, errorType: string): void {
  safePosthogCapture("eco_recruitment_form_error", { field, error_type: errorType });
}

export function trackEcoEmailSubmitted(attribution: EcoAttribution): void {
  if (!captureOnce("eco_recruitment_email_submitted", {
    utm_source: attribution.utm_source ?? "",
    utm_campaign: attribution.utm_campaign ?? "",
    funnel: ECO_FUNNEL,
  })) return;
  getMetaPixel()?.("track", "Lead");
}

export function trackEcoClosedView(): void {
  captureOnce("eco_recruitment_closed_view", { funnel: ECO_FUNNEL });
}
