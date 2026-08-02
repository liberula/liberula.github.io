const MAX_BODY_BYTES = 1024;

type JsonObject = Record<string, unknown>;
export type AutomationSummary = {
  automaticCaseDeliveryEnabled: boolean;
  pendingCount: number;
  failedCount: number;
  completedLast24hCount: number;
};

export type AutomationSettingsDependencies = {
  secret?: string;
  getSummary: () => Promise<AutomationSummary>;
  setEnabled: (enabled: boolean) => Promise<AutomationSummary>;
  logger?: { info?: (message: string) => void; error?: (message: string) => void };
};

function isPlainObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: JsonObject, expected: string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === [...expected].sort()[index]);
}

export function parseAutomationOperation(value: unknown):
  | { action: "get" }
  | { action: "set"; enabled: boolean }
  | null {
  if (!isPlainObject(value)) return null;
  if (value.action === "get" && hasExactKeys(value, ["action"])) {
    return { action: "get" };
  }
  if (
    value.action === "set" &&
    hasExactKeys(value, ["action", "automatic_case_delivery_enabled"]) &&
    typeof value.automatic_case_delivery_enabled === "boolean"
  ) {
    return { action: "set", enabled: value.automatic_case_delivery_enabled };
  }
  return null;
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

async function secretsMatch(expected: string, actual: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [expectedHash, actualHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
    crypto.subtle.digest("SHA-256", encoder.encode(actual)),
  ]);
  const left = new Uint8Array(expectedHash);
  const right = new Uint8Array(actualHash);
  let difference = left.length ^ right.length;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ (right[index] ?? 0);
  }
  return difference === 0;
}

function publicSummary(summary: AutomationSummary): JsonObject {
  return {
    success: true,
    automatic_case_delivery_enabled: summary.automaticCaseDeliveryEnabled,
    counts: {
      pending: summary.pendingCount,
      failed: summary.failedCount,
      completed_last_24h: summary.completedLast24hCount,
    },
  };
}

export function createAutomationSettingsHandler(
  dependencies: AutomationSettingsDependencies,
) {
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
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
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
    const operation = parseAutomationOperation(payload);
    if (!operation) return json(400, { success: false, error: "invalid_request" });
    try {
      const summary = operation.action === "get"
        ? await dependencies.getSummary()
        : await dependencies.setEnabled(operation.enabled);
      if (operation.action === "set") {
        dependencies.logger?.info?.("automatic delivery setting changed");
      }
      return json(200, publicSummary(summary));
    } catch {
      return json(500, { success: false, error: "internal_error" });
    }
  };
}

function parseSummary(value: unknown): AutomationSummary {
  if (
    !isPlainObject(value) ||
    typeof value.automatic_case_delivery_enabled !== "boolean" ||
    !Number.isInteger(value.pending_count) || Number(value.pending_count) < 0 ||
    !Number.isInteger(value.failed_count) || Number(value.failed_count) < 0 ||
    !Number.isInteger(value.completed_last_24h_count) || Number(value.completed_last_24h_count) < 0
  ) throw new Error("invalid_automation_summary");
  return {
    automaticCaseDeliveryEnabled: value.automatic_case_delivery_enabled,
    pendingCount: Number(value.pending_count),
    failedCount: Number(value.failed_count),
    completedLast24hCount: Number(value.completed_last_24h_count),
  };
}

export function createSupabaseAutomationSettingsStore(
  supabaseUrl?: string,
  serviceRoleKey?: string,
  fetcher: typeof fetch = fetch,
) {
  async function rpc(name: string, body: JsonObject): Promise<AutomationSummary> {
    if (!supabaseUrl || !serviceRoleKey) throw new Error("missing_configuration");
    const response = await fetcher(`${supabaseUrl}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error("automation_settings_database_failed");
    return parseSummary(await response.json().catch(() => null));
  }
  return {
    getSummary: () => rpc("get_eco_automation_summary", {}),
    setEnabled: (enabled: boolean) => rpc("set_eco_automatic_delivery_enabled", {
      p_enabled: enabled,
      p_updated_by: "local-operations-panel",
    }),
  };
}

if (import.meta.main) {
  const store = createSupabaseAutomationSettingsStore(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  );
  Deno.serve(createAutomationSettingsHandler({
    secret: Deno.env.get("ECO_DELIVERY_ADMIN_SECRET"),
    ...store,
    logger: {
      info: (message) => console.info(message),
      error: (message) => console.error(message),
    },
  }));
}
