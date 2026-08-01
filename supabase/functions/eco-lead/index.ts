const MAX_BODY_BYTES = 16 * 1024;
const PRODUCTION_ORIGINS = new Set([
  "https://liberula.com",
  "https://www.liberula.com",
]);

type LeadRecord = {
  name: string;
  email: string;
  consent: true;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  fbclid: string | null;
  source_url: string | null;
};

type InsertResult = "created" | "duplicate";

export type EcoLeadDependencies = {
  insertLead: (lead: LeadRecord) => Promise<InsertResult>;
  recruitmentClosed?: boolean;
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

function requiredText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) return null;
  return normalized;
}

function optional(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (normalized.length > maxLength) return undefined;
  return normalized || null;
}

function validEmail(email: string): boolean {
  return email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseLead(payload: unknown): LeadRecord | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const input = payload as Record<string, unknown>;
  if (input.project !== "eco" || input.funnel !== "free_recruitment" || input.consent !== true) return null;

  const name = requiredText(input.name, 120);
  const rawEmail = requiredText(input.email, 320);
  const email = rawEmail?.toLowerCase() ?? null;
  if (!name || name.length < 2 || !email || !validEmail(email)) return null;

  const submittedAt = optional(input.submitted_at, 64);
  const userAgent = optional(input.user_agent, 512);
  const website = optional(input.website, 255);
  if (submittedAt === undefined || (submittedAt && Number.isNaN(Date.parse(submittedAt)))) return null;
  if (userAgent === undefined || website === undefined) return null;

  const utm_source = optional(input.utm_source, 255);
  const utm_medium = optional(input.utm_medium, 255);
  const utm_campaign = optional(input.utm_campaign, 255);
  const utm_content = optional(input.utm_content, 255);
  const utm_term = optional(input.utm_term, 255);
  const fbclid = optional(input.fbclid, 512);
  const source_url = optional(input.source_url, 2048);
  if ([utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, source_url].includes(undefined)) return null;

  return {
    name,
    email,
    consent: true,
    utm_source: utm_source ?? null,
    utm_medium: utm_medium ?? null,
    utm_campaign: utm_campaign ?? null,
    utm_content: utm_content ?? null,
    utm_term: utm_term ?? null,
    fbclid: fbclid ?? null,
    source_url: source_url ?? null,
  };
}

export function createEcoLeadHandler(dependencies: EcoLeadDependencies) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("origin") ?? "";
    if (!origin || !isAllowedOrigin(origin)) return json(403, { success: false, error: "request_rejected" });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (request.method !== "POST") return json(405, { success: false, error: "method_not_allowed" }, origin);

    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return json(415, { success: false, error: "unsupported_media_type" }, origin);
    }
    const declaredLength = Number(request.headers.get("content-length") ?? "0");
    if (declaredLength > MAX_BODY_BYTES) return json(413, { success: false, error: "request_rejected" }, origin);

    let rawBody: string;
    let payload: unknown;
    try {
      rawBody = await request.text();
      if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) throw new Error("too_large");
      payload = JSON.parse(rawBody);
    } catch (error) {
      const status = error instanceof Error && error.message === "too_large" ? 413 : 400;
      return json(status, { success: false, error: "invalid_request" }, origin);
    }

    const input = payload as Record<string, unknown> | null;
    if (input && typeof input === "object" && typeof input.website === "string" && input.website.trim()) {
      return json(200, { success: true, duplicate: true }, origin);
    }

    const lead = parseLead(payload);
    if (!lead) return json(400, { success: false, error: "invalid_payload" }, origin);

    if (dependencies.recruitmentClosed === true) {
      return json(410, { success: false, error: "recruitment_closed" }, origin);
    }

    try {
      const result = await dependencies.insertLead(lead);
      return json(200, { success: true, duplicate: result === "duplicate" }, origin);
    } catch {
      // Never log the request body, name, or email.
      console.error("[eco-lead] Database insert failed");
      return json(500, { success: false, error: "internal_error" }, origin);
    }
  };
}

async function insertLead(lead: LeadRecord): Promise<InsertResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) throw new Error("missing_server_configuration");

  const response = await fetch(`${supabaseUrl}/rest/v1/eco_leads`, {
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

  // The expression index lower(email) makes concurrent repeated submissions safe.
  if (response.status === 409) {
    const error = await response.json().catch(() => ({})) as { code?: string };
    if (error.code === "23505") return "duplicate";
  }
  throw new Error("database_insert_failed");
}

if (import.meta.main) {
  Deno.serve(createEcoLeadHandler({
    insertLead,
    recruitmentClosed: Deno.env.get("ECO_RECRUITMENT_CLOSED")?.trim().toLowerCase() === "true",
  }));
}
