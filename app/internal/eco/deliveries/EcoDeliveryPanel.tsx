"use client";

import { useEffect, useMemo, useState } from "react";
import {
  filterParticipants,
  getDeliveryUrl,
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
  delivery_id: string | null;
  delivery_status: "pending" | "sending" | "sent" | "failed" | "cancelled" | null;
  delivery_reference: string | null;
  sent_at: string | null;
  attempt_count: number | null;
  last_error_code: string | null;
};

type OperationResult = {
  participant_id?: string;
  delivery_id: string;
  result: string;
  status?: string;
  error?: string;
  delivery_url?: string;
};

const PARTICIPANT_STATUS_LABELS: Record<string, string> = {
  registered: "Registrado",
  active: "Ativo",
  paused: "Pausado",
  completed: "Concluído",
  blocked: "Bloqueado",
};

const DELIVERY_STATUS_LABELS: Record<string, string> = {
  not_prepared: "Não preparada",
  pending: "Pendente",
  sending: "Em envio",
  sent: "Enviada",
  failed: "Falhou",
  cancelled: "Cancelada",
};

const ERROR_LABELS: Record<string, string> = {
  configuration_missing: "Configuração local ausente.",
  unauthorized: "Operação local não autorizada.",
  request_failed: "A solicitação local é inválida.",
  participant_query_failed: "Não foi possível consultar os participantes.",
  prepare_failed: "A preparação não pôde ser concluída.",
  send_failed: "O envio não pôde ser concluído.",
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
};

