import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { PostHogProvider } from "./PostHogProvider";

export const metadata: Metadata = {
  title: "Liberula",
  description:
    "Games where your choices matter. Liberula creates gameplay-focused experiences built around agency, discovery and consequence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <PostHogProvider />
        {children}

        <Script
          data-goatcounter="https://liberula.goatcounter.com/count"
          async
          src="//gc.zgo.at/count.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
