/**
 * Normalizes a case answer for equivalence checks without containing or
 * depending on any canonical answer.
 *
 * The future server endpoint must apply the same normalization independently;
 * client-side normalization is only for early validation and a stable payload.
 */
export function normalizeAnswer(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim()
    .replace(/\s+/gu, " ");
}
