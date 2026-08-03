import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import styles from "../EcoCase.module.css";
import PurchaseExperience from "./PurchaseExperience";

export const metadata: Metadata = {
  title: "Financiar a próxima missão digital | E.C.O.",
  description:
    "Reserve acesso fundador à próxima missão digital da E.C.O. e continue para o pagamento seguro.",
  robots: {
    index: false,
    follow: false,
  },
};

function PurchaseLoading() {
  return (
    <section className={styles.purchaseFormPanel} aria-busy="true">
      <p className={styles.protocol}>CARREGANDO REGISTRO</p>
      <h1>Preparando participação</h1>
      <p>Aguarde um instante.</p>
    </section>
  );
}

export default function EcoPurchasePage() {
  return (
    <main className={styles.statusPage} lang="pt-BR">
      <header className={styles.header}>
        <div className={`${styles.container} ${styles.headerInner}`}>
          <div className={styles.brand}>
            <Image
              src="/eco/eco-emblem.webp"
              width={46}
              height={46}
              alt=""
              aria-hidden="true"
            />
            <div>
              <strong>E.C.O.</strong>
              <span>ENCONTRAR. CONTER. OCULTAR.</span>
            </div>
          </div>
          <span className={styles.caseCode}>MISSÃO DIGITAL / ACESSO FUNDADOR</span>
        </div>
      </header>

      <div className={`${styles.container} ${styles.purchaseContent}`}>
        <Suspense fallback={<PurchaseLoading />}>
          <PurchaseExperience />
        </Suspense>
      </div>
    </main>
  );
}
