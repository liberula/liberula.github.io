"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect } from "react";
import {
  capturePosthogPageview,
  initializePosthog,
} from "./analytics/posthog";

type PostHogProviderProps = {
  apiKey?: string;
  apiHost?: string;
  children: React.ReactNode;
};

export function PostHogProvider({
  apiKey,
  apiHost,
  children,
}: PostHogProviderProps) {
  const pathname = usePathname();
  const isInternalRoute = pathname?.startsWith("/internal/") ?? false;

  useLayoutEffect(() => {
    if (isInternalRoute) return;
    initializePosthog(apiKey, apiHost);
  }, [apiHost, apiKey, isInternalRoute]);

  useEffect(() => {
    if (typeof window === "undefined" || isInternalRoute) return;
    capturePosthogPageview(window.location.href);
  }, [isInternalRoute, pathname]);

  return children;
}
