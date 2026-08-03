import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildPurchasePath,
  buildReferralUrl,
  ECO_CASE_URL,
} from "../app/eco/eco-sp-001/campaign-contract.mjs";

const reveal = await readFile(
  new URL("../app/eco/eco-sp-001/PostSolveReveal.tsx", import.meta.url),
  "utf8",
);
const buyerForm = await readFile(
  new URL("../app/eco/eco-sp-001/BuyerForm.tsx", import.meta.url),
  "utf8",
);
const purchase = await readFile(
  new URL(
    "../app/eco/eco-sp-001/comprar/PurchaseExperience.tsx",
    import.meta.url,
  ),
  "utf8",
);
const purchasePage = await readFile(
  new URL("../app/eco/eco-sp-001/comprar/page.tsx", import.meta.url),
  "utf8",
);
const status = await readFile(
  new URL("../app/eco/eco-sp-001/status/PaymentStatus.tsx", import.meta.url),
  "utf8",
);
const api = await readFile(
  new URL("../supabase/functions/eco-sp-001-api/index.ts", import.meta.url),
  "utf8",
);
const landing = await readFile(
  new URL("../app/eco/EcoLanding.tsx", import.meta.url),
  "utf8",
);

test("public and personal sharing use the canonical ECO landing", () => {
  assert.equal(ECO_CASE_URL, "https://liberula.com/eco");
  assert.equal(buildReferralUrl(null), "https://liberula.com/eco");
  assert.equal(
    buildReferralUrl("AB7C09DE12FF"),
    "https://liberula.com/eco?ref=AB7C09DE12FF",
  );
  assert.match(landing, /eco-sp-001:referral-code/);
  assert.match(landing, /normalizeReferralCode/);
});

test("purchase CTA carries safe referral context to the dedicated route", () => {
  assert.equal(buildPurchasePath(null), "/eco/eco-sp-001/comprar");
  assert.equal(
    buildPurchasePath("ab7c09de12ff"),
    "/eco/eco-sp-001/comprar?ref=AB7C09DE12FF",
  );
  assert.match(reveal, /href=\{buildPurchasePath\(referralCode\)\}/);
  assert.match(reveal, /FINANCIAR A PRÓXIMA MISSÃO/);
  assert.doesNotMatch(reveal, /<BuyerForm/);
});

test("dedicated purchase page contains campaign, price, and buyer form", () => {
  assert.match(purchasePage, /<PurchaseExperience \/>/);
  assert.match(purchase, /<FounderProgress/);
  assert.match(purchase, /R\$ 49,90/);
  assert.match(purchase, /Até 90 dias após a meta ser atingida/);
  assert.match(purchase, /60 a 120 minutos/);
  assert.doesNotMatch(purchase, /Endereço de entrega|dossiê físico/iu);
  assert.match(purchase, /<BuyerForm referralCode=\{referralCode\} \/>/);
  assert.match(purchase, /eco_purchase_page_viewed/);
});

test("valid final form submission creates once and redirects immediately", () => {
  assert.match(buyerForm, /if \(submittingRef\.current\) return/);
  assert.match(buyerForm, /idempotencyKeyRef\.current \?\?/);
  assert.match(buyerForm, /fetch\(orderEndpoint/);
  assert.match(buyerForm, /window\.location\.assign\(order\.checkoutUrl\)/);
  assert.match(buyerForm, /CONTINUAR NO MERCADO PAGO/);
  assert.match(buyerForm, /PREPARANDO PAGAMENTO\.\.\./);
  assert.match(buyerForm, /Seus dados foram preservados/);
  assert.doesNotMatch(buyerForm, /Cadastro preparado|CONFIRMAR COMPRA/);
});

test("checkout returns to comprar and only backend status confirms payment", () => {
  assert.match(api, /new URL\("\/eco\/eco-sp-001\/comprar", siteOrigin\)/);
  assert.match(purchase, /parseOrderReference\(searchParams\.get\("order"\)\)/);
  assert.match(purchase, /<PaymentStatusView \/>/);
  assert.match(purchase, /hasCheckoutReturn/);
  assert.match(purchase, /Nenhum pagamento foi presumido/);
  assert.match(status, /parseOrderStatusResponse/);
  assert.match(status, /eco_payment_pending_viewed/);
  assert.match(status, /eco_payment_confirmed_viewed/);
  assert.doesNotMatch(purchase, /collection_status.*paid|status.*approved/s);
});

test("paid state remains confirmation-only", () => {
  assert.match(status, /PAGAMENTO CONFIRMADO/);
  assert.match(status, /Pedido confirmado/);
  for (const source of [purchase, status]) {
    assert.doesNotMatch(
      source,
      /Escher|arquitetura impossível|gritos|áudio final|download secreto/i,
    );
  }
});

test("purchase analytics contain no personal or order identifiers", () => {
  for (const event of [
    "eco_purchase_form_started",
    "eco_purchase_form_submitted",
    "eco_checkout_redirect_started",
    "eco_checkout_returned",
    "eco_payment_pending_viewed",
    "eco_payment_confirmed_viewed",
  ]) {
    assert.ok(`${buyerForm}${purchase}${status}`.includes(event), event);
  }
  for (const source of [buyerForm, purchase, status]) {
    assert.doesNotMatch(source, /payment_id:\s|order_token:\s|buyer_email:\s/);
    assert.doesNotMatch(source, /referral_code:\s*referralCode/);
  }
});
