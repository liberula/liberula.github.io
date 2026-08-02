const MAX_BODY_BYTES = 32 * 1024;
const EVENT_TYPE = "eco.participant.registered";
const EVENT_VERSION = 1;
const SOURCE_SYSTEM = "quaero";
const PROJECT = "eco";
const FUNNEL = "free_recruitment";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

type JsonObject = Record<string, unknown>;
export type IngestionResult = "created" | "linked" | "duplicate";

export type ParticipantEvent = {
  eventId: string;
  eventType: typeof EVENT_TYPE;
  eventVersion: typeof EVENT_VERSION;
  occurredAt: string;
  sourceSystem: typeof SOURCE_SYSTEM;
  sourceRecordId: string;
  participantName: string | null;
  participantEmail: string;
  participantConsent: true;
  project: typeof PROJECT;
  funnel: typeof FUNNEL;
  acquisition: JsonObject;
  deliveryMode: "none" | "automatic_if_enabled";
};

export type ParticipantIngestOutcome = {
  result: IngestionResult;
  automaticJobEnqueued: boolean;
};

type IngestLogEntry = {
  event: "eco_participant_ingest";
  eventType?: string;
  eventVersion?: number;
  result?: IngestionResult;
  errorCategory?:
    | "authentication"
    | "validation"
    | "configuration"
    | "database";
};

export type ParticipantIngestDependencies = {
  secret?: string;
  ingest: (
    event: ParticipantEvent,
  ) => Promise<IngestionResult | ParticipantIngestOutcome>;
  dispatchPending?: () => Promise<void>;
  logger?: {
    info?: (entry: IngestLogEntry) => void;
    error?: (entry: IngestLogEntry) => void;
  };
};

function isPlainObject(value: unknown): value is JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: JsonObject, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index]);
}

function hasAllowedKeys(
  value: JsonObject,
  required: readonly string[],
  optional: readonly string[],
): boolean {
  const keys = Object.keys(value);
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => keys.includes(key)) &&
    keys.every((key) => allowed.has(key));
}

function requiredText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) return null;
  return normalized;
}

function optionalText(
  value: unknown,
  maxLength: number,
): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length <= maxLength ? normalized || null : undefined;
}

function isValidIsoTimestamp(value: string): boolean {
  const match = ISO_TIMESTAMP_PATTERN.exec(value);
  if (!match || Number.isNaN(Date.parse(value))) return false;
  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    zone,
  ] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (
    month < 1 || month > 12 || day < 1 ||
    day > new Date(Date.UTC(year, month, 0)).getUTCDate() ||
    hour > 23 || minute > 59 || second > 59
  ) return false;
  if (zone !== "Z") {
    const [offsetHour, offsetMinute] = zone.slice(1).split(":").map(Number);
    if (offsetHour > 23 || offsetMinute > 59) return false;
  }
  return true;
}

