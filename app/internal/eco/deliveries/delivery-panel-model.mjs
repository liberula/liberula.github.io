export function isLocalOperatorHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function getOperatorStatus(participant) {
  if (
    participant?.status === "blocked" || participant?.status === "completed" ||
    participant?.delivery_status === "cancelled"
  ) return "blocked";
  if (participant?.delivery_status === "sending") return "sending";
  if (participant?.delivery_status === "sent") return "sent";
  if (participant?.delivery_status === "failed") return "failed";
  return "not_sent";
}

export function filterParticipants(participants, filters) {
  const search = String(filters.search ?? "").trim().toLocaleLowerCase("pt-BR");
  return participants.filter((participant) => {
    if (search) {
      const haystack = `${participant.name ?? ""} ${participant.email}`
        .toLocaleLowerCase("pt-BR");
      if (!haystack.includes(search)) return false;
    }
    if (
      filters.operatorStatus &&
      getOperatorStatus(participant) !== filters.operatorStatus
    ) return false;
    return true;
  });
}

export function toggleParticipantSelection(selectedIds, participantId, checked) {
  const next = new Set(selectedIds);
  if (!checked) {
    next.delete(participantId);
    return { selectedIds: next, limitReached: false };
  }
  if (next.has(participantId)) return { selectedIds: next, limitReached: false };
  if (next.size >= 10) return { selectedIds: next, limitReached: true };
  next.add(participantId);
  return { selectedIds: next, limitReached: false };
}

export function isSendEligible(participant) {
  if (getOperatorStatus(participant) === "blocked") return false;
  if (participant?.delivery_status === "sent" || participant?.delivery_status === "sending") {
    return false;
  }
  if (participant?.delivery_status === "failed") {
    return Number.isInteger(participant.attempt_count) && participant.attempt_count < 3;
  }
  return participant?.delivery_status === null || participant?.delivery_status === "pending";
}

export function getSendActionLabel(participant) {
  return participant?.delivery_status === "failed" ? "TENTAR NOVAMENTE" : "ENVIAR E-MAIL";
}

export function getOpeningState(participant) {
  if (participant?.delivery_status !== "sent") return "not_applicable";
  return participant?.opened_at ? "opened" : "unopened";
}
