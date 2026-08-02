const MAX_BODY_BYTES = 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CASE_ID = "eco-sp-001";

type JsonObject = Record<string, unknown>;
export type AutomaticJob = {
  jobId: string;
  participantId: string;
  caseId: typeof CASE_ID;
  attemptCount: number;
};
export type AutomaticJobFailure =
  | "postmark_timeout"
  | "postmark_network_error"
  | "postmark_server_error"
  | "temporary_dispatch_failure"
  | "postmark_unauthorized"
  | "postmark_configuration_missing"
  | "postmark_rejected"
  | "postmark_invalid_response"
  | "postmark_result_unknown"
  | "participant_ineligible"
  | "case_inactive"
  | "already_sent"
  | "invalid_email"
  | "retry_limit_reached";

export type AutomaticDispatcherDependencies = {
  secret?: string;
  claimJobs: (limit: number) => Promise<AutomaticJob[]>;
  prepareDelivery: (participantId: string) => Promise<{
    deliveryId: string;
    status: string;
  }>;
  sendDelivery: (deliveryId: string) => Promise<{
    result: string;
    error?: string;
  }>;
  completeJob: (jobId: string) => Promise<boolean>;
  failJob: (jobId: string, error: AutomaticJobFailure) => Promise<string>;
  logger?: { info?: (message: string) => void; error?: (message: string) => void };
};

function isPlainObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function json(status: number, body: JsonObject): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function secretsMatch(expected: string, actual: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
    crypto.subtle.digest("SHA-256", encoder.encode(actual)),
  ]);
  const left = new Uint8Array(leftHash);
  const right = new Uint8Array(rightHash);
  let difference = left.length ^ right.length;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ (right[index] ?? 0);
  return difference === 0;
}

function parseDispatchRequest(value: unknown): number | null {
  if (!isPlainObject(value)) return null;
  const keys = Object.keys(value).sort();
  if (keys.length !== 2 || keys[0] !== "action" || keys[1] !== "limit") return null;
  if (value.action !== "dispatch" || !Number.isInteger(value.limit)) return null;
  const limit = Number(value.limit);
  return limit >= 1 && limit <= 10 ? limit : null;
}

const SAFE_FAILURES = new Set<AutomaticJobFailure>([
  "postmark_timeout", "postmark_network_error", "postmark_server_error",
  "postmark_unauthorized", "postmark_configuration_missing", "postmark_rejected",
  "postmark_invalid_response", "postmark_result_unknown", "participant_ineligible",
  "case_inactive", "already_sent", "invalid_email", "retry_limit_reached",
]);

function deliveryFailure(result: { result: string; error?: string }): AutomaticJobFailure {
  if (result.result === "already_sent") return "already_sent";
  if (result.result === "retry_limit_reached") return "retry_limit_reached";
  if (typeof result.error === "string" && SAFE_FAILURES.has(result.error as AutomaticJobFailure)) {
    return result.error as AutomaticJobFailure;
  }
  if (result.result === "ineligible_state" || result.result === "not_found") {
    return "participant_ineligible";
  }
  return "temporary_dispatch_failure";
}

export function createAutomaticDispatcherHandler(dependencies: AutomaticDispatcherDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return json(405, { success: false, error: "invalid_request" });
    if (!dependencies.secret) return json(500, { success: false, error: "internal_error" });
    const authorization = request.headers.get("authorization") ?? "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token || !(await secretsMatch(dependencies.secret, token))) {
      return json(401, { success: false, error: "unauthorized" });
    }
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) {
      return json(400, { success: false, error: "invalid_request" });
    }
    let payload: unknown;
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) throw new Error();
      payload = JSON.parse(raw);
    } catch {
      return json(400, { success: false, error: "invalid_request" });
    }
    const limit = parseDispatchRequest(payload);
    if (!limit) return json(400, { success: false, error: "invalid_request" });

    let jobs: AutomaticJob[];
    try {
      jobs = await dependencies.claimJobs(limit);
    } catch {
      return json(500, { success: false, error: "internal_error" });
    }
    const counts = { claimed: jobs.length, completed: 0, failed: 0, rescheduled: 0 };
    for (const job of jobs) {
      dependencies.logger?.info?.("automatic delivery job claimed");
      try {
        const prepared = await dependencies.prepareDelivery(job.participantId);
        if (prepared.status === "sent") {
          await dependencies.failJob(job.jobId, "already_sent");
          counts.failed += 1;
          continue;
        }
        const sent = await dependencies.sendDelivery(prepared.deliveryId);
        if (sent.result === "sent") {
          if (!(await dependencies.completeJob(job.jobId))) throw new Error("completion_failed");
          counts.completed += 1;
          dependencies.logger?.info?.("automatic delivery completed");
          continue;
        }
        const disposition = await dependencies.failJob(job.jobId, deliveryFailure(sent));
        if (disposition === "pending") counts.rescheduled += 1;
        else counts.failed += 1;
        dependencies.logger?.error?.(`automatic delivery failed: ${deliveryFailure(sent)}`);
      } catch {
        try {
          const disposition = await dependencies.failJob(job.jobId, "temporary_dispatch_failure");
          if (disposition === "pending") counts.rescheduled += 1;
          else counts.failed += 1;
        } catch {
          counts.failed += 1;
        }
        dependencies.logger?.error?.("automatic delivery failed: temporary_dispatch_failure");
      }
    }
    return json(200, { success: true, counts });
  };
}

