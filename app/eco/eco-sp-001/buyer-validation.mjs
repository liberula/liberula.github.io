const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATE_PATTERN = /^[A-Za-z]{2}$/;

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

  const street = requiredText(input.street, "Logradouro", 160);
  if (street.error) errors.street = street.error;

  const number = requiredText(input.number, "Número", 20);
  if (number.error) errors.number = number.error;

  const complement = normalizeText(input.complement);
  if (complement.length > 80) {
    errors.complement = "Complemento deve ter no máximo 80 caracteres.";
  }

  const neighborhood = requiredText(input.neighborhood, "Bairro", 100);
  if (neighborhood.error) errors.neighborhood = neighborhood.error;

  const city = requiredText(input.city, "Cidade", 100);
  if (city.error) errors.city = city.error;

  const state = normalizeText(input.state).toLocaleUpperCase("pt-BR");
  if (!state) errors.state = "UF é obrigatória.";
  else if (!STATE_PATTERN.test(state)) errors.state = "Informe uma UF válida.";

  const postalCode = digitsOnly(input.postalCode);
  if (!postalCode) errors.postalCode = "CEP é obrigatório.";
  else if (postalCode.length !== 8) errors.postalCode = "Informe um CEP válido.";

  if (Object.keys(errors).length > 0) {
    return { errors, payload: null };
  }

  return {
    errors,
    payload: {
      name: name.value,
      email,
      whatsapp,
      address: {
        street: street.value,
        number: number.value,
        complement,
        neighborhood: neighborhood.value,
        city: city.value,
        state,
        postalCode,
      },
    },
  };
}
