import {
  type AutomaticJob,
  createAutomaticDispatcherHandler,
  createExistingDeliveryClient,
} from "./index.ts";

const SECRET = "synthetic-admin-secret-at-least-32-characters";
const JOB: AutomaticJob = {
  jobId: "123e4567-e89b-42d3-a456-426614174000",
  participantId: "223e4567-e89b-42d3-a456-426614174001",
  caseId: "eco-sp-001",
  attemptCount: 1,
};
const DELIVERY_ID = "323e4567-e89b-42d3-a456-426614174002";
function assert(condition: unknown, message = "assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}
function request(secret = SECRET) {
  return new Request("http://localhost/dispatch", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
    body: JSON.stringify({ action: "dispatch", limit: 3 }),
  });
}

Deno.test("dispatcher authentication is required", async () => {
  let claims = 0;
  const response = await createAutomaticDispatcherHandler({
    secret: SECRET,
    claimJobs: async () => { claims += 1; return []; },
    prepareDelivery: async () => ({ deliveryId: DELIVERY_ID, status: "pending" }),
    sendDelivery: async () => ({ result: "sent" }),
    completeJob: async () => true,
    failJob: async () => "failed",
  })(request("wrong"));
  assert(response.status === 401 && claims === 0);
});

Deno.test("no claimed jobs means no participant selection or send", async () => {
  let sends = 0;
  const response = await createAutomaticDispatcherHandler({
    secret: SECRET,
    claimJobs: async () => [],
    prepareDelivery: async () => { throw new Error("must not prepare"); },
    sendDelivery: async () => { sends += 1; return { result: "sent" }; },
    completeJob: async () => true,
    failJob: async () => "failed",
  })(request());
  assert(response.status === 200 && sends === 0);
});

Deno.test("success prepares through shared path, sends once, and completes", async () => {
  const calls: string[] = [];
  const response = await createAutomaticDispatcherHandler({
    secret: SECRET,
    claimJobs: async () => [JOB],
    prepareDelivery: async (participantId) => { calls.push(`prepare:${participantId}`); return { deliveryId: DELIVERY_ID, status: "pending" }; },
    sendDelivery: async (deliveryId) => { calls.push(`send:${deliveryId}`); return { result: "sent" }; },
    completeJob: async () => { calls.push("complete"); return true; },
    failJob: async () => { calls.push("fail"); return "failed"; },
  })(request());
  const body = await response.json();
  assert(body.counts.completed === 1);
  assert(calls.join(",") === `prepare:${JOB.participantId},send:${DELIVERY_ID},complete`);
});

Deno.test("transient failure reschedules while ambiguous result fails without retry", async () => {
  for (const [error, disposition, expected] of [
    ["postmark_server_error", "pending", "rescheduled"],
    ["postmark_result_unknown", "failed", "failed"],
  ] as const) {
    let captured = "";
    const response = await createAutomaticDispatcherHandler({
      secret: SECRET,
      claimJobs: async () => [JOB],
      prepareDelivery: async () => ({ deliveryId: DELIVERY_ID, status: "pending" }),
      sendDelivery: async () => ({ result: "failed", error }),
      completeJob: async () => true,
      failJob: async (_jobId, code) => { captured = code; return disposition; },
    })(request());
    const body = await response.json();
    assert(captured === error);
    assert(body.counts[expected] === 1);
  }
});

Deno.test("already sent delivery receives no second email", async () => {
  let sends = 0;
  let failure = "";
  await createAutomaticDispatcherHandler({
    secret: SECRET,
    claimJobs: async () => [JOB],
    prepareDelivery: async () => ({ deliveryId: DELIVERY_ID, status: "sent" }),
    sendDelivery: async () => { sends += 1; return { result: "sent" }; },
    completeJob: async () => true,
    failJob: async (_id, error) => { failure = error; return "failed"; },
  })(request());
  assert(sends === 0 && failure === "already_sent");
});

Deno.test("delivery client calls only existing automatic prepare and send actions", async () => {
  const actions: string[] = [];
  const client = createExistingDeliveryClient(
    "https://synthetic.supabase.co/functions/v1/eco-case-delivery",
    SECRET,
    async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      actions.push(body.action);
      const result = body.action === "prepare_automatic"
        ? { delivery_id: DELIVERY_ID, status: "pending", result: "created" }
        : { delivery_id: DELIVERY_ID, status: "sent", result: "sent" };
      return Response.json({ success: true, results: [result] });
    },
  );
  const prepared = await client.prepareDelivery(JOB.participantId);
  await client.sendDelivery(prepared.deliveryId);
  assert(actions.join(",") === "prepare_automatic,send");
});
