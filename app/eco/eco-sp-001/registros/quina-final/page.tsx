import type { Metadata } from "next";
import { Suspense } from "react";
import FounderRecord from "./FounderRecord";
import styles from "./FounderRecord.module.css";

export const metadata: Metadata = {
  title: "Registro final do agente Quina | E.C.O.",
  description: "Registro operacional reservado da missão ECO-SP-001.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function FounderRecordPage() {
  return (
    <main className={styles.shell} lang="pt-BR">
      <Suspense fallback={<p className={styles.state}>VALIDANDO ACESSO...</p>}>
        <FounderRecord />
      </Suspense>
    </main>
  );
}
