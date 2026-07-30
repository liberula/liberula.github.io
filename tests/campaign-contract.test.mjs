import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCampaignProgressEndpoint,
  buildReferralUrl,
  buildShareMessage,
  buildWhatsAppUrl,
  ECO_CASE_URL,
  normalizeReferralCode,
  parseCampaignProgress,
} from "../app/eco/eco-sp-001/campaign-contract.mjs";

const closesAt = "2026-08-31T23:59:59-03:00";

function progress(confirmed, status, goalReached = confirmed >= 100) {
  return parseCampaignProgress({
    campaignId: "eco-sp-001-founder",
    confirmed,
    target: 100,
    goalReached,
    status,
    closesAt,
  });
}

test("builds the public aggregate endpoint", () => {
  assert.equal(
    buildCampaignProgressEndpoint(
      "https://project.supabase.co/functions/v1/eco-sp-001-api",
    ),
    "https://project.supabase.co/functions/v1/eco-sp-001-api/campaign-progress",
  );
});

for (const confirmed of [0, 1, 37, 99]) {
  test(`parses collecting progress at ${confirmed}`, () => {
    const parsed = progress(confirmed, "collecting");
    assert.equal(parsed.confirmed, confirmed);
    assert.equal(parsed.goalReached, false);
    assert.equal(parsed.displayPercent, confirmed);
  });
}

for (const confirmed of [100, 137]) {
  test(`uses goal reached semantics at ${confirmed}`, () => {
    const parsed = progress(confirmed, "goal_reached");
    assert.equal(parsed.goalReached, true);
    assert.equal(parsed.displayPercent, 100);
  });
}

test("closed remains distinct before and after the goal", () => {
  assert.equal(progress(37, "closed").status, "closed");
  assert.equal(progress(137, "closed").status, "closed");
});

test("rejects inconsistent, private-looking, or malformed progress", () => {
  assert.equal(progress(100, "collecting"), null);
  assert.equal(progress(99, "goal_reached"), null);
  assert.equal(progress(100, "goal_reached", false), null);
  assert.equal(parseCampaignProgress({ confirmed: 0, target: 100 }), null);
});

test("normalizes only opaque referral codes and builds no status capability", () => {
  assert.equal(normalizeReferralCode(" ab7c09de12ff "), "AB7C09DE12FF");
  assert.equal(normalizeReferralCode("buyer@example.com"), null);
  assert.equal(buildReferralUrl(null), ECO_CASE_URL);
  assert.equal(
    buildReferralUrl("AB7C09DE12FF"),
    `${ECO_CASE_URL}?ref=AB7C09DE12FF`,
  );
  assert.doesNotMatch(buildReferralUrl("AB7C09DE12FF"), /order|status|email/i);
});

test("share copy changes at goal and for a paid buyer", () => {
  const collecting = buildShareMessage("collecting", ECO_CASE_URL);
  const reached = buildShareMessage("goal_reached", ECO_CASE_URL);
  const personal = buildShareMessage(
    "personal_paid",
    buildReferralUrl("AB7C09DE12FF"),
  );
  assert.match(collecting, /chegar a 100 investigadores/);
  assert.match(reached, /já foi confirmada/);
  assert.match(personal, /entrei no lote fundador/);
  assert.match(
    decodeURIComponent(new URL(buildWhatsAppUrl(reached)).searchParams.get("text")),
    /produção/,
  );
});

test("unknown progress uses neutral share copy", () => {
  const message = buildShareMessage("unknown", ECO_CASE_URL);
  assert.match(message, /campanha do próximo dossiê físico está em andamento/);
  assert.doesNotMatch(message, /100 investigadores/);
  assert.doesNotMatch(message, /já foi confirmada/);
});
