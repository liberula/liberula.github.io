import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import styles from "../EcoCase.module.css";
import PaymentStatusView from "./PaymentStatus";

export const metadata: Metadata = {
  title: "Status do pedido ECO-SP-001 | E.C.O.",
  description: "Consulte o estado registrado para seu pedido ECO-SP-001.",
  robots: {
    index: false,
    follow: false,
  },
};

function StatusLoadingFallback() {
  return (
    <section className={`${styles.statusCard} ${styles.statusPending}`}>
      <p className={styles.protocol}>CONSULTANDO PEDIDO</p>
      <h1>Preparando consulta</h1>
      <p>Aguarde um instante.</p>
    </section>
  );
}

export default function EcoSp001StatusPage() {
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
          <span className={styles.caseCode}>STATUS / ECO-SP-001</span>
        </div>
      </header>

      <div className={`${styles.container} ${styles.statusContent}`}>
        <Suspense fallback={<StatusLoadingFallback />}>
          <PaymentStatusView />
        </Suspense>
        <p className={styles.statusSecurityNote}>
          Esta página exibe somente o estado registrado pelo servidor. Parâmetros
          de retorno do checkout não confirmam pagamento.
        </p>
      </div>
    </main>
  );
}
