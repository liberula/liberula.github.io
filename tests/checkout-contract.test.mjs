import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOrderEndpoint,
  createOrderRequest,
  parseOrderResponse,
} from "../app/eco/eco-sp-001/checkout-contract.mjs";

const buyer = {
  name: "Ana Júlia da Silva",
  email: "ana@example.com",
  whatsapp: "11998765432",
  address: {
    street: "Rua São Bento",
    number: "123",
    complement: "",
    neighborhood: "Sé",
    city: "São Paulo",
    state: "SP",
    postalCode: "01011100",
  },
};

test("builds the order endpoint from the configured API base URL", () => {
  assert.equal(
    buildOrderEndpoint(
      "https://project.supabase.co/functions/v1/eco-sp-001-api/",
    ),
    "https://project.supabase.co/functions/v1/eco-sp-001-api/orders",
  );
});

test("order request contains only buyer data", () => {
  assert.deepEqual(createOrderRequest(buyer), { buyer });
  assert.deepEqual(Object.keys(createOrderRequest(buyer)), ["buyer"]);
});

test("accepts an official Mercado Pago sandbox checkout response", () => {
  assert.deepEqual(
    parseOrderResponse({
      checkoutUrl:
        "https://sandbox.mercadopago.com/mla/checkout/pay?pref_id=test",
      orderReference: "opaque-order-reference",
    }),
    {
      checkoutUrl:
        "https://sandbox.mercadopago.com/mla/checkout/pay?pref_id=test",
      orderReference: "opaque-order-reference",
    },
  );
});

test("accepts the Brazilian sandbox hostname", () => {
  assert.ok(
    parseOrderResponse({
      checkoutUrl:
        "https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=test",
      orderReference: "opaque-order-reference",
    }),
  );
});

for (const [name, value] of [
  ["non-object response", null],
  [
    "non-HTTPS checkout",
    {
      checkoutUrl:
        "http://sandbox.mercadopago.com/mla/checkout/pay?pref_id=test",
      orderReference: "reference",
    },
  ],
  [
    "untrusted checkout host",
    {
      checkoutUrl: "https://attacker.example/checkout",
      orderReference: "reference",
    },
  ],
  [
    "lookalike checkout host",
    {
      checkoutUrl: "https://sandbox.mercadopago.com.attacker.example/checkout",
      orderReference: "reference",
    },
  ],
  [
    "missing order reference",
    {
      checkoutUrl:
        "https://sandbox.mercadopago.com/mla/checkout/pay?pref_id=test",
      orderReference: "",
    },
  ],
]) {
  test(`rejects ${name}`, () => {
    assert.equal(parseOrderResponse(value), null);
  });
}
