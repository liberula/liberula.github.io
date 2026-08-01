import type { Metadata } from "next";
import EcoDeliveryPanel from "./EcoDeliveryPanel";

export const metadata: Metadata = {
  title: "E.C.O. — Envio de e-mails",
  robots: { index: false, follow: false },
};

export default function EcoDeliveryOperationsPage() {
  return <EcoDeliveryPanel />;
}
