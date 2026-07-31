import type { Metadata } from "next";
import "./globals.css";
import { GoatCounterScript } from "./GoatCounterScript";
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
        <PostHogProvider
          apiKey={process.env.NEXT_PUBLIC_POSTHOG_KEY}
          apiHost={process.env.NEXT_PUBLIC_POSTHOG_HOST}
        >
          {children}
        </PostHogProvider>

        <GoatCounterScript />
      </body>
    </html>
  );
}
