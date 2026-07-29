import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAnswer } from "../app/eco/eco-sp-001/answer-normalization.mjs";

test("normalizes uppercase and lowercase differences", () => {
  assert.equal(normalizeAnswer("INVESTIGAÇÃO"), normalizeAnswer("investigação"));
});

test("removes accents and diacritics", () => {
  assert.equal(normalizeAnswer("Serviços Telefônica"), "servicos telefonica");
});

test("trims leading and trailing whitespace", () => {
  assert.equal(normalizeAnswer("  local investigado  "), "local investigado");
});

test("collapses repeated internal whitespace", () => {
  assert.equal(
    normalizeAnswer("local \t investigado\nprincipal"),
    "local investigado principal",
  );
});

test("normalizes a combined variation", () => {
  assert.equal(
    normalizeAnswer("  CONCLUSÃO   TELEFÔNICA "),
    "conclusao telefonica",
  );
});

test("normalizes whitespace-only input to an empty string", () => {
  assert.equal(normalizeAnswer(" \t\n "), "");
});
