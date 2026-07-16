"use client";

import Image from "next/image";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  FiArrowRight,
  FiEye,
  FiLock,
  FiMail,
  FiShield,
  FiUser,
} from "react-icons/fi";
import { readEcoAttribution, submitEcoLead } from "./lead";
import {
  trackEcoLead,
  trackEcoPageView,
  trackEcoViewContent,
} from "./tracking";
import styles from "./EcoLanding.module.css";

type FormErrors = Partial<Record<"firstName" | "email", string>>;
type SubmitState = "idle" | "submitting" | "success" | "error";

const features = [
  {
    icon: FiMail,
    title: "Uma correspondência física",
    description:
      "Um envelope com documentos, registros e evidências que precisam ser examinados.",
  },
  {
    icon: FiEye,
    title: "Um caso inexplicável",
    description:
      "Uma investigação na fronteira entre o real, o sobrenatural e aquilo que foi oficialmente ocultado.",
  },
  {
    icon: FiLock,
    title: "Um acesso secreto",
    description:
      "As pistas físicas revelam as credenciais necessárias para continuar a investigação online.",
  },
];

function EcoBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`${styles.brand} ${compact ? styles.brandCompact : ""}`}>
      <Image
        className={styles.brandEmblem}
        src="/eco/eco-emblem.webp"
        width={compact ? 52 : 66}
        height={compact ? 52 : 66}
        alt=""
        aria-hidden="true"
      />
      <div>
        <p className={styles.brandName}>E.C.O.</p>
        <p className={styles.brandMotto}>Encontrar. Conter. Ocultar.</p>
      </div>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className={styles.eyebrow}>{children}</p>;
}

