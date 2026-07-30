export {
  buildCampaignProgressEndpoint,
} from "./eco-api-contract.mjs";

export const ECO_CAMPAIGN_ID = "eco-sp-001-founder";
export const ECO_CAMPAIGN_TARGET = 100;
export const ECO_CASE_URL = "https://liberula.com/eco/eco-sp-001/";

const CAMPAIGN_STATES = new Set(["collecting", "goal_reached", "closed"]);
const REFERRAL_CODE_PATTERN = /^[A-F0-9]{12}$/;

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function normalizeReferralCode(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return REFERRAL_CODE_PATTERN.test(normalized) ? normalized : null;
}

export function parseCampaignProgress(value) {
  if (!isPlainObject(value)) return null;
  const confirmed = Number(value.confirmed);
  const target = Number(value.target);
  if (
    value.campaignId !== ECO_CAMPAIGN_ID ||
    !Number.isInteger(confirmed) ||
    confirmed < 0 ||
    !Number.isInteger(target) ||
    target !== ECO_CAMPAIGN_TARGET ||
    !CAMPAIGN_STATES.has(value.status) ||
    typeof value.goalReached !== "boolean" ||
    value.goalReached !== (confirmed >= target) ||
    typeof value.closesAt !== "string" ||
    Number.isNaN(Date.parse(value.closesAt))
  ) {
    return null;
  }

  if (
    (value.status === "collecting" && confirmed >= target) ||
    (value.status === "goal_reached" && confirmed < target)
  ) {
    return null;
  }

  return {
    campaignId: ECO_CAMPAIGN_ID,
    confirmed,
    target,
    goalReached: confirmed >= target,
    status: value.status,
    closesAt: value.closesAt,
    displayPercent: Math.min(100, Math.max(0, (confirmed / target) * 100)),
  };
}

export function buildReferralUrl(referralCode) {
  const code = normalizeReferralCode(referralCode);
  if (!code) return ECO_CASE_URL;
  const url = new URL(ECO_CASE_URL);
  url.searchParams.set("ref", code);
  return url.toString();
}

export function buildShareMessage(variant, url) {
  if (variant === "unknown") {
    return [
      "Terminei o primeiro caso da E.C.O.",
      "",
      "A campanha do próximo dossiê físico está em andamento.",
      "",
      "Veja o caso:",
      url,
    ].join("\n");
  }
  if (variant === "goal_reached") {
    return [
      "Terminei o primeiro caso da E.C.O.",
      "",
      "A produção do próximo dossiê físico já foi confirmada, e ainda dá para participar do lote fundador.",
      "",
      "Veja o caso:",
      url,
    ].join("\n");
  }
  if (variant === "personal_paid") {
    return [
      "Terminei o primeiro caso da E.C.O. e entrei no lote fundador do próximo dossiê físico.",
      "",
      "Acho que você vai gostar da investigação:",
      url,
    ].join("\n");
  }
  if (variant === "personal_pending") {
    return [
      "Terminei o primeiro caso da E.C.O. e iniciei minha participação no lote fundador.",
      "",
      "Acho que você vai gostar da investigação:",
      url,
    ].join("\n");
  }
  return [
    "Terminei o primeiro caso da E.C.O.",
    "",
    "O próximo dossiê será físico e o lote precisa chegar a 100 investigadores para confirmar a produção.",
    "",
    "Veja o caso:",
    url,
  ].join("\n");
}

export function buildWhatsAppUrl(message) {
  const url = new URL("https://wa.me/");
  url.searchParams.set("text", message);
  return url.toString();
}
