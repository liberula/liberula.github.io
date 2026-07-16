import posthog from "posthog-js";

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;
const isDevelopment = process.env.NODE_ENV !== "production";

let initializationAttempted = false;
let initialized = false;
let lastPageviewUrl: string | null = null;

export function initializePosthog(): boolean {
  if (typeof window === "undefined") return false;
  if (initialized) return true;
  if (initializationAttempted) return false;

  initializationAttempted = true;

  if (!posthogKey || !posthogHost) {
    if (isDevelopment) {
      console.info("[PostHog] skipped, missing configuration");
    }
    return false;
  }

  try {
    posthog.init(posthogKey, {
      api_host: posthogHost,
      capture_pageview: false,
      capture_pageleave: true,
      person_profiles: "identified_only",
    });
    initialized = true;

    if (isDevelopment) {
      console.info("[PostHog] initialized");
    }

    return true;
  } catch (error) {
    if (isDevelopment) {
      console.warn("[PostHog] initialization failed", error);
    }
    return false;
  }
}

export function isPosthogReady(): boolean {
  return initialized;
}

export function safePosthogCapture(
  event: string,
  properties?: Record<string, unknown>,
): boolean {
  try {
    if (!initializePosthog() || !isPosthogReady()) return false;
    posthog.capture(event, properties);
    return true;
  } catch (error) {
    if (isDevelopment) {
      console.warn("[PostHog] capture failed", error);
    }
    return false;
  }
}

export function capturePosthogPageview(currentUrl: string): void {
  if (lastPageviewUrl === currentUrl) return;

  if (
    safePosthogCapture("$pageview", {
      $current_url: currentUrl,
    })
  ) {
    lastPageviewUrl = currentUrl;
  }
}
