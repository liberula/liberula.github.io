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

  useLayoutEffect(() => {
    initializePosthog(apiKey, apiHost);
  }, [apiHost, apiKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    capturePosthogPageview(window.location.href);
  }, [pathname]);

  return children;
}
