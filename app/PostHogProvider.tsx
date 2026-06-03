"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

export function PostHogProvider() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

    console.log("POSTHOG ENV", { key, host });

    if (!key || !host) {
      console.warn("PostHog disabled: missing env vars");
      return;
    }

    posthog.init(key, {
      api_host: host,
      capture_pageview: true,
    });

    console.log("POSTHOG INIT DONE");
  }, []);

  return null;
}