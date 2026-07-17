import type { Metadata } from "next";
import EcoLanding from "./EcoLanding";

const title = "Recrutamento E.C.O. | Processo de Admissão";
const description =
  "Participe gratuitamente da primeira etapa do processo de recrutamento da E.C.O. Analise as instruções e descubra se sua candidatura será aceita.";

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
        alt: "Documentos confidenciais do processo de recrutamento da E.C.O.",
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
