export const ECO_PRICE = 79;
export const ECO_PRODUCT = "eco-convocacao-74b";

export const attributionKeys = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
] as const;

export type EcoAttribution = Partial<
  Record<(typeof attributionKeys)[number], string>
>;

export type EcoLeadInput = {
  firstName: string;
  email: string;
  attribution: EcoAttribution;
  sourceUrl: string;
};

export type EcoLeadPayload = {
  name: string;
  email: string;
  priceReference: number;
  product: typeof ECO_PRODUCT;
  submittedAt: string;
  sourceUrl: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  fbclid: string;
};

type FormspreeErrorResponse = {
  error?: string;
  errors?: Array<{
    code?: string;
    field?: string;
    message?: string;
  }>;
  message?: string;
};

export class EcoLeadSubmissionError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "EcoLeadSubmissionError";
  }
}

async function readFormspreeError(response: Response): Promise<string> {
  try {
    const result = (await response.json()) as FormspreeErrorResponse;
    const messages = result.errors
      ?.map((error) => error.message)
      .filter((message): message is string => Boolean(message));

    return messages?.join(" ") || result.error || result.message || "";
  } catch {
    return "";
  }
}

export async function submitEcoLead(data: EcoLeadInput): Promise<void> {
  const endpoint = process.env.NEXT_PUBLIC_ECO_LEAD_ENDPOINT;

  if (!endpoint) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "E.C.O.: configure NEXT_PUBLIC_ECO_LEAD_ENDPOINT para receber cadastros.",
      );
    }

    throw new EcoLeadSubmissionError("ECO_LEAD_ENDPOINT_NOT_CONFIGURED");
  }

  const payload: EcoLeadPayload = {
    name: data.firstName,
    email: data.email,
    priceReference: ECO_PRICE,
    product: ECO_PRODUCT,
    submittedAt: new Date().toISOString(),
    sourceUrl: data.sourceUrl,
    utm_source: data.attribution.utm_source ?? "",
    utm_medium: data.attribution.utm_medium ?? "",
    utm_campaign: data.attribution.utm_campaign ?? "",
    utm_content: data.attribution.utm_content ?? "",
    utm_term: data.attribution.utm_term ?? "",
    fbclid: data.attribution.fbclid ?? "",
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const formspreeMessage = await readFormspreeError(response);
    throw new EcoLeadSubmissionError(
      formspreeMessage || `ECO_LEAD_REQUEST_FAILED_${response.status}`,
      response.status,
    );
  }
}

export function readEcoAttribution(): EcoAttribution {
  if (typeof window === "undefined") return {};

  const storageKey = "eco-attribution";
  let stored: EcoAttribution = {};

  try {
    stored = JSON.parse(sessionStorage.getItem(storageKey) ?? "{}") as EcoAttribution;
  } catch {
    stored = {};
  }

  const params = new URLSearchParams(window.location.search);
  const current = attributionKeys.reduce<EcoAttribution>((result, key) => {
    const value = params.get(key);
    if (value) result[key] = value;
    return result;
  }, {});
  const attribution = { ...stored, ...current };

  try {
    sessionStorage.setItem(storageKey, JSON.stringify(attribution));
  } catch {
    // The form remains usable when storage is unavailable.
  }

  return attribution;
}
