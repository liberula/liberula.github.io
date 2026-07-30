import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../supabase/migrations/20260730000000_add_founder_campaign_referrals.sql",
    import.meta.url,
  ),
  "utf8",
);
const normalized = migration.replace(/\s+/g, " ");

test("campaign configuration is server-side and does not close at the goal", () => {
  assert.match(normalized, /production_target integer not null/);
  assert.match(normalized, /'eco-sp-001-founder'/);
  assert.match(normalized, /'2026-08-31 23:59:59-03'/);
  assert.match(
    normalized,
    /when confirmed_count >= campaign\.production_target then 'goal_reached'/,
  );
  assert.match(
    normalized,
    /when campaign\.explicitly_closed or clock_timestamp\(\) > campaign\.closes_at then 'closed'/,
  );
});

test("public progress counts only the canonical paid state", () => {
  const progressFunction = normalized.slice(
    normalized.indexOf("create or replace function public.get_eco_campaign_progress"),
    normalized.indexOf(
      "create or replace function public.process_eco_payment_event",
    ),
  );
  assert.match(progressFunction, /status = 'paid'/);
  assert.doesNotMatch(progressFunction, /pending|rejected|cancelled/);
  assert.match(progressFunction, /'confirmed', confirmed_count/);
  assert.doesNotMatch(
    progressFunction,
    /buyer_name|buyer_email|buyer_whatsapp|provider_payment_id/,
  );
});

test("referral codes are opaque, unique, normalized, and not authentication", () => {
  assert.match(
    normalized,
    /encode\(extensions\.gen_random_bytes\(8\), 'hex'\)/,
  );
  assert.match(
    normalized,
    /create extension if not exists pgcrypto with schema extensions/,
  );
  assert.match(normalized, /generation_attempts >= 100/);
  assert.match(normalized, /unique \(referral_code\)/);
  assert.match(normalized, /referral_code ~ '\^\[A-F0-9\]\{12\}\$'/);
  assert.match(normalized, /where campaign_id = 'eco-sp-001-founder'/);
  assert.match(normalized, /and status = 'paid'/);
  assert.match(normalized, /referrer_order_id <> id/);
});

test("conversion is transactional, paid-only, same-campaign, and idempotent", () => {
  assert.match(normalized, /p_mapped_order_status = 'paid'/);
  assert.match(normalized, /selected_order\.referral_converted_at is null/);
  assert.match(
    normalized,
    /referrer\.campaign_id = referred\.campaign_id/,
  );
  assert.match(normalized, /referrer\.status = 'paid'/);
  assert.match(normalized, /referrer\.id <> referred\.id/);
  assert.match(normalized, /where observation_key = p_observation_key/);
  assert.match(normalized, /'result', 'duplicate'/);
  assert.match(normalized, /'eco_referral_converted'/);
});

test("browser roles retain no raw campaign or order access", () => {
  assert.match(
    normalized,
    /alter table public\.eco_campaigns enable row level security/,
  );
  assert.match(
    normalized,
    /revoke all on table public\.eco_campaigns from anon, authenticated/,
  );
  assert.match(
    normalized,
    /revoke all on function public\.get_eco_campaign_progress\(\) from public, anon, authenticated/,
  );
});
