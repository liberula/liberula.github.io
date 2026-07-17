const MAX_BODY_BYTES = 16 * 1024;
const PRODUCTION_ORIGINS = new Set([
  "https://quaero.com.br",
  "https://www.quaero.com.br",
  "https://aferia.com.br",
  "https://www.aferia.com.br",
  "https://liberula.com",
  "https://www.liberula.com",
]);

export const ALLOWED_FORMS = {
  memora: ["interest", "father_day_card"],
  aferia: ["contact", "guide_interest"],
  eco: ["free_recruitment"],
} as const;

const CONSENT_REQUIRED_FORMS = new Set([
  "memora/interest",
  "memora/father_day_card",
  "aferia/contact",
  "aferia/guide_interest",
  "eco/free_recruitment",
]);

type Project = keyof typeof ALLOWED_FORMS;

type LeadRecord = {
  project: Project;
  funnel: string;
  name: string | null;
  email: string;
  phone: string | null;
  message: string | null;
  consent: boolean;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  fbclid: string | null;
  source_url: string | null;
  referrer: string | null;
  metadata: Record<string, unknown>;
};

type InsertResult = "created" | "duplicate";

export type LeadSubmitDependencies = {
  insertLead: (lead: LeadRecord) => Promise<InsertResult>;
};

function isAllowedOrigin(origin: string): boolean {
  if (PRODUCTION_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && url.hostname === "localhost";
  } catch {
    return false;
  }
}

function corsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(status: number, body: Record<string, unknown>, origin?: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(origin ? corsHeaders(origin) : {}),
    },
  });
}

function optionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (normalized.length > maxLength) return undefined;
  return normalized || null;
}

function validEmail(email: string): boolean {
  return email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isJsonContentType(contentType: string | null): boolean {
  return contentType !== null && /^application\/json(?:\s*;|$)/i.test(contentType);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

type ParseResult =
  | { success: true; lead: LeadRecord }
  | { success: false; error: "invalid_request" | "unsupported_form" };

function parseLead(payload: unknown): ParseResult {
  if (!isPlainObject(payload)) return { success: false, error: "invalid_request" };

  const project = payload.project;
  const funnel = payload.funnel;
  if (typeof project !== "string" || !(project in ALLOWED_FORMS)) {
    return { success: false, error: "unsupported_form" };
  }
  if (
    typeof funnel !== "string" ||
    !(ALLOWED_FORMS[project as Project] as readonly string[]).includes(funnel)
  ) {
    return { success: false, error: "unsupported_form" };
  }

  const name = optionalText(payload.name, 120);
  const rawEmail = optionalText(payload.email, 320);
  const phone = optionalText(payload.phone, 40);
  const message = optionalText(payload.message, 5000);
  const utm_source = optionalText(payload.utm_source, 255);
  const utm_medium = optionalText(payload.utm_medium, 255);
  const utm_campaign = optionalText(payload.utm_campaign, 255);
  const utm_content = optionalText(payload.utm_content, 255);
  const utm_term = optionalText(payload.utm_term, 255);
  const fbclid = optionalText(payload.fbclid, 512);
  const source_url = optionalText(payload.source_url, 2048);
  const referrer = optionalText(payload.referrer, 2048);
  const website = optionalText(payload.website, 255);
  const textFields = [
    name,
    rawEmail,
    phone,
    message,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    fbclid,
    source_url,
    referrer,
    website,
  ];

  if (textFields.includes(undefined)) return { success: false, error: "invalid_request" };
  if (typeof name === "string" && name.length < 2) {
    return { success: false, error: "invalid_request" };
  }

  const email = rawEmail?.toLowerCase() ?? null;
  if (!email || !validEmail(email)) return { success: false, error: "invalid_request" };
  if (typeof payload.consent !== "boolean") return { success: false, error: "invalid_request" };
  if (CONSENT_REQUIRED_FORMS.has(`${project}/${funnel}`) && !payload.consent) {
    return { success: false, error: "invalid_request" };
  }

  const metadata = payload.metadata === undefined ? {} : payload.metadata;
  if (!isPlainObject(metadata)) return { success: false, error: "invalid_request" };

  return {
    success: true,
    lead: {
      project: project as Project,
      funnel,
      name: name ?? null,
      email,
      phone: phone ?? null,
      message: message ?? null,
      consent: true,
      utm_source: utm_source ?? null,
      utm_medium: utm_medium ?? null,
      utm_campaign: utm_campaign ?? null,
      utm_content: utm_content ?? null,
      utm_term: utm_term ?? null,
      fbclid: fbclid ?? null,
      source_url: source_url ?? null,
      referrer: referrer ?? null,
      metadata,
    },
  };
}

export function createLeadSubmitHandler(dependencies: LeadSubmitDependencies) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("origin") ?? "";
    if (!origin || !isAllowedOrigin(origin)) {
      return json(403, { success: false, error: "invalid_request" });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== "POST") {
      return json(405, { success: false, error: "invalid_request" }, origin);
    }
    if (!isJsonContentType(request.headers.get("content-type"))) {
      return json(415, { success: false, error: "invalid_request" }, origin);
    }

    const declaredLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return json(413, { success: false, error: "invalid_request" }, origin);
    }

    let payload: unknown;
    try {
      const rawBody = await request.text();
      if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
        return json(413, { success: false, error: "invalid_request" }, origin);
      }
      payload = JSON.parse(rawBody);
    } catch {
      return json(400, { success: false, error: "invalid_request" }, origin);
    }

    if (isPlainObject(payload) && typeof payload.website === "string" && payload.website.trim()) {
      return json(200, { success: true, duplicate: true }, origin);
    }

    const parsed = parseLead(payload);
    if (!parsed.success) {
      return json(400, { success: false, error: parsed.error }, origin);
    }

    try {
      const result = await dependencies.insertLead(parsed.lead);
      return json(200, { success: true, duplicate: result === "duplicate" }, origin);
    } catch {
      // Never log the request body or any lead fields.
      console.error("[lead-submit] Database insert failed");
      return json(500, { success: false, error: "internal_error" }, origin);
    }
  };
}

async function insertLead(lead: LeadRecord): Promise<InsertResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) throw new Error("missing_server_configuration");

  const response = await fetch(`${supabaseUrl}/rest/v1/leads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceRoleKey}`,
      "apikey": serviceRoleKey,
      "Prefer": "return=minimal",
    },
    body: JSON.stringify(lead),
  });
  if (response.ok) return "created";

  if (response.status === 409) {
    const error = await response.json().catch(() => ({})) as { code?: string };
    if (error.code === "23505") return "duplicate";
  }
  throw new Error("database_insert_failed");
}

if (import.meta.main) {
  Deno.serve(createLeadSubmitHandler({ insertLead }));
}
