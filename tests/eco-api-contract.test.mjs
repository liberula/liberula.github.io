import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOrderEndpoint,
  buildOrderStatusEndpoint,
  buildValidationEndpoint,
} from "../app/eco/eco-sp-001/eco-api-contract.mjs";

const apiBaseUrl =
  "https://project.supabase.co/functions/v1/eco-sp-001-api";

test("builds every ECO endpoint from the configured base URL", () => {
  assert.equal(
    buildValidationEndpoint(apiBaseUrl),
    `${apiBaseUrl}/validate`,
  );
  assert.equal(buildOrderEndpoint(apiBaseUrl), `${apiBaseUrl}/orders`);
  assert.equal(
    buildOrderStatusEndpoint(apiBaseUrl, "order_01J123456789ABCDEFGH"),
    `${apiBaseUrl}/orders/order_01J123456789ABCDEFGH/status`,
  );
});

test("normalizes trailing slashes", () => {
  assert.equal(
    buildValidationEndpoint(`${apiBaseUrl}///`),
    `${apiBaseUrl}/validate`,
  );
});

for (const invalidBaseUrl of [
  undefined,
  "",
  "/api/eco/eco-sp-001",
  "http://api.example.com",
  "https://user:password@example.com/api",
  "https://example.com/api?target=other",
]) {
  test(`rejects unsafe API base URL ${JSON.stringify(invalidBaseUrl)}`, () => {
    assert.equal(buildValidationEndpoint(invalidBaseUrl), null);
    assert.equal(buildOrderEndpoint(invalidBaseUrl), null);
  });
}

test("allows HTTP only for local development", () => {
  assert.equal(
    buildValidationEndpoint("http://localhost:54321/functions/v1/eco-sp-001-api"),
    "http://localhost:54321/functions/v1/eco-sp-001-api/validate",
  );
});
