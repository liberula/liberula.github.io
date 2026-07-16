"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  capturePosthogPageview,
  initializePosthog,
} from "./analytics/posthog";

export function PostHogProvider() {
  const pathname = usePathname();

  useEffect(() => {
    initializePosthog();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    capturePosthogPageview(window.location.href);
  }, [pathname]);

  return null;
}