export function parseParticipantEvent(value: unknown): ParticipantEvent | null {
  if (
    !isPlainObject(value) ||
    !hasAllowedKeys(value, [
      "event_id",
      "event_type",
      "event_version",
      "occurred_at",
      "source",
      "participant",
      "acquisition",
    ], ["delivery_mode"]) ||
    !isPlainObject(value.source) ||
    !hasExactKeys(value.source, ["system", "record_id"]) ||
    !isPlainObject(value.participant) ||
    !hasAllowedKeys(value.participant, ["email", "consent"], ["name"]) ||
    !isPlainObject(value.acquisition) ||
    !hasExactKeys(value.acquisition, [
      "project",
      "funnel",
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "fbclid",
      "source_url",
      "referrer",
      "metadata",
    ]) ||
    !isPlainObject(value.acquisition.metadata)
  ) return null;

  const eventId = requiredText(value.event_id, 36);
  const occurredAt = requiredText(value.occurred_at, 64);
  const sourceRecordId = requiredText(value.source.record_id, 200);
  const rawEmail = requiredText(value.participant.email, 320);
  const email = rawEmail?.toLocaleLowerCase("en-US") ?? null;
  const name = optionalText(value.participant.name, 120);
  const utmSource = optionalText(value.acquisition.utm_source, 255);
  const utmMedium = optionalText(value.acquisition.utm_medium, 255);
  const utmCampaign = optionalText(value.acquisition.utm_campaign, 255);
  const utmContent = optionalText(value.acquisition.utm_content, 255);
  const utmTerm = optionalText(value.acquisition.utm_term, 255);
  const fbclid = optionalText(value.acquisition.fbclid, 512);
  const sourceUrl = optionalText(value.acquisition.source_url, 2048);
  const referrer = optionalText(value.acquisition.referrer, 2048);
  const deliveryMode = value.delivery_mode === undefined
    ? "none"
    : value.delivery_mode;

  if (
    !eventId || !UUID_PATTERN.test(eventId) ||
    value.event_type !== EVENT_TYPE ||
    value.event_version !== EVENT_VERSION ||
    !occurredAt || !isValidIsoTimestamp(occurredAt) ||
    value.source.system !== SOURCE_SYSTEM ||
    !sourceRecordId ||
    !email || !EMAIL_PATTERN.test(email) ||
    name === undefined ||
    value.participant.consent !== true ||
    value.acquisition.project !== PROJECT ||
    value.acquisition.funnel !== FUNNEL ||
    (deliveryMode !== "none" && deliveryMode !== "automatic_if_enabled") ||
    [
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      fbclid,
      sourceUrl,
      referrer,
    ].includes(undefined)
  ) return null;

  return {
    eventId,
    eventType: EVENT_TYPE,
    eventVersion: EVENT_VERSION,
    occurredAt,
    sourceSystem: SOURCE_SYSTEM,
    sourceRecordId,
    participantName: name ?? null,
    participantEmail: email,
    participantConsent: true,
    project: PROJECT,
    funnel: FUNNEL,
    acquisition: {
      project: PROJECT,
      funnel: FUNNEL,
      utm_source: utmSource ?? null,
      utm_medium: utmMedium ?? null,
      utm_campaign: utmCampaign ?? null,
      utm_content: utmContent ?? null,
      utm_term: utmTerm ?? null,
      fbclid: fbclid ?? null,
      source_url: sourceUrl ?? null,
      referrer: referrer ?? null,
      metadata: value.acquisition.metadata,
    },
    deliveryMode,
  };
}

function json(status: number, body: JsonObject): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function secretsMatch(
  expected: string,
  actual: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const [expectedHash, actualHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
    crypto.subtle.digest("SHA-256", encoder.encode(actual)),
  ]);
  const expectedBytes = new Uint8Array(expectedHash);
  const actualBytes = new Uint8Array(actualHash);
  let difference = expectedBytes.length ^ actualBytes.length;
  for (let index = 0; index < expectedBytes.length; index += 1) {
    difference |= expectedBytes[index] ^ (actualBytes[index] ?? 0);
  }
  return difference === 0;
}

function eventIdentity(
  value: unknown,
): Pick<IngestLogEntry, "eventType" | "eventVersion"> {
  if (!isPlainObject(value)) return {};
  return {
    ...(value.event_type === EVENT_TYPE ? { eventType: EVENT_TYPE } : {}),
    ...(Number.isInteger(value.event_version)
      ? { eventVersion: Number(value.event_version) }
      : {}),
  };
}

