"use client";

import Script from "next/script";
import { useEffect } from "react";

export default function Page() {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.href = "https://docs.google.com/forms/d/e/1FAIpQLSeC9F_1q9qkvU5hqKmohLFuQoBENY9paETIwMi-NhoiSy-xBg/viewform?usp=dialog";
    }, 1500);

    return () => clearTimeout(timer);
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