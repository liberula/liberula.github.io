console.log("INSTRUMENTATION CLIENT LOADED");

import posthog from "posthog-js";

if (typeof window !== "undefined") {
  console.log("POSTHOG INIT START", {
    key: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  });

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST!,
    capture_pageview: true,
  });

  console.log("POSTHOG INIT DONE");
}