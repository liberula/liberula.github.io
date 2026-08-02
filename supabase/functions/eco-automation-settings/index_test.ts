import {
  createAutomationSettingsHandler,
  parseAutomationOperation,
  type AutomationSummary,
} from "./index.ts";

const SECRET = "synthetic-admin-secret-at-least-32-characters";
const summary = (enabled = false): AutomationSummary => ({
  automaticCaseDeliveryEnabled: enabled,
  pendingCount: 2,
  failedCount: 1,
  completedLast24hCount: 4,
});
function assert(condition: unknown, message = "assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}
function request(payload: unknown, secret = SECRET) {
  return new Request("http://localhost/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
    body: JSON.stringify(payload),
  });
}

Deno.test("settings parser requires exact get and set fields", () => {
  assert(parseAutomationOperation({ action: "get" })?.action === "get");
  assert(parseAutomationOperation({ action: "get", extra: true }) === null);
  assert(parseAutomationOperation({ action: "set", automatic_case_delivery_enabled: true })?.action === "set");
  assert(parseAutomationOperation({ action: "set" }) === null);
});

Deno.test("get reads persisted state and bounded counters", async () => {
  const response = await createAutomationSettingsHandler({
    secret: SECRET,
    getSummary: async () => summary(false),
    setEnabled: async () => summary(true),
  })(request({ action: "get" }));
  assert(response.status === 200);
  const body = await response.json();
  assert(body.automatic_case_delivery_enabled === false);
  assert(body.counts.pending === 2 && body.counts.failed === 1);
});

Deno.test("enabling and disabling require authentication and persist", async () => {
  let persisted = false;
  const handler = createAutomationSettingsHandler({
    secret: SECRET,
    getSummary: async () => summary(persisted),
    setEnabled: async (enabled) => { persisted = enabled; return summary(enabled); },
  });
  assert((await handler(request({ action: "set", automatic_case_delivery_enabled: true }, "wrong"))).status === 401);
  const enabled = await handler(request({ action: "set", automatic_case_delivery_enabled: true }));
  assert((await enabled.json()).automatic_case_delivery_enabled === true);
  assert((await (await handler(request({ action: "get" }))).json()).automatic_case_delivery_enabled === true);
  await handler(request({ action: "set", automatic_case_delivery_enabled: false }));
  assert(persisted === false);
});

Deno.test("setting logs contain no secret or participant data", async () => {
  const logs: string[] = [];
  await createAutomationSettingsHandler({
    secret: SECRET,
    getSummary: async () => summary(),
    setEnabled: async () => summary(true),
    logger: { info: (value) => logs.push(value), error: (value) => logs.push(value) },
  })(request({ action: "set", automatic_case_delivery_enabled: true }));
  assert(!logs.join(" ").includes(SECRET));
  assert(!logs.join(" ").includes("@"));
});
