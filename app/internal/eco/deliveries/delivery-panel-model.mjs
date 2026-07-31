export const DELIVERY_REFERENCE_PATTERN = /^[A-Za-z0-9_-]{16,200}$/;
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isLocalOperatorHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function filterParticipants(participants, filters) {
  const search = String(filters.search ?? "").trim().toLocaleLowerCase("pt-BR");
  return participants.filter((participant) => {
    if (search) {
      const haystack = `${participant.name ?? ""} ${participant.email}`
        .toLocaleLowerCase("pt-BR");
      if (!haystack.includes(search)) return false;
    }
    if (filters.participantStatus && participant.status !== filters.participantStatus) {
      return false;
    }
    const deliveryStatus = participant.delivery_status ?? "not_prepared";
    if (filters.deliveryStatus && deliveryStatus !== filters.deliveryStatus) {
      return false;
    }
    if (filters.onlyWithoutDelivery && participant.delivery_id) return false;
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
  return participant?.delivery_status === "pending" ||
    (participant?.delivery_status === "failed" && participant.attempt_count < 3);
}

export function getDeliveryUrl(participant) {
  if (!participant || !DELIVERY_REFERENCE_PATTERN.test(participant.delivery_reference ?? "")) {
    return null;
  }
  return `https://liberula.com/eco/eco-sp-001/iniciar/?delivery=${
    encodeURIComponent(participant.delivery_reference)
  }`;
}