export default function EcoLanding() {
  const heroRef = useRef<HTMLElement>(null);
  const submittingRef = useRef(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");

  useEffect(() => {
    const attribution = readEcoAttribution();
    trackEcoPageView(attribution);

    const hero = heroRef.current;
    if (!hero) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          trackEcoViewContent(attribution);
          observer.disconnect();
        }
      },
      { threshold: 0.45 },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  function scrollToForm() {
    document.getElementById("cadastro-eco")?.scrollIntoView({ behavior: "smooth" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || submitState === "success") return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const firstName = String(formData.get("firstName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const nextErrors: FormErrors = {};

    if (!firstName) nextErrors.firstName = "Informe seu primeiro nome.";
    if (!email) nextErrors.email = "Informe seu e-mail.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "Informe um e-mail válido.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    submittingRef.current = true;
    setSubmitState("submitting");

    try {
      const attribution = readEcoAttribution();
      await submitEcoLead({
        firstName,
        email,
        attribution,
        sourceUrl: window.location.href,
      });
      trackEcoLead(attribution);
      setSubmitState("success");
      form.reset();
    } catch {
      setSubmitState("error");
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <main id="eco-landing" className={styles.page} lang="pt-BR">
      <header className={styles.header}>
        <div className={styles.container}>
          <EcoBrand />
          <div className={styles.protocol} aria-label="Status do protocolo">
            <span>PROTOCOLO 74-B / SP / 25</span>
            <span className={styles.status}>
              <i aria-hidden="true" /> EM DESENVOLVIMENTO
            </span>
          </div>
        </div>
      </header>

      <section className={styles.hero} ref={heroRef} aria-labelledby="eco-title">
        <div className={`${styles.container} ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <Eyebrow>CONVOCAÇÃO 74-B</Eyebrow>
            <h1 id="eco-title">
              A próxima correspondência
              <span>não será comum.</span>
            </h1>
            <div className={styles.heroText}>
              <p>
                A E.C.O. está preparando uma experiência investigativa física e
                digital, enviada diretamente para sua casa.
              </p>
              <p>
                Examine documentos, investigue um caso entre o real e o
                inexplicável e encontre o acesso para algo que oficialmente não
                existe.
              </p>
            </div>
            <button className={styles.primaryButton} type="button" onClick={scrollToForm}>
              QUERO RECEBER A CONVOCAÇÃO <FiArrowRight aria-hidden="true" />
            </button>
          </div>
          <div className={styles.heroVisual}>
            <Image
              src="/eco/hero-dossier.webp"
              width={1448}
              height={1086}
              priority
              sizes="(max-width: 767px) 100vw, 62vw"
              alt="Envelope da E.C.O. cercado por documentos, relatório, fotografia e ficha técnica do caso"
            />
          </div>
        </div>
      </section>

      <section className={styles.intro} aria-labelledby="o-que-e">
        <div className={styles.container}>
          <div className={styles.sectionHeading}>
            <Eyebrow>O QUE É</Eyebrow>
            <h2 id="o-que-e">Um mistério<br />que começa no correio.</h2>
            <p>
              A primeira convocação da E.C.O. será uma experiência investigativa
              composta por documentos físicos, evidências e um acesso oculto online.
            </p>
          </div>
          <div className={styles.features}>
            {features.map(({ icon: Icon, title, description }) => (
              <article key={title} className={styles.feature}>
                <Icon aria-hidden="true" />
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.institution} aria-labelledby="processo-74-b">
        <div className={`${styles.container} ${styles.institutionGrid}`}>
          <Image
            className={styles.stamp}
            src="/eco/eco-stamp.webp"
            width={420}
            height={420}
            alt="Carimbo E.C.O., Encontrar, Conter, Ocultar, São Paulo, Brasil"
          />
          <div className={styles.institutionCopy}>
            <Eyebrow>PROCESSO DE SELEÇÃO 74-B</Eyebrow>
            <h2 id="processo-74-b">
              A E.C.O. existe para encontrar, conter e ocultar ocorrências que não
              deveriam fazer parte da realidade conhecida.
            </h2>
            <p>
              Periodicamente, novos candidatos são convidados a analisar casos não
              resolvidos.
            </p>
            <strong>A próxima seleção ainda não foi autorizada.</strong>
          </div>
          <Image
            className={styles.watermark}
            src="/eco/eco-emblem.webp"
            width={480}
            height={480}
            alt=""
            aria-hidden="true"
          />
        </div>
      </section>

      <section className={styles.signup} id="cadastro-eco" aria-labelledby="receba-aviso">
        <div className={`${styles.container} ${styles.signupGrid}`}>
          <div className={styles.signupCopy}>
            <Eyebrow>RECEBA O AVISO</Eyebrow>
            <h2 id="receba-aviso">Receba o aviso da<br />primeira convocação.</h2>
            <div className={styles.priceCard} aria-label="Preço: 79 reais, envio incluído">
              <span>R$</span>
              <strong>79</strong>
              <small>ENVIO INCLUÍDO</small>
            </div>
            <p>
              A primeira convocação custará R$ 79, com envio incluído.
            </p>
            <p>
              Cadastre-se para acompanhar o desenvolvimento e receber acesso
              antecipado quando o Processo de Seleção 74-B começar.
            </p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <label htmlFor="eco-first-name">Primeiro nome</label>
              <div className={styles.inputWrap}>
                <FiUser aria-hidden="true" />
                <input
                  id="eco-first-name"
                  name="firstName"
                  type="text"
                  autoComplete="given-name"
                  placeholder="Primeiro nome"
                  aria-invalid={Boolean(errors.firstName)}
                  aria-describedby={errors.firstName ? "eco-name-error" : undefined}
                />
              </div>
              {errors.firstName && <p id="eco-name-error" className={styles.fieldError}>{errors.firstName}</p>}
            </div>

            <div className={styles.field}>
              <label htmlFor="eco-email">E-mail</label>
              <div className={styles.inputWrap}>
                <FiMail aria-hidden="true" />
                <input
                  id="eco-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="E-mail"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "eco-email-error" : undefined}
                />
              </div>
              {errors.email && <p id="eco-email-error" className={styles.fieldError}>{errors.email}</p>}
            </div>

            <button
              className={styles.submitButton}
              type="submit"
              disabled={submitState === "submitting" || submitState === "success"}
            >
              {submitState === "submitting" ? "REGISTRANDO..." : "ENTRAR NA LISTA DE CANDIDATOS"}
              <FiArrowRight aria-hidden="true" />
            </button>

            <p className={styles.disclaimer} id="eco-form-disclaimer">
              <FiShield aria-hidden="true" />
              <span>
                O cadastro não representa compra, assinatura ou aprovação no processo.
                Ao se cadastrar, você confirma que tem interesse em receber a primeira
                convocação pelo valor de R$ 79, com envio incluído.
              </span>
            </p>

            <div className={styles.formStatus} role="status" aria-live="polite">
              {submitState === "success" && (
                <p className={styles.success}>
                  <strong>Cadastro recebido.</strong>
                  Se a primeira convocação for autorizada, a E.C.O. entrará em contato.
                </p>
              )}
              {submitState === "error" && (
                <p className={styles.error}>
                  Não foi possível registrar seu cadastro. Tente novamente em instantes.
                </p>
              )}
            </div>
          </form>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerInner}`}>
          <EcoBrand compact />
          <div className={styles.liberulaCredit}>
            <span>Uma experiência em desenvolvimento pela</span>
            <Image
              src="/eco/liberula-mark.svg"
              width={42}
              height={42}
              alt="Liberula"
            />
            <strong>LIBERULA</strong>
          </div>
        </div>
      </footer>
    </main>
  );
}
