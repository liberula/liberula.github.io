"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { FiArrowRight, FiCheck, FiFileText, FiMail, FiShield, FiUser } from "react-icons/fi";
import {
  EcoLeadSubmissionError,
  readEcoAttribution,
  submitEcoLead,
} from "./lead";
import {
  ECO_RECRUITMENT_END_LABEL,
  getEcoCountdown,
  isEcoRecruitmentClosed,
  type EcoCountdown,
} from "./deadline";
import {
  trackEcoClosedView,
  trackEcoCtaClick,
  trackEcoEmailSubmitted,
  trackEcoFormError,
  trackEcoFormStarted,
  trackEcoLandingView,
} from "./tracking";
import styles from "./EcoLanding.module.css";

type FormField = "name" | "email" | "consent";
type FormErrors = Partial<Record<FormField, string>>;
type SubmitState = "idle" | "submitting" | "success" | "duplicate" | "error";

const processSteps = [
  { number: "01", title: "Candidatura", text: "Registre seus dados para receber as instruções iniciais." },
  { number: "02", title: "Avaliação", text: "Analise uma ocorrência digital e apresente sua conclusão." },
  { number: "03", title: "Admissão", text: "Candidatos aprovados poderão receber acesso às próximas etapas." },
];

function EcoBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`${styles.brand} ${compact ? styles.brandCompact : ""}`}>
      <Image className={styles.brandEmblem} src="/eco/eco-emblem.webp" width={compact ? 52 : 66} height={compact ? 52 : 66} alt="" aria-hidden="true" />
      <div><p className={styles.brandName}>E.C.O.</p><p className={styles.brandMotto}>Encontrar. Conter. Ocultar.</p></div>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className={styles.eyebrow}>{children}</p>;
}

