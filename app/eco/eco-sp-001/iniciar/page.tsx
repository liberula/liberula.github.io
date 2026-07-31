import type { Metadata } from "next";
import Image from "next/image";
import { FiFileText } from "react-icons/fi";
import styles from "../EcoCase.module.css";
import DeliveryActions from "./DeliveryLanding";
import deliveryStyles from "./DeliveryLanding.module.css";

export const metadata: Metadata = {
  title: "Caso ECO-SP-001 | Material de avaliação",
  description:
    "Acesse o material de avaliação do caso ECO-SP-001 e consulte as instruções para registrar sua conclusão.",
  alternates: {
    canonical: "https://liberula.com/eco/eco-sp-001/iniciar/",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function EcoSp001DeliveryPage() {
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
              priority
            />
            <div>
              <strong>E.C.O.</strong>
              <span>ENCONTRAR. CONTER. OCULTAR.</span>
            </div>
          </div>
          <span className={styles.caseCode}>CASO: ECO-SP-001</span>
        </div>
      </header>

      <div className={`${styles.container} ${styles.purchaseContent}`}>
        <section
          className={deliveryStyles.delivery}
          aria-labelledby="delivery-title"
        >
          <div className={deliveryStyles.classification}>
            <span>TRANSMISSÃO AUTORIZADA</span>
            <span>CLASSIFICAÇÃO: RESTRITO</span>
          </div>

          <div className={deliveryStyles.documentMark} aria-hidden="true">
            <FiFileText />
            <span>ECO-SP-001</span>
          </div>

          <p className={deliveryStyles.eyebrow}>CASO ECO-SP-001</p>
          <h1 id="delivery-title">Material de avaliação disponível</h1>
          <p className={deliveryStyles.lead}>
            Você recebeu acesso a um dossiê investigativo recuperado. O arquivo
            contém o material necessário para identificar uma localização.
          </p>

          <section
            className={deliveryStyles.instructions}
            aria-labelledby="analysis-protocol"
          >
            <h2 id="analysis-protocol">PROTOCOLO DE ANÁLISE</h2>
            <p>
              Examine os documentos antes de registrar sua conclusão. Depois
              do envio da resposta, preserve o dossiê para consulta.
            </p>
          </section>

          <DeliveryActions />
        </section>
      </div>
    </main>
  );
}
