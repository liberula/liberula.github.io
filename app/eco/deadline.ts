const configuredEndAt = process.env.NEXT_PUBLIC_ECO_RECRUITMENT_END_AT?.trim() ?? "";
const isoWithTimezone = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
const match = configuredEndAt.match(isoWithTimezone);
const parsedTimestamp = match ? Date.parse(configuredEndAt) : Number.NaN;

export const ECO_RECRUITMENT_END_TIMESTAMP = Number.isFinite(parsedTimestamp)
  ? parsedTimestamp
  : null;

if (process.env.NODE_ENV !== "production" && ECO_RECRUITMENT_END_TIMESTAMP === null) {
  console.warn(
    configuredEndAt
      ? "[E.C.O.] NEXT_PUBLIC_ECO_RECRUITMENT_END_AT é inválida. Use uma data ISO com timezone."
      : "[E.C.O.] NEXT_PUBLIC_ECO_RECRUITMENT_END_AT não está configurada.",
  );
}

export const ECO_RECRUITMENT_END_LABEL = match
  ? new Intl.DateTimeFormat("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    })
      .format(new Date(Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4]),
        Number(match[5]),
      )))
      .replace(", ", ", às ")
  : null;

export function isEcoRecruitmentClosed(now = Date.now()): boolean {
  return ECO_RECRUITMENT_END_TIMESTAMP !== null && now >= ECO_RECRUITMENT_END_TIMESTAMP;
}

export type EcoCountdown = { days: number; hours: number; minutes: number };

export function getEcoCountdown(now = Date.now()): EcoCountdown | null {
  if (ECO_RECRUITMENT_END_TIMESTAMP === null) return null;
  const remaining = Math.max(0, ECO_RECRUITMENT_END_TIMESTAMP - now);
  const totalMinutes = Math.ceil(remaining / 60_000);
  return {
    days: Math.floor(totalMinutes / 1_440),
    hours: Math.floor((totalMinutes % 1_440) / 60),
    minutes: totalMinutes % 60,
  };
}
