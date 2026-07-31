import type { Metadata } from "next";
import EcoDeliveryPanel from "./EcoDeliveryPanel";

export const metadata: Metadata = {
  title: "E.C.O. — Operações de entrega",
  robots: { index: false, follow: false },
};

export default function EcoDeliveryOperationsPage() {
  return <EcoDeliveryPanel />;
}