function parseJob(value: unknown): AutomaticJob | null {
  if (
    !isPlainObject(value) || typeof value.job_id !== "string" || !UUID_PATTERN.test(value.job_id) ||
    typeof value.participant_id !== "string" || !UUID_PATTERN.test(value.participant_id) ||
    value.case_id !== CASE_ID || !Number.isInteger(value.attempt_count) || Number(value.attempt_count) < 1 || Number(value.attempt_count) > 3
  ) return null;
  return { jobId: value.job_id, participantId: value.participant_id, caseId: CASE_ID, attemptCount: Number(value.attempt_count) };
}

export function createSupabaseAutomaticJobStore(
  supabaseUrl?: string,
  serviceRoleKey?: string,
  fetcher: typeof fetch = fetch,
) {
  async function rpc(name: string, body: JsonObject): Promise<unknown> {
    if (!supabaseUrl || !serviceRoleKey) throw new Error("missing_configuration");
    const response = await fetcher(`${supabaseUrl}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error("automatic_job_database_failed");
    return await response.json().catch(() => null);
  }
  return {
    claimJobs: async (limit: number) => {
      await rpc("recover_stale_eco_automatic_delivery_jobs", {});
      const value = await rpc("claim_eco_automatic_delivery_jobs", { p_limit: limit });
      if (!Array.isArray(value)) throw new Error("invalid_claim_response");
      const jobs = value.map(parseJob);
      if (jobs.some((job) => !job)) throw new Error("invalid_claim_response");
      return jobs as AutomaticJob[];
    },
    completeJob: async (jobId: string) => await rpc("complete_eco_automatic_delivery_job", { p_job_id: jobId }) === true,
    failJob: async (jobId: string, error: AutomaticJobFailure) => {
      const value = await rpc("fail_eco_automatic_delivery_job", { p_job_id: jobId, p_error_code: error });
      if (!["pending", "failed", "unchanged"].includes(String(value))) throw new Error("invalid_failure_response");
      return String(value);
    },
  };
}

export function createExistingDeliveryClient(
  deliveryFunctionUrl?: string,
  adminSecret?: string,
  fetcher: typeof fetch = fetch,
) {
  async function call(body: JsonObject): Promise<JsonObject> {
    if (!deliveryFunctionUrl || !adminSecret) throw new Error("missing_configuration");
    const response = await fetcher(deliveryFunctionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminSecret}` },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error("delivery_function_failed");
    const value = await response.json().catch(() => null);
    if (!isPlainObject(value) || value.success !== true || !Array.isArray(value.results) || value.results.length !== 1 || !isPlainObject(value.results[0])) {
      throw new Error("invalid_delivery_response");
    }
    return value.results[0];
  }
  return {
    prepareDelivery: async (participantId: string) => {
      const result = await call({ action: "prepare_automatic", case_id: CASE_ID, participant_ids: [participantId] });
      if (typeof result.delivery_id !== "string" || !UUID_PATTERN.test(result.delivery_id) || typeof result.status !== "string") {
        throw new Error("invalid_delivery_response");
      }
      return { deliveryId: result.delivery_id, status: result.status };
    },
    sendDelivery: async (deliveryId: string) => {
      const result = await call({ action: "send", delivery_ids: [deliveryId] });
      if (typeof result.result !== "string") throw new Error("invalid_delivery_response");
      return { result: result.result, ...(typeof result.error === "string" ? { error: result.error } : {}) };
    },
  };
}

if (import.meta.main) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const adminSecret = Deno.env.get("ECO_DELIVERY_ADMIN_SECRET");
  const jobs = createSupabaseAutomaticJobStore(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  const delivery = createExistingDeliveryClient(
    Deno.env.get("ECO_DELIVERY_FUNCTION_URL") ?? `${supabaseUrl}/functions/v1/eco-case-delivery`,
    adminSecret,
  );
  Deno.serve(createAutomaticDispatcherHandler({
    secret: adminSecret,
    ...jobs,
    ...delivery,
    logger: { info: (message) => console.info(message), error: (message) => console.error(message) },
  }));
}
