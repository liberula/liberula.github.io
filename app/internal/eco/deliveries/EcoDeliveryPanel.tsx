"use client";

import { useEffect, useMemo, useState } from "react";
import {
  filterParticipants,
  getOpeningState,
  getOperatorStatus,
  getSendActionLabel,
  isLocalOperatorHostname,
  isSendEligible,
  toggleParticipantSelection,
} from "./delivery-panel-model.mjs";
import styles from "./EcoDeliveryPanel.module.css";

type Participant = {
  id: string;
  name: string | null;
  email: string;
  status: "registered" | "active" | "paused" | "completed" | "blocked";
  registered_at: string;
  delivery_status: "pending" | "sending" | "sent" | "failed" | "cancelled" | null;
  sent_at: string | null;
  opened_at: string | null;
  attempt_count: number | null;
  last_error_code: string | null;
};

type OperationResult = {
  participant_id: string;
  result: "sent" | "failed" | "already_sent" | "blocked" | "not_found" | "retry_limit_reached";
  error?: string;
};

type Preview = {
  subject: string;
  preheader: string;
  htmlBody: string;
  textBody: string;
  example: boolean;
};

type PreviewMode = "desktop" | "mobile" | "text";

const STATUS_LABELS: Record<string, string> = {
  not_sent: "NÃO ENVIADO",
  sending: "ENVIANDO",
  sent: "ENVIADO",
  failed: "FALHOU",
  blocked: "BLOQUEADO",
};

const RESULT_LABELS: Record<string, string> = {
  sent: "ENVIADO",
  failed: "FALHOU",
  already_sent: "JÁ ENVIADO",
  blocked: "BLOQUEADO",
  not_found: "NÃO ENCONTRADO",
  retry_limit_reached: "LIMITE DE TENTATIVAS",
};

const OPENING_LABELS: Record<string, string> = {
  not_applicable: "—",
  unopened: "NÃO ABRIU",
  opened: "ABRIU",
};

const ERROR_LABELS: Record<string, string> = {
  configuration_missing: "Configuração local ausente.",
  unauthorized: "Operação local não autorizada.",
  request_failed: "A solicitação local é inválida.",
  participant_query_failed: "Não foi possível consultar os participantes.",
  send_failed: "O envio não pôde ser concluído.",
  preview_failed: "A pré-visualização não pôde ser gerada.",
  invalid_response: "O serviço retornou uma resposta inválida.",
  postmark_configuration_missing: "Configuração do Postmark ausente.",
  postmark_timeout: "O Postmark não respondeu dentro do limite.",
  postmark_network_error: "Falha de rede ao contatar o Postmark.",
  postmark_unauthorized: "O Postmark recusou a configuração de envio.",
  postmark_rejected: "O Postmark recusou a mensagem.",
  postmark_server_error: "O Postmark apresentou uma falha temporária.",
  postmark_invalid_response: "O Postmark retornou uma resposta inválida.",
  postmark_result_unknown: "Resultado incerto: verifique o Postmark Activity antes de tentar novamente.",
  participant_ineligible: "Participante inelegível para envio.",
  case_inactive: "O caso não está ativo.",
  retry_limit_reached: "Limite de tentativas atingido.",
  internal_error: "Falha operacional interna.",
};