function safeErrorLabel(value: unknown, fallback: string) {
  return typeof value === "string" && ERROR_LABELS[value]
    ? ERROR_LABELS[value]
    : fallback;
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
  const [participantStatus, setParticipantStatus] = useState("");
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [onlyWithoutDelivery, setOnlyWithoutDelivery] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [results, setResults] = useState<OperationResult[]>([]);

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
      const availableIds = new Set(payload.participants.map((item: Participant) => item.id));
      setSelectedIds((current) =>
        new Set(Array.from(current).filter((id) => availableIds.has(id)))
      );
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
    participantStatus,
    deliveryStatus,
    onlyWithoutDelivery,
  }) as Participant[], [participants, search, participantStatus, deliveryStatus, onlyWithoutDelivery]);

  if (!localAccess) {
    return <main><p>Painel administrativo indisponível neste ambiente.</p></main>;
  }

  async function runOperation(body: Record<string, unknown>) {
    setLoading(true);
    setNotice("");
    setResults([]);
    try {
      const response = await fetch("/api/internal/eco/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.success !== true || !Array.isArray(payload.results)) {
        setNotice(safeErrorLabel(payload?.error, "A operação não pôde ser concluída."));
        return;
      }
      setResults(payload.results);
      setNotice("Operação concluída. Os registros foram atualizados.");
      await refreshParticipants();
    } catch {
      setNotice("A operação não pôde ser concluída.");
    } finally {
      setLoading(false);
    }
  }

  function confirmPrepare(participantIds: string[]) {
    if (participantIds.length < 1) {
      setNotice("Selecione pelo menos um participante.");
      return;
    }
    if (!window.confirm(
      `Preparar delivery do caso eco-sp-001 para ${participantIds.length} participante(s)?\n\nEsta ação não envia e-mail.`,
    )) return;
    void runOperation({
      action: "prepare",
      case_id: "eco-sp-001",
      participant_ids: participantIds,
    });
  }

  function confirmSend(deliveryIds: string[]) {
    if (deliveryIds.length < 1) {
      setNotice("Nenhuma delivery elegível foi selecionada. Entregas ausentes não serão preparadas automaticamente.");
      return;
    }
    if (!window.confirm(
      `Você está prestes a enviar ${deliveryIds.length} e-mail(s) reais pelo Postmark.\nEsta ação não é uma pré-visualização.`,
    )) return;
    void runOperation({ action: "send", delivery_ids: deliveryIds });
  }

  function sendSelected() {
    const deliveryIds = participants
      .filter((participant) => selectedIds.has(participant.id) && isSendEligible(participant))
      .map((participant) => participant.delivery_id)
      .filter((id): id is string => Boolean(id));
    confirmSend(deliveryIds);
  }

  async function copyLink(participant: Participant) {
    const url = getDeliveryUrl(participant);
    if (!url) return setNotice("Esta delivery não possui um link válido.");
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Link individual copiado.");
    } catch {
      setNotice("Não foi possível copiar o link. Use Abrir landing.");
    }
  }

  function openLanding(participant: Participant) {
    const url = getDeliveryUrl(participant);
    if (!url) return setNotice("Esta delivery não possui um link válido.");
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (opened) opened.opener = null;
  }

  function toggleSelection(participantId: string, checked: boolean) {
    const next = toggleParticipantSelection(selectedIds, participantId, checked);
    setSelectedIds(next.selectedIds);
    if (next.limitReached) setNotice("O limite é de 10 participantes por operação.");
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>AMBIENTE LOCAL</p>
        <h1>E.C.O. — OPERAÇÕES DE ENTREGA</h1>
        <p>Ferramenta local para preparação e envio manual do Caso ECO-SP-001.</p>
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
            Status do participante
            <select value={participantStatus} onChange={(event) => setParticipantStatus(event.target.value)}>
              <option value="">Todos</option>
              {Object.entries(PARTICIPANT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            Status da delivery
            <select value={deliveryStatus} onChange={(event) => setDeliveryStatus(event.target.value)}>
              <option value="">Todas</option>
              {Object.entries(DELIVERY_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className={styles.checkboxLabel}>
            <input type="checkbox" checked={onlyWithoutDelivery} onChange={(event) => setOnlyWithoutDelivery(event.target.checked)} />
            Apenas participantes sem delivery
          </label>
        </div>

        <div className={styles.batchActions}>
          <button type="button" onClick={() => confirmPrepare(Array.from(selectedIds))} disabled={loading || selectedIds.size === 0}>PREPARAR DELIVERY</button>
          <button className={styles.dangerButton} type="button" onClick={sendSelected} disabled={loading || selectedIds.size === 0}>ENVIAR E-MAIL REAL</button>
        </div>

        {notice && <p className={styles.notice} role="status">{notice}</p>}

        <div className={styles.tableWrapper}>
          <table>
            <thead><tr><th scope="col">Selecionar</th><th scope="col">Participante</th><th scope="col">Status</th><th scope="col">Delivery</th><th scope="col">Tentativas</th><th scope="col">Registro</th><th scope="col">Ações</th></tr></thead>
            <tbody>
              {filtered.map((participant) => {
                const state = participant.delivery_status ?? "not_prepared";
                const link = getDeliveryUrl(participant);
                return (
                  <tr key={participant.id}>
                    <td><input aria-label={`Selecionar ${participant.email}`} type="checkbox" checked={selectedIds.has(participant.id)} disabled={!selectedIds.has(participant.id) && selectedIds.size >= 10} onChange={(event) => toggleSelection(participant.id, event.target.checked)} /></td>
                    <td><strong>{participant.name || "Identidade não registrada"}</strong><span>{participant.email}</span></td>
                    <td>{PARTICIPANT_STATUS_LABELS[participant.status]}</td>
                    <td><span className={`${styles.status} ${styles[`status_${state}`]}`}>{DELIVERY_STATUS_LABELS[state]}</span></td>
                    <td>{participant.attempt_count ?? "—"}</td>
                    <td>{formatDate(participant.registered_at)}</td>
                    <td><div className={styles.rowActions}>
                      {!participant.delivery_id && <button type="button" onClick={() => confirmPrepare([participant.id])}>Preparar</button>}
                      {link && <button type="button" onClick={() => void copyLink(participant)}>Copiar link</button>}
                      {link && <button type="button" onClick={() => openLanding(participant)}>ABRIR LANDING</button>}
                      {participant.delivery_status === "pending" && <button className={styles.dangerButton} type="button" onClick={() => confirmSend([participant.delivery_id!])}>ENVIAR E-MAIL REAL</button>}
                      {participant.delivery_status === "failed" && <button type="button" onClick={() => setNotice(safeErrorLabel(participant.last_error_code, "Falha de envio sem detalhe operacional."))}>Ver erro</button>}
                      {participant.delivery_status === "failed" && (participant.attempt_count ?? 0) < 3 && <button className={styles.dangerButton} type="button" onClick={() => confirmSend([participant.delivery_id!])}>Tentar novamente</button>}
                    </div></td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && <tr><td colSpan={7}>Nenhum participante encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {results.length > 0 && <section className={styles.results} aria-labelledby="results-heading">
        <h2 id="results-heading">RESULTADO DA OPERAÇÃO</h2>
        <ul>{results.map((result, index) => <li key={`${result.delivery_id}-${index}`}><strong>{result.result}</strong><span>{result.status ?? "—"}</span>{result.error && <span>{safeErrorLabel(result.error, "Falha operacional.")}</span>}</li>)}</ul>
      </section>}
    </main>
  );
}