export default function EcoLanding() {
  const submittingRef = useRef(false);
  const leadTrackedRef = useRef(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState("");
  const [isClosed, setIsClosed] = useState(false);
  const [countdown, setCountdown] = useState<EcoCountdown | null>(null);

  useEffect(() => {
    const attribution = readEcoAttribution();
    trackEcoLandingView(attribution);

    function refreshDeadline() {
      const closed = isEcoRecruitmentClosed();
      setIsClosed(closed);
      setCountdown(closed ? { days: 0, hours: 0, minutes: 0 } : getEcoCountdown());
      if (closed) trackEcoClosedView();
    }

    refreshDeadline();
    const interval = window.setInterval(refreshDeadline, 1_000);
    return () => window.clearInterval(interval);
  }, []);

  function scrollToForm() {
    trackEcoCtaClick("hero");
    document.getElementById("candidatura-eco")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function reportValidationErrors(nextErrors: FormErrors) {
    (Object.entries(nextErrors) as Array<[FormField, string]>).forEach(([field, message]) => {
      trackEcoFormError(field, message.includes("obrigatório") ? "required" : "invalid");
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || submitState === "success" || submitState === "duplicate") return;
    if (isEcoRecruitmentClosed()) {
      setIsClosed(true);
      trackEcoClosedView();
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const consent = formData.get("consent") === "on";
    const website = String(formData.get("website") ?? "");
    const nextErrors: FormErrors = {};

    if (name.length < 2) nextErrors.name = "Informe um nome com pelo menos 2 caracteres.";
    if (!email) nextErrors.email = "O e-mail é obrigatório.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = "Informe um e-mail válido.";
    if (!consent) nextErrors.consent = "O consentimento é obrigatório.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      reportValidationErrors(nextErrors);
      return;
    }

    submittingRef.current = true;
    setSubmitState("submitting");
    setSubmitError("");
    try {
      const attribution = readEcoAttribution();
      const result = await submitEcoLead({
        name,
        email,
        consent: true,
        website,
        attribution,
        sourceUrl: window.location.href,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
      });
      if (!result.duplicate && !leadTrackedRef.current) {
        trackEcoEmailSubmitted(attribution);
        leadTrackedRef.current = true;
      }
      setSubmitState(result.duplicate ? "duplicate" : "success");
      form.reset();
    } catch (error) {
      const errorKind = error instanceof EcoLeadSubmissionError ? error.kind : "submission";
      setSubmitState("error");
      setSubmitError(
        errorKind === "configuration" && process.env.NODE_ENV !== "production"
          ? "Endpoint de formulário não configurado."
          : "Não foi possível registrar sua candidatura agora. Tente novamente em instantes.",
      );
      trackEcoFormError("form", errorKind);
    } finally {
      submittingRef.current = false;
    }
  }

  const succeeded = submitState === "success" || submitState === "duplicate";

  return (
    <main id="eco-landing" className={styles.page} lang="pt-BR">
      <header className={styles.header}>
        <div className={styles.container}>
          <EcoBrand />
          <div className={styles.protocol} aria-label="Status do recrutamento">
            <span>PROTOCOLO DE ADMISSÃO / SP</span>
            <span className={styles.status}><i aria-hidden="true" /> {isClosed ? "FASE ENCERRADA" : "RECRUTAMENTO ATIVO"}</span>
          </div>
        </div>
      </header>

      <section className={styles.hero} aria-labelledby="eco-title">
        <div className={`${styles.container} ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <Eyebrow>CLASSIFICAÇÃO: RESTRITO</Eyebrow>
            <h1 id="eco-title">Uma organização que oficialmente não existe <span>está recrutando.</span></h1>
            <p className={styles.heroText}>Participe gratuitamente da primeira etapa do processo de admissão da E.C.O. Analise os documentos, siga as instruções e descubra se sua candidatura será aceita.</p>
            <button className={styles.primaryButton} type="button" onClick={scrollToForm}>INICIAR RECRUTAMENTO <FiArrowRight aria-hidden="true" /></button>
            <p className={styles.microcopy}>Nenhum pagamento será solicitado nesta etapa.</p>
            {ECO_RECRUITMENT_END_LABEL && (
              <div className={styles.heroDeadline}>
                <span>Esta janela de recrutamento será encerrada em:</span>
                <strong aria-live="off">
                  {countdown
                    ? `${countdown.days} dias ${countdown.hours} horas ${countdown.minutes} minutos`
                    : "Prazo em atualização"}
                </strong>
                <time>{`Inscrições abertas até ${ECO_RECRUITMENT_END_LABEL}.`}</time>
              </div>
            )}
          </div>
          <div className={styles.heroVisual}>
            <Image src="/eco/hero-dossier.webp" width={1448} height={1086} priority sizes="(max-width: 767px) 110vw, 62vw" alt="Envelope e documentos confidenciais da E.C.O." />
          </div>
        </div>
      </section>

      <section className={styles.context} aria-labelledby="contexto-eco">
        <div className={`${styles.container} ${styles.contextGrid}`}>
          <Image className={styles.stamp} src="/eco/eco-stamp.webp" width={420} height={420} alt="Carimbo E.C.O., Encontrar, Conter, Ocultar" />
          <div>
            <Eyebrow>OBSERVAÇÃO PRELIMINAR</Eyebrow>
            <h2 id="contexto-eco">A maioria das pessoas nunca percebe o que está acontecendo ao seu redor.</h2>
            <p>Algumas percebem. Poucas sabem o que fazer com essa informação.</p>
            <strong>A E.C.O. está procurando essas pessoas.</strong>
          </div>
        </div>
      </section>

      <section className={styles.process} aria-labelledby="processo-eco">
        <div className={styles.container}>
          <div className={styles.sectionHeading}><Eyebrow>PROCESSO DE ADMISSÃO</Eyebrow><h2 id="processo-eco">O processo</h2></div>
          <div className={styles.steps}>
            {processSteps.map((step) => (
              <article className={styles.step} key={step.number}>
                <span>{step.number}</span><FiFileText aria-hidden="true" /><h3>{step.title}</h3><p>{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.signup} id="candidatura-eco" aria-labelledby="registrar-candidatura">
        <div className={`${styles.container} ${styles.signupGrid}`}>
          <div className={styles.signupCopy}>
            <Eyebrow>REGISTRO CONFIDENCIAL</Eyebrow>
            <h2 id="registrar-candidatura">Registrar candidatura</h2>
            <p>A primeira etapa acontece online e é gratuita. Se sua candidatura avançar, as próximas instruções serão enviadas por e-mail.</p>
            <div className={styles.deadlineNotice}>
              Esta janela de recrutamento ficará aberta por tempo limitado.
              {ECO_RECRUITMENT_END_LABEL && <strong>{` Inscrições abertas até ${ECO_RECRUITMENT_END_LABEL}.`}</strong>}
            </div>
          </div>

          <div className={styles.formPanel}>
            {isClosed ? (
              <div className={styles.closed} role="status"><span>STATUS: FASE ENCERRADA</span><h3>O recrutamento desta fase foi encerrado.</h3><p>Novas instruções serão divulgadas quando uma próxima janela de seleção for autorizada.</p></div>
            ) : succeeded ? (
              <div className={styles.confirmation} role="status" aria-live="polite">
                <span><FiCheck aria-hidden="true" /> STATUS: CANDIDATURA RECEBIDA</span>
                <h3>{submitState === "duplicate" ? "Sua candidatura já está registrada." : "Sua candidatura foi registrada."}</h3>
                <p>As próximas instruções serão enviadas para o e-mail informado. Verifique também as pastas de spam e promoções.</p>
                <strong>Não compartilhe instruções, documentos ou códigos recebidos durante o processo.</strong>
              </div>
            ) : (
              <form className={styles.form} onSubmit={handleSubmit} onFocusCapture={trackEcoFormStarted} noValidate>
                <div className={styles.honeypot} aria-hidden="true">
                  <label htmlFor="eco-website">Website</label>
                  <input id="eco-website" name="website" type="text" autoComplete="off" tabIndex={-1} />
                </div>
                <div className={styles.field}>
                  <label htmlFor="eco-name">Nome</label>
                  <div className={styles.inputWrap}><FiUser aria-hidden="true" /><input id="eco-name" name="name" type="text" autoComplete="name" placeholder="Nome" minLength={2} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "eco-name-error" : undefined} /></div>
                  {errors.name && <p id="eco-name-error" className={styles.fieldError}>{errors.name}</p>}
                </div>
                <div className={styles.field}>
                  <label htmlFor="eco-email">E-mail</label>
                  <div className={styles.inputWrap}><FiMail aria-hidden="true" /><input id="eco-email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="E-mail" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "eco-email-error" : undefined} /></div>
                  {errors.email && <p id="eco-email-error" className={styles.fieldError}>{errors.email}</p>}
                </div>
                <div className={styles.consentField}>
                  <input id="eco-consent" name="consent" type="checkbox" aria-invalid={Boolean(errors.consent)} aria-describedby={errors.consent ? "eco-consent-error" : "eco-privacy-note"} />
                  <label htmlFor="eco-consent">Concordo em receber comunicações relacionadas ao processo de recrutamento da E.C.O.</label>
                </div>
                {errors.consent && <p id="eco-consent-error" className={styles.fieldError}>{errors.consent}</p>}
                <p id="eco-privacy-note" className={styles.privacyNote}><FiShield aria-hidden="true" /> Seus dados serão tratados conforme a <Link href="/privacy-policy/">política de privacidade</Link>.</p>
                <button className={styles.submitButton} type="submit" disabled={submitState === "submitting"}>{submitState === "submitting" ? "ENVIANDO..." : "ENVIAR CANDIDATURA"}<FiArrowRight aria-hidden="true" /></button>
                <div className={styles.formStatus} role="alert" aria-live="polite">{submitState === "error" && <p>{submitError}</p>}</div>
              </form>
            )}
          </div>
        </div>
      </section>

      <footer className={styles.footer}><div className={`${styles.container} ${styles.footerInner}`}><EcoBrand compact /><div className={styles.liberulaCredit}><span>Uma experiência da</span><Image src="/eco/liberula-mark.svg" width={42} height={42} alt="Liberula" /><strong>LIBERULA</strong></div></div></footer>
    </main>
  );
}