export function createParticipantIngestHandler(
  dependencies: ParticipantIngestDependencies,
) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return json(405, { success: false, error: "invalid_request" });
    }
    if (!dependencies.secret) {
      dependencies.logger?.error?.({
        event: "eco_participant_ingest",
        errorCategory: "configuration",
      });
      return json(500, { success: false, error: "internal_error" });
    }

    const authorization = request.headers.get("authorization") ?? "";
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";
    if (!token || !(await secretsMatch(dependencies.secret, token))) {
      dependencies.logger?.error?.({
        event: "eco_participant_ingest",
        errorCategory: "authentication",
      });
      return json(401, { success: false, error: "unauthorized" });
    }

    if (
      !/^application\/json(?:\s*;|$)/i.test(
        request.headers.get("content-type") ?? "",
      )
    ) {
      return json(415, { success: false, error: "invalid_request" });
    }
    const declaredLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return json(413, { success: false, error: "invalid_request" });
    }

    let rawBody: string;
    let payload: unknown;
    try {
      rawBody = await request.text();
      if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
        return json(413, { success: false, error: "invalid_request" });
      }
      payload = JSON.parse(rawBody);
    } catch {
      return json(400, { success: false, error: "invalid_request" });
    }

    const event = parseParticipantEvent(payload);
    if (!event) {
      dependencies.logger?.error?.({
        event: "eco_participant_ingest",
        ...eventIdentity(payload),
        errorCategory: "validation",
      });
      return json(400, { success: false, error: "invalid_request" });
    }

    try {
      const ingested = await dependencies.ingest(event);
      const outcome: ParticipantIngestOutcome = typeof ingested === "string"
        ? { result: ingested, automaticJobEnqueued: false }
        : ingested;
      dependencies.logger?.info?.({
        event: "eco_participant_ingest",
        eventType: event.eventType,
        eventVersion: event.eventVersion,
        result: outcome.result,
      });
      if (outcome.automaticJobEnqueued && dependencies.dispatchPending) {
        try {
          await dependencies.dispatchPending();
        } catch {
          dependencies.logger?.error?.({
            event: "eco_participant_ingest",
            eventType: event.eventType,
            eventVersion: event.eventVersion,
            errorCategory: "configuration",
          });
        }
      }
      return json(200, { success: true, result: outcome.result });
    } catch {
      dependencies.logger?.error?.({
        event: "eco_participant_ingest",
        eventType: event.eventType,
        eventVersion: event.eventVersion,
        errorCategory: "database",
      });
      return json(500, { success: false, error: "internal_error" });
    }
  };
}

export function createSupabaseParticipantIngest(
  supabaseUrl?: string,
  serviceRoleKey?: string,
  fetcher: typeof fetch = fetch,
) {
  return async (event: ParticipantEvent): Promise<ParticipantIngestOutcome> => {
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("missing_server_configuration");
    }
    const response = await fetcher(
      `${supabaseUrl}/rest/v1/rpc/ingest_eco_participant_event`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
          "apikey": serviceRoleKey,
        },
        body: JSON.stringify({
          p_event_id: event.eventId,
          p_event_type: event.eventType,
          p_event_version: event.eventVersion,
          p_occurred_at: event.occurredAt,
          p_source_system: event.sourceSystem,
          p_source_record_id: event.sourceRecordId,
          p_participant_name: event.participantName,
          p_participant_email: event.participantEmail,
          p_participant_consent: event.participantConsent,
          p_project: event.project,
          p_funnel: event.funnel,
          p_acquisition: event.acquisition,
          p_delivery_mode: event.deliveryMode,
        }),
      },
    );
    if (!response.ok) throw new Error("participant_ingestion_failed");
    const value = await response.json().catch(() => null) as JsonObject | null;
    if (
      !value ||
      !["created", "linked", "duplicate"].includes(String(value.result)) ||
      typeof value.automatic_job_enqueued !== "boolean"
    ) throw new Error("invalid_ingestion_response");
    return {
      result: value.result as IngestionResult,
      automaticJobEnqueued: value.automatic_job_enqueued,
    };
  };
}

export function createBestEffortAutomaticDispatch(
  supabaseUrl?: string,
  adminSecret?: string,
  fetcher: typeof fetch = fetch,
) {
  return async (): Promise<void> => {
    if (!supabaseUrl || !adminSecret) throw new Error("missing_configuration");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    try {
      const response = await fetcher(
        `${supabaseUrl}/functions/v1/eco-automatic-delivery-dispatch`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminSecret}`,
          },
          body: JSON.stringify({ action: "dispatch", limit: 3 }),
          signal: controller.signal,
        },
      );
      if (!response.ok) throw new Error("automatic_dispatch_failed");
    } finally {
      clearTimeout(timeout);
    }
  };
}

if (import.meta.main) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  Deno.serve(createParticipantIngestHandler({
    secret: Deno.env.get("ECO_INGEST_SECRET"),
    ingest: createSupabaseParticipantIngest(supabaseUrl, serviceRoleKey),
    dispatchPending: createBestEffortAutomaticDispatch(
      supabaseUrl,
      Deno.env.get("ECO_DELIVERY_ADMIN_SECRET"),
    ),
    logger: {
      info: (entry) => console.info(JSON.stringify(entry)),
      error: (entry) => console.error(JSON.stringify(entry)),
    },
  }));
}
