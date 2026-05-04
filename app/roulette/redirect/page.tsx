"use client";

import Script from "next/script";
import { useEffect } from "react";

declare global {
  interface Window {
    goatcounter?: {
      count?: (data: {
        path: string;
        title?: string;
        event?: boolean;
      }) => void;
    };
  }
}

const FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSfR7RVabQvpCAsfRF0GrDdSSK9KPa51nJkGQB2C3emfByTuyQ/viewform?usp=publish-editor";

export default function Page() {
  useEffect(() => {
    const trackClick = () => {
      if (window.goatcounter?.count) {
        window.goatcounter.count({
          path: "roulette_play_now",
          title: "Roulette Play Now",
          event: true,
        });
      }
    };

    const trackTimer = setTimeout(trackClick, 300);

    const redirectTimer = setTimeout(() => {
      window.location.href = FORM_URL;
    }, 1500);

    return () => {
      clearTimeout(trackTimer);
      clearTimeout(redirectTimer);
    };
  }, []);

  return (
    <>
      <Script
        data-goatcounter="https://liberula.goatcounter.com/count"
        src="https://gc.zgo.at/count.js"
        strategy="afterInteractive"
      />

      <main
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 999999,
          background: "#000",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Verdana, sans-serif",
          fontSize: 18,
        }}
      >
        Redirecting...
      </main>
    </>
  );
}