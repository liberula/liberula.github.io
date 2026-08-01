export const ECO_FUNNEL = "free_recruitment";
export const ECO_PROJECT = "eco";

const leadEndpoint = process.env.NEXT_PUBLIC_ECO_FORM_ENDPOINT?.trim();
const isDevelopment = process.env.NODE_ENV !== "production";

export const attributionKeys = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
] as const;

export type EcoAttribution = Partial<Record<(typeof attributionKeys)[number], string>>;

export type EcoLeadInput = {
  name: string;
  email: string;
  consent: true;
  website: string;
  attribution: EcoAttribution;
  sourceUrl: string;
  referrer: string;
  userAgent: string;
};

export type EcoLeadPayload = {
  project: typeof ECO_PROJECT;
  funnel: typeof ECO_FUNNEL;
  name: string;
  email: string;
  consent: true;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  fbclid: string;
  source_url: string;
  referrer: string;
  metadata: {
    submitted_at: string;
    user_agent: string;
  };
  website: string;
};

export type EcoLeadResult = { duplicate: boolean };
export type EcoLeadErrorKind = "submission" | "configuration" | "closed";

export class EcoLeadSubmissionError extends Error {
  constructor(
    message: string,
    public readonly kind: EcoLeadErrorKind,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "EcoLeadSubmissionError";
  }
}

type ServiceResponse = {
  success?: boolean;
  duplicate?: boolean;
  error?: string;
};

async function readResponse(response: Response): Promise<ServiceResponse> {
  try {
    return (await response.json()) as ServiceResponse;
  } catch {
    return {};
  }
}

export async function submitEcoLead(data: EcoLeadInput): Promise<EcoLeadResult> {
  if (!leadEndpoint) {
    if (isDevelopment) console.warn("[E.C.O.] Endpoint de formulário não configurado.");
    throw new EcoLeadSubmissionError("Form endpoint not configured", "configuration");
  }

  const payload: EcoLeadPayload = {
    project: ECO_PROJECT,
    funnel: ECO_FUNNEL,
    name: data.name,
    email: data.email,
    consent: data.consent,
    utm_source: data.attribution.utm_source ?? "",
    utm_medium: data.attribution.utm_medium ?? "",
    utm_campaign: data.attribution.utm_campaign ?? "",
    utm_content: data.attribution.utm_content ?? "",
    utm_term: data.attribution.utm_term ?? "",
    fbclid: data.attribution.fbclid ?? "",
    source_url: data.sourceUrl,
    referrer: data.referrer,
    metadata: {
      submitted_at: new Date().toISOString(),
      user_agent: data.userAgent,
    },
    website: data.website,
  };

  let response: Response;
  try {
    response = await fetch(leadEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new EcoLeadSubmissionError("Lead submission failed", "submission");
  }

  const body = await readResponse(response);
  if (!response.ok) {
    if (response.status === 410 && body.error === "recruitment_closed") {
      throw new EcoLeadSubmissionError("Recruitment is closed", "closed", response.status);
    }
    throw new EcoLeadSubmissionError("Lead submission failed", "submission", response.status);
  }
  if (body.success === true) return { duplicate: body.duplicate === true };
  throw new EcoLeadSubmissionError("Lead submission was not confirmed", "submission", response.status);
}

export function readEcoAttribution(): EcoAttribution {
  if (typeof window === "undefined") return {};
  const storageKey = "eco-recruitment-attribution";
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
    // Attribution in the current URL is still submitted when storage is unavailable.
  }
  return attribution;
}