function safeErrorLabel(value: unknown, fallback: string) {
  return typeof value === "string" && ERROR_LABELS[value] ? ERROR_LABELS[value] : fallback;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function EcoDeliveryPanel() {
  const [localAccess, setLocalAccess] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [operatorStatus, setOperatorStatus] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [results, setResults] = useState<OperationResult[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");

  useEffect(() => {
    setLocalAccess(isLocalOperatorHostname(window.location.hostname));
  }, []);

  async function refreshParticipants() {
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch("/api/internal/eco/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success !== true || !Array.isArray(payload.participants)) {
        setNotice(safeErrorLabel(payload?.error, "Não foi possível atualizar os participantes."));
        return;
      }
      setParticipants(payload.participants);
      const eligibleIds = new Set(
        payload.participants
          .filter((item: Participant) => isSendEligible(item))
          .map((item: Participant) => item.id),
      );
      setSelectedIds((current) => new Set(Array.from(current).filter((id) => eligibleIds.has(id))));
    } catch {
      setNotice("Não foi possível atualizar os participantes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (localAccess) void refreshParticipants();
  }, [localAccess]);

  const filtered = useMemo(() => filterParticipants(participants, {
    search,
    operatorStatus,
  }) as Participant[], [participants, search, operatorStatus]);

  const selectedParticipants = useMemo(
    () => participants.filter((participant) => selectedIds.has(participant.id)),
    [participants, selectedIds],
  );

  if (!localAccess) {
    return <main><p>Painel administrativo indisponível neste ambiente.</p></main>;
  }

  async function sendParticipants(recipients: Participant[]) {
    if (recipients.length < 1) {
      setNotice("Selecione pelo menos um participante elegível.");
      return;
    }
    const retrying = recipients.every((participant) => participant.delivery_status === "failed");
    const recipientList = recipients.map((participant) => `• ${participant.email}`).join("\n");
    if (!window.confirm(
      `${retrying ? "Você está prestes a tentar novamente" : "Você está prestes a enviar"} ${recipients.length} e-mail(s) reais pelo Postmark.\n\nDestinatários:\n${recipientList}\n\nConfirme para continuar.`,
    )) return;

    setLoading(true);
    setNotice("");
    setResults([]);
    try {
      const response = await fetch("/api/internal/eco/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_participants",
          case_id: "eco-sp-001",
          participant_ids: recipients.map((participant) => participant.id),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success !== true || !Array.isArray(payload.results)) {
        setNotice(safeErrorLabel(payload?.error, "O envio não pôde ser concluído."));
        return;
      }
      setResults(payload.results);
      setNotice("Operação concluída. Confira o resultado por participante.");
      await refreshParticipants();
    } catch {
      setNotice("O envio não pôde ser concluído.");
    } finally {
      setLoading(false);
    }
  }

  function previewUrl(format?: "html") {
    const params = new URLSearchParams();
    if (selectedParticipants.length === 1) {
      params.set("participant_id", selectedParticipants[0].id);
    }
    if (format) params.set("format", format);
    return `/api/internal/eco/delivery-preview${params.size ? `?${params}` : ""}`;
  }

  async function openPreview() {
    if (selectedParticipants.length > 1) {
      setNotice("Para pré-visualizar, selecione exatamente um participante ou remova toda a seleção para usar o exemplo.");
      return;
    }
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch(previewUrl(), { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success !== true || typeof payload.htmlBody !== "string") {
        setNotice(safeErrorLabel(payload?.error, "A pré-visualização não pôde ser gerada."));
        return;
      }
      setPreview(payload);
      setPreviewMode("desktop");
    } catch {
      setNotice("A pré-visualização não pôde ser gerada.");
    } finally {
      setLoading(false);
    }
  }

  function openPreviewInNewTab() {
    const opened = window.open(previewUrl("html"), "_blank", "noopener,noreferrer");
    if (opened) opened.opener = null;
  }

  function toggleSelection(participantId: string, checked: boolean) {
    const next = toggleParticipantSelection(selectedIds, participantId, checked);
    setSelectedIds(next.selectedIds);
    if (next.limitReached) setNotice("O limite é de 10 participantes por operação.");
  }

  function openAccess(participant: Participant) {
    if (participant.delivery_status !== "sent") return;
    if (!window.confirm(
      "Abrir este acesso real registrará a primeira abertura da landing. Deseja continuar?",
    )) return;
    const params = new URLSearchParams({ participant_id: participant.id });
    const opened = window.open(
      `/api/internal/eco/delivery-access?${params}`,
      "_blank",
      "noopener,noreferrer",
    );
    if (opened) opened.opener = null;
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>AMBIENTE LOCAL</p>
        <h1>E.C.O. — ENVIO DE E-MAILS</h1>
        <p>Selecione participantes, confira a mensagem e envie o Caso ECO-SP-001.</p>
      </header>

      <div className={styles.warning} role="alert">
        AMBIENTE LOCAL — AÇÕES PODEM ENVIAR E-MAILS REAIS
      </div>

      <section className={styles.testSection} aria-labelledby="controlled-test-heading">
        <h2 id="controlled-test-heading">TESTE CONTROLADO</h2>
        <p>Localize um endereço de teste já registrado. O painel não cria participantes.</p>
        <div className={styles.inlineControls}>
          <label>
            E-mail conhecido
            <input value={testEmail} onChange={(event) => setTestEmail(event.target.value)} type="email" />
          </label>
          <button type="button" onClick={() => setSearch(testEmail.trim())}>FILTRAR PARTICIPANTE</button>
        </div>
      </section>

      <section className={styles.operations} aria-labelledby="participants-heading">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="participants-heading">PARTICIPANTES</h2>
            <p>{selectedIds.size} de 10 selecionados</p>
          </div>
          <button type="button" onClick={() => void refreshParticipants()} disabled={loading}>ATUALIZAR</button>
        </div>

        <div className={styles.filters}>
          <label>
            Nome ou e-mail
            <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" />
          </label>
          <label>
            Status
            <select value={operatorStatus} onChange={(event) => setOperatorStatus(event.target.value)}>
              <option value="">Todos</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>

        <div className={styles.batchActions}>
          <button type="button" onClick={() => void openPreview()} disabled={loading || selectedIds.size > 1}>PRÉ-VISUALIZAR E-MAIL</button>
          <button className={styles.dangerButton} type="button" onClick={() => void sendParticipants(selectedParticipants)} disabled={loading || selectedIds.size === 0}>ENVIAR E-MAIL</button>
        </div>

        {notice && <p className={styles.notice} role="status">{notice}</p>}

        <div className={styles.tableWrapper}>
          <table>
            <thead><tr><th scope="col">Seleção</th><th scope="col">Nome</th><th scope="col">E-mail</th><th scope="col">Envio</th><th scope="col">Abertura</th><th scope="col">Último envio</th><th scope="col">Ações</th></tr></thead>
            <tbody>
              {filtered.map((participant) => {
                const status = getOperatorStatus(participant);
                const opening = getOpeningState(participant);
                const eligible = isSendEligible(participant);
                return (
                  <tr key={participant.id}>
                    <td><input aria-label={`Selecionar ${participant.email}`} type="checkbox" checked={selectedIds.has(participant.id)} disabled={!eligible || (!selectedIds.has(participant.id) && selectedIds.size >= 10)} onChange={(event) => toggleSelection(participant.id, event.target.checked)} /></td>
                    <td><strong>{participant.name || "—"}</strong></td>
                    <td>{participant.email}</td>
                    <td><span className={`${styles.status} ${styles[`status_${status}`]}`}>{STATUS_LABELS[status]}</span></td>
                    <td>{opening === "opened" ? `ABRIU EM ${formatDate(participant.opened_at)}` : OPENING_LABELS[opening]}</td>
                    <td>{formatDate(participant.sent_at)}</td>
                    <td><div className={styles.rowActions}>
                      {eligible && <button className={participant.delivery_status === "failed" ? styles.dangerButton : undefined} type="button" onClick={() => void sendParticipants([participant])}>{getSendActionLabel(participant)}</button>}
                      {participant.delivery_status === "failed" && <button type="button" onClick={() => setNotice(safeErrorLabel(participant.last_error_code, "Falha de envio sem detalhe operacional."))}>VER ERRO</button>}
                      {participant.delivery_status === "sent" && <button type="button" onClick={() => openAccess(participant)}>ABRIR ACESSO</button>}
                    </div></td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && <tr><td colSpan={7}>Nenhum participante encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {preview && <section className={styles.preview} aria-labelledby="preview-heading">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="preview-heading">PRÉ-VISUALIZAÇÃO DO E-MAIL</h2>
            <p>{preview.example ? "EXEMPLO — nenhuma pessoa selecionada" : preview.subject}</p>
          </div>
          <button type="button" onClick={() => setPreview(null)}>FECHAR</button>
        </div>
        <div className={styles.previewControls} role="group" aria-label="Modo de pré-visualização">
          <button type="button" aria-pressed={previewMode === "desktop"} onClick={() => setPreviewMode("desktop")}>DESKTOP</button>
          <button type="button" aria-pressed={previewMode === "mobile"} onClick={() => setPreviewMode("mobile")}>MOBILE</button>
          <button type="button" aria-pressed={previewMode === "text"} onClick={() => setPreviewMode("text")}>TEXTO</button>
          <button type="button" onClick={openPreviewInNewTab}>ABRIR EM NOVA ABA</button>
        </div>
        {previewMode === "text"
          ? <pre className={styles.textPreview}>{preview.textBody}</pre>
          : <div className={`${styles.previewFrame} ${previewMode === "mobile" ? styles.mobileFrame : styles.desktopFrame}`}>
              <iframe title={`Pré-visualização ${previewMode}`} srcDoc={preview.htmlBody} sandbox="" />
            </div>}
      </section>}

      {results.length > 0 && <section className={styles.results} aria-labelledby="results-heading">
        <h2 id="results-heading">RESULTADO DO ENVIO</h2>
        <ul>{results.map((result) => {
          const participant = participants.find((item) => item.id === result.participant_id);
          return <li key={result.participant_id}><strong>{participant?.email ?? "Participante não encontrado"}</strong><span>{RESULT_LABELS[result.result] ?? "FALHOU"}</span>{result.error && <span>{safeErrorLabel(result.error, "Falha operacional.")}</span>}</li>;
        })}</ul>
      </section>}
    </main>
  );
}
