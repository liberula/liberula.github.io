import assert from "node:assert/strict";
import test from "node:test";
import { validateBuyerInput } from "../app/eco/eco-sp-001/buyer-validation.mjs";

const validInput = {
  name: "Ana Júlia da Silva",
  email: "ANA.JULIA@example.com",
  whatsapp: "(11) 99876-5432",
  street: "Rua São Bento",
  number: "123",
  complement: "Apto. 42",
  neighborhood: "Sé",
  city: "São Paulo",
  state: "sp",
  postalCode: "01011-100",
};

test("valid buyer data produces the documented normalized payload", () => {
  const result = validateBuyerInput(validInput);
  assert.deepEqual(result.errors, {});
  assert.deepEqual(result.payload, {
    name: "Ana Júlia da Silva",
    email: "ana.julia@example.com",
    whatsapp: "11998765432",
    address: {
      street: "Rua São Bento",
      number: "123",
      complement: "Apto. 42",
      neighborhood: "Sé",
      city: "São Paulo",
      state: "SP",
      postalCode: "01011100",
    },
  });
});

for (const [field, value] of [
  ["name", ""],
  ["name", "   "],
  ["email", "invalid"],
  ["whatsapp", ""],
  ["street", ""],
  ["number", ""],
  ["neighborhood", ""],
  ["city", ""],
  ["state", ""],
  ["postalCode", ""],
]) {
  test(`rejects invalid or missing ${field}`, () => {
    const result = validateBuyerInput({ ...validInput, [field]: value });
    assert.equal(result.payload, null);
    assert.ok(result.errors[field]);
  });
}

test("accepts an empty optional complement", () => {
  const result = validateBuyerInput({ ...validInput, complement: "  " });
  assert.equal(result.payload?.address.complement, "");
});

test("accepts long but reasonable values", () => {
  const result = validateBuyerInput({
    ...validInput,
    name: `Maria ${"A".repeat(110)}`,
    street: `Avenida ${"B".repeat(145)}`,
    neighborhood: "C".repeat(100),
    city: "D".repeat(100),
  });
  assert.ok(result.payload);
  assert.deepEqual(result.errors, {});
});

test("preserves accented names and addresses while trimming whitespace", () => {
  const result = validateBuyerInput({
    ...validInput,
    name: "  Érica   Gonçalves  ",
    street: "  Praça   da Sé ",
    city: "  São   José dos Campos ",
  });
  assert.equal(result.payload?.name, "Érica Gonçalves");
  assert.equal(result.payload?.address.street, "Praça da Sé");
  assert.equal(result.payload?.address.city, "São José dos Campos");
});

test("rejects oversized values", () => {
  const result = validateBuyerInput({
    ...validInput,
    complement: "x".repeat(81),
  });
  assert.equal(result.payload, null);
  assert.ok(result.errors.complement);
});
