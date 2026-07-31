"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";

export function GoatCounterScript() {
  const pathname = usePathname();
  if (pathname?.startsWith("/internal/")) return null;
  return (
    <Script
      data-goatcounter="https://liberula.goatcounter.com/count"
      async
      src="//gc.zgo.at/count.js"
      strategy="afterInteractive"
    />
  );
}
