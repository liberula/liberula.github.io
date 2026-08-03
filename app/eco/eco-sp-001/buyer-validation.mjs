const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/gu, " ");
}

function digitsOnly(value) {
  return normalizeText(value).replace(/\D/gu, "");
}

function requiredText(value, label, maxLength) {
  const normalized = normalizeText(value);
  if (!normalized) return { error: `${label} é obrigatório.` };
  if (normalized.length > maxLength) {
    return { error: `${label} deve ter no máximo ${maxLength} caracteres.` };
  }
  return { value: normalized };
}

/**
 * Validates and normalizes the buyer-only payload prepared for the future
 * server-controlled order endpoint.
 */
export function validateBuyerInput(input) {
  const errors = {};

  const name = requiredText(input.name, "Nome completo", 120);
  if (name.error) errors.name = name.error;
  else if (name.value.length < 2) errors.name = "Informe o nome completo.";

  const email = normalizeText(input.email).toLocaleLowerCase("pt-BR");
  if (!email) errors.email = "E-mail é obrigatório.";
  else if (email.length > 320 || !EMAIL_PATTERN.test(email)) {
    errors.email = "Informe um e-mail válido.";
  }

  const whatsapp = digitsOnly(input.whatsapp);
  if (!whatsapp) errors.whatsapp = "WhatsApp é obrigatório.";
  else if (whatsapp.length < 10 || whatsapp.length > 15) {
    errors.whatsapp = "Informe um WhatsApp com DDD ou código do país.";
  }

  if (Object.keys(errors).length > 0) {
    return { errors, payload: null };
  }

  return {
    errors,
    payload: {
      name: name.value,
      email,
      whatsapp,
    },
  };
}
