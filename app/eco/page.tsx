import type { Metadata } from "next";
import EcoLanding from "./EcoLanding";

const title = "E.C.O. | Processo de Seleção 74-B";
const description =
  "Uma experiência investigativa física e digital enviada diretamente para sua casa. Entre na lista da primeira convocação da E.C.O.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "https://liberula.com/eco/",
  },
  openGraph: {
    title,
    description,
    type: "website",
    url: "https://liberula.com/eco/",
    siteName: "E.C.O.",
    locale: "pt_BR",
    images: [
      {
        url: "https://liberula.com/eco/eco-og.png",
        width: 1440,
        height: 900,
        alt: "Landing da primeira convocação da E.C.O.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["https://liberula.com/eco/eco-og.png"],
  },
};

export default function EcoPage() {
  return <EcoLanding />;
}
