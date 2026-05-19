import type { Metadata } from "next";
import "../globals.css";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export const metadata: Metadata = {
  title: "Liberula",
  description:
    "Games where your choices matter. Liberula creates gameplay-focused experiences built around agency, discovery and consequence.",
};

export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Navbar />
      {children}
      <Footer />
    </>
  );
}