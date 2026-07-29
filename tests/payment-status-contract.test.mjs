import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStatusEndpoint,
  ORDER_STATUSES,
  parseOrderReference,
  parseOrderStatusResponse,
} from "../app/eco/eco-sp-001/payment-status-contract.mjs";

const reference = "order_01J123456789ABCDEFGH";

test("accepts an opaque order reference and builds a same-origin endpoint", () => {
  assert.equal(parseOrderReference(reference), reference);
  assert.equal(
    buildStatusEndpoint(reference),
    `/api/eco/eco-sp-001/orders/${reference}/status`,
  );
});

for (const invalid of [
  null,
  "",
  "short",
  "contains spaces and private data",
  "../admin",
  "x".repeat(201),
]) {
  test(`rejects invalid order reference ${JSON.stringify(invalid)}`, () => {
    assert.equal(parseOrderReference(invalid), null);
    assert.equal(buildStatusEndpoint(invalid), null);
  });
}

for (const status of ORDER_STATUSES) {
  test(`accepts server-controlled ${status} state`, () => {
    assert.deepEqual(parseOrderStatusResponse({ status }), {
      status,
      updatedAt: null,
    });
  });
}

test("accepts a valid server update timestamp", () => {
  assert.deepEqual(
    parseOrderStatusResponse({
      status: "paid",
      updatedAt: "2026-08-01T12:30:00.000Z",
    }),
    {
      status: "paid",
      updatedAt: "2026-08-01T12:30:00.000Z",
    },
  );
});

test("does not expose extra response fields", () => {
  assert.deepEqual(
    parseOrderStatusResponse({
      status: "paid",
      updatedAt: null,
      buyerEmail: "private@example.com",
      amount: 79.9,
    }),
    { status: "paid", updatedAt: null },
  );
});

for (const response of [
  null,
  {},
  { status: "approved" },
  { status: "paid", updatedAt: "not-a-date" },
  { status: "paid", updatedAt: 123 },
]) {
  test(`rejects malformed status response ${JSON.stringify(response)}`, () => {
    assert.equal(parseOrderStatusResponse(response), null);
  });
}

test("a checkout query status is not part of the status endpoint", () => {
  const params = new URLSearchParams({
    order: reference,
    status: "paid",
    collection_status: "approved",
  });
  assert.equal(
    buildStatusEndpoint(params.get("order")),
    `/api/eco/eco-sp-001/orders/${reference}/status`,
  );
});
