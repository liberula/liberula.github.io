import type { Metadata } from "next";
import Image from "next/image";
import EcoCaseExperience from "./EcoCaseExperience";
import styles from "./EcoCase.module.css";

const title = "Caso ECO-SP-001 | E.C.O.";
const description =
  "Analise as evidências do caso ECO-SP-001 e registre sua conclusão.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "https://liberula.com/eco/eco-sp-001/",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function EcoSp001Page() {
  return (
    <main className={styles.page} lang="pt-BR">
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
          <span className={styles.caseCode}>CASO: ECO-SP-001</span>
        </div>
      </header>

      <div className={`${styles.container} ${styles.content}`}>
        <EcoCaseExperience />
      </div>
    </main>
  );
}
