import assert from "node:assert/strict";
import test from "node:test";
import { validateBuyerInput } from "../app/eco/eco-sp-001/buyer-validation.mjs";

const validInput = {
  name: "Ana Júlia da Silva",
  email: "ANA.JULIA@example.com",
  whatsapp: "(11) 99876-5432",
};

test("valid digital buyer data produces a contact-only normalized payload", () => {
  const result = validateBuyerInput(validInput);
  assert.deepEqual(result.errors, {});
  assert.deepEqual(result.payload, {
    name: "Ana Júlia da Silva",
    email: "ana.julia@example.com",
    whatsapp: "11998765432",
  });
  assert.equal("address" in result.payload, false);
});

for (const [field, value] of [
  ["name", ""],
  ["name", "   "],
  ["email", "invalid"],
  ["whatsapp", ""],
]) {
  test(`rejects invalid or missing ${field}`, () => {
    const result = validateBuyerInput({ ...validInput, [field]: value });
    assert.equal(result.payload, null);
    assert.ok(result.errors[field]);
  });
}

test("preserves accented names while trimming whitespace", () => {
  const result = validateBuyerInput({
    ...validInput,
    name: "  Érica   Gonçalves  ",
  });
  assert.equal(result.payload?.name, "Érica Gonçalves");
});

test("rejects oversized contact values", () => {
  const result = validateBuyerInput({
    ...validInput,
    name: "x".repeat(121),
  });
  assert.equal(result.payload, null);
  assert.ok(result.errors.name);
});
