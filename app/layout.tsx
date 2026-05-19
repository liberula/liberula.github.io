import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}