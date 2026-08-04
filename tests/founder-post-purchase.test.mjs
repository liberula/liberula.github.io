import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migration = await read("supabase/migrations/20260804020000_add_eco_founder_post_purchase_message.sql");
const webhook = await read("supabase/functions/eco-sp-001-mercado-pago-webhook/index.ts");
const dispatcher = await read("supabase/functions/eco-founder-post-purchase-dispatch/index.ts");
const record = await read("supabase/functions/eco-founder-record/index.ts");
const renderer = await read("lib/eco/founder-post-purchase-email.mjs");
const config = await read("supabase/config.toml");
const recordPage = await read("app/eco/eco-sp-001/registros/quina-final/page.tsx");
const recordClient = await read("app/eco/eco-sp-001/registros/quina-final/FounderRecord.tsx");

test("only a future authoritative transition to paid enqueues one founder message", () => {
  assert.match(migration, /after update of status on public\.eco_orders/i);
  assert.match(migration, /new\.status = 'paid' and old\.status is distinct from 'paid'/i);
  assert.match(migration, /unique \(order_id, message_type\)/i);
  assert.match(migration, /on conflict \(order_id, message_type\) do nothing/i);
  assert.doesNotMatch(migration, /insert into public\.eco_founder_messages[^;]*select/is);
  assert.match(webhook, /mappedStatus === "paid"/);
  assert.doesNotMatch(webhook, /buyer_email|buyerEmail/);
});

test("message delivery is separately claimed, completed, failed, and bounded", () => {
  for (const expected of [
    "claim_eco_founder_messages",
    "complete_eco_founder_message",
    "fail_eco_founder_message",
    "retry_eco_founder_message",
    "attempt_count between 0 and 3",
    "postmark_result_unknown",
    "interval '5 minutes'",
    "interval '30 minutes'",
  ]) assert.ok(migration.includes(expected), expected);
  assert.match(dispatcher, /eco_founder_email_requested/);
  assert.match(dispatcher, /eco_founder_email_sent/);
  assert.match(dispatcher, /eco_founder_email_failed/);
  assert.doesNotMatch(dispatcher, /console\.(?:info|error).*buyer/);
});

test("record capability is opaque, protected, noindex, rate-limited, and refund-aware", () => {
  assert.match(migration, /access_token ~ '\^\[a-f0-9\]\{64\}\$'/);
  assert.match(migration, /orders\.status = 'paid'/);
  assert.match(migration, /orders\.status = 'refunded' and message\.sent_at is not null/);
  assert.match(migration, /revoke all on table public\.eco_founder_messages from anon, authenticated/i);
  assert.match(record, /X-Robots-Tag/);
  assert.match(record, /noindex, nofollow, noarchive/);
  assert.match(record, /consume_eco_status_rate_limit/);
  assert.match(record, /Cache-Control/);
  assert.match(record, /no-store/);
  assert.doesNotMatch(record, /buyer_email|buyer_name|buyer_whatsapp/);
  assert.match(recordPage, /index: false/);
  assert.match(recordPage, /referrer: "no-referrer"/);
  assert.match(recordClient, /sandbox="allow-scripts"/);
  assert.doesNotMatch(recordClient, /ME TIRA DAQUI|Cacete|entidade fugindo/i);
});

test("email and record preserve the approved narrative and privacy boundaries", () => {
  assert.match(renderer, /E\.C\.O\. \/\/ Registro final do agente Quina/);
  assert.match(renderer, /ACESSO FUNDADOR CONFIRMADO/);
  assert.match(renderer, /OUVIR REGISTRO RECUPERADO/);
  assert.doesNotMatch(renderer, /alt="[^"]*(entidade|reflexo|monstro|criatura)/i);
  assert.doesNotMatch(renderer, /próximo caso/i);
  for (const line of [
    "Isso é fantástico.",
    "Cacete...",
    "CÓDIGO ÍNDIGO!",
    "Tem uma entidade fugindo!",
    "Ela fechou a porta!",
    "ME TIRA DAQUI!",
    "[TRANSMISSÃO INTERROMPIDA]",
  ]) assert.ok(record.includes(line), line);
});

test("new public functions are gateway-public but enforce their own contracts", () => {
  assert.match(config, /\[functions\.eco-founder-post-purchase-dispatch\]\s+verify_jwt = false/s);
  assert.match(config, /\[functions\.eco-founder-record\]\s+verify_jwt = false/s);
  assert.match(dispatcher, /secretsMatch/);
  assert.match(record, /TOKEN_PATTERN/);
});

test("the approved founder image is bundled privately and served only after capability validation", async () => {
  await access(new URL("../supabase/functions/eco-founder-record/assets/quina-final-transmission.png", import.meta.url));
  assert.match(config, /static_files = \["\.\/functions\/eco-founder-record\/assets\/quina-final-transmission\.png"\]/);
  assert.match(dispatcher, /&asset=image/);
  assert.match(record, /asset === "image"/);
  assert.match(record, /imageResponse\(await dependencies\.loadImage\(\)\)/);
  assert.doesNotMatch(dispatcher, /public\/eco\/eco-sp-001\/quina-final-transmission/);
});
