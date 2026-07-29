# ECO-SP-001 backend requirements

## Finding

Yes. The last ECO implementation saved detailed backend handoff documentation.
The frontend and its local contract tests were added in commit `9044a26`
(`[ECO-P01-CP001] Validate complete sandbox flow`), but the handoffs explicitly
state that the ECO-SP-001 backend, database schema, Mercado Pago preference,
webhook, credentials, and remote configuration have not been created.

This file consolidates what the saved documentation says must be implemented.
It is a summary, not a replacement for the source handoffs.

## Source documents

- [`docs/eco-sp-001-backend-plan-prompt.md`](../../docs/eco-sp-001-backend-plan-prompt.md):
  dependency-ordered implementation prompt.
- [`docs/eco-sp-001-backend-handoff.md`](../../docs/eco-sp-001-backend-handoff.md):
  answer-validation endpoint and security requirements.
- [`docs/eco-sp-001-buyer-payload.md`](../../docs/eco-sp-001-buyer-payload.md):
  accepted buyer payload and normalization rules.
- [`docs/eco-sp-001-orders-checkout-handoff.md`](../../docs/eco-sp-001-orders-checkout-handoff.md):
  Supabase order schema, checkout endpoint, and Mercado Pago preference.
- [`docs/eco-sp-001-webhook-status-handoff.md`](../../docs/eco-sp-001-webhook-status-handoff.md):
  signed payment webhook, state transitions, and public status endpoint.

The corresponding frontend contracts are under
[`app/eco/eco-sp-001/`](../../app/eco/eco-sp-001/).

## Required architecture

- Preserve the Next.js static export.
- Use Cloudflare Pages as the authoritative origin for same-origin server
  endpoints. The saved implementation prompt says the repository's older
  GitHub Pages documentation is stale for this flow.
- Store orders in Supabase, accessed only by a server-side service role.
- Use Mercado Pago Checkout Pro with test/sandbox credentials.
- Keep canonical answers, credentials, buyer data, raw provider responses, and
  sensitive request bodies out of client assets, analytics, responses, and
  logs.

## Implementation order

### 1. Server-side answer validation

Create:

```http
POST /api/eco/eco-sp-001/validate
Content-Type: application/json

{ "answer": "normalized user input" }
```

Return HTTP 200 with only:

```json
{ "correct": true }
```

or:

```json
{ "correct": false }
```

Requirements:

- Read the canonical answer only from the server binding
  `ECO_SP_001_ANSWER`; never use a `NEXT_PUBLIC_*` variable.
- Re-normalize both submitted and canonical values server-side using Unicode
  NFD, removal of Unicode diacritic marks, Portuguese-locale lowercase,
  trimming, and collapse of repeated whitespace.
- Accept only POST and JSON; limit the body to about 4 KiB.
- Require a plain object containing a non-empty string `answer`; the frontend
  limits it to 200 characters.
- Apply same-origin protection.
- Return generic 500/503 errors without naming missing configuration or leaking
  the answer.
- Set `Content-Type: application/json; charset=utf-8` and
  `Cache-Control: no-store` on responses.
- Never log either answer or the request body.

The normalization example is
[`answer-normalization.mjs`](../../app/eco/eco-sp-001/answer-normalization.mjs),
but the backend must apply the rules independently.

### 2. Supabase order schema and checkout creation

Add a timestamped Supabase migration creating `public.eco_orders`.

The table must include:

- UUID primary key and a unique, opaque, non-guessable public reference;
- fixed case ID, integer amount in cents, three-character currency, and order
  status;
- normalized buyer name, email, WhatsApp, and separate address fields;
- unique idempotency key;
- nullable unique Mercado Pago preference ID;
- immutable unique external reference linked to the internal order;
- nullable unique provider payment ID;
- created, updated, and provider-status timestamps;
- allowed statuses: `pending`, `paid`, `rejected`, `cancelled`, and `refunded`.

Database checks must fix this product to:

```text
case_id     = eco-sp-001
amount_cents = 7990
currency    = BRL
initial status = pending
```

Enable RLS, revoke browser roles, create no public policy, and perform access
only through server-side service-role operations.

Create:

```http
POST /api/eco/eco-sp-001/orders
Content-Type: application/json
Accept: application/json
Idempotency-Key: <UUID retained by the client for retries>
```

The body contains only:

```json
{
  "buyer": {
    "name": "Buyer name",
    "email": "buyer@example.com",
    "whatsapp": "5511999999999",
    "address": {
      "street": "Street",
      "number": "123",
      "complement": "",
      "neighborhood": "Neighborhood",
      "city": "City",
      "state": "SP",
      "postalCode": "01001000"
    }
  }
}
```

Revalidate every buyer field server-side. The client must not control case ID,
product title, price, currency, state, return URLs, or provider identifiers.

Create one Mercado Pago Checkout Pro preference with:

- one item, quantity `1`, currency `BRL`, unit price `79.90`;
- the server-approved product title;
- payer/shipping data derived only from the validated buyer payload;
- the stored immutable external reference;
- HTTPS `success`, `pending`, and `failure` back URLs targeting
  `/eco/eco-sp-001/status?order=:orderReference`;
- the webhook notification URL from step 3;
- `auto_return: "approved"`;
- sandbox credentials and a provider idempotency key where supported.

Persist the preference ID and sandbox checkout URL before responding. Repeated
or concurrent requests with the same idempotency key must resolve to the same
order and preference. If preference creation fails, retain a recoverable
pending order so the same key can retry.

Return HTTP 200 or 201 with only:

```json
{
  "checkoutUrl": "https://sandbox.mercadopago.com/...",
  "orderReference": "opaque-non-guessable-reference"
}
```

Set `Cache-Control: no-store`. The current browser accepts only HTTPS sandbox
Mercado Pago hosts.

### 3. Signed Mercado Pago payment webhook

Create:

```http
POST /api/eco/eco-sp-001/webhooks/mercado-pago
```

Before implementation, re-check Mercado Pago's current official webhook
signature specification. Prove the official validator works in the Cloudflare
runtime, or implement the verified HMAC construction with Web Crypto and
constant-time comparison using official test vectors. Never accept unverifiable
notifications.

Requirements:

- Require `x-signature`, `x-request-id`, and the signed `data.id`.
- Reject missing or invalid signatures with HTTP 401 before provider or
  database access.
- Accept only the `payment` topic.
- Treat the webhook as a resource pointer and fetch the authoritative payment
  from Mercado Pago using the server access token.
- Require a sandbox payment and validate payment ID, external reference,
  `eco-sp-001`, amount `7990`, and currency `BRL`.
- Resolve the order only through the immutable external reference.
- Store the provider payment ID and authoritative provider timestamps.
- Process event recording and order mutation transactionally, with unique
  processed-event and payment identifiers.
- Make duplicate and concurrent deliveries idempotent.
- Protect against out-of-order events using authoritative timestamps: never
  downgrade `paid` to pending/rejected/cancelled, allow `paid` to become
  `refunded` only from an authoritative refund, and never replace a newer state
  with an older observation.
- Return success only after safe processing or recognition of an idempotent
  duplicate; use retryable 5xx responses for provider/database failures.
- Log only non-sensitive operational metadata and correlation identifiers.

Provider-state mapping:

| Mercado Pago | Public order state |
| --- | --- |
| `approved` | `paid` |
| `pending`, `in_process` | `pending` |
| `rejected` | `rejected` |
| `cancelled` | `cancelled` |
| `refunded` | `refunded` |

Other states require explicit review.

### 4. Public order-status read

Create:

```http
GET /api/eco/eco-sp-001/orders/:orderReference/status
```

Return only:

```json
{
  "status": "pending",
  "updatedAt": "2026-08-01T12:30:00.000Z"
}
```

Requirements:

- Accept an opaque reference matching the frontend contract
  `[A-Za-z0-9_-]{16,200}`.
- Query only `status` and `updated_at` through the service role.
- Return 404 for an unknown reference and generic 503 for configuration or
  database failure.
- Rate-limit abusive reads and set `Cache-Control: no-store`.
- Never return buyer, internal-order, provider, address, token, or raw-response
  data.
- Never infer status from Mercado Pago return query parameters. The server
  record updated by the signed webhook is authoritative.
- Keep reads lightweight: the current client polls every five seconds, at most
  twelve times per page load, and stops on a terminal state.

## Server-only configuration

Configure separate local/preview and production bindings:

```text
ECO_SP_001_ANSWER
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
MERCADO_PAGO_ACCESS_TOKEN
MERCADO_PAGO_WEBHOOK_SECRET
```

Use only test/sandbox Mercado Pago credentials during implementation. Do not
commit credentials, use production payment credentials, deploy, or modify
remote configuration without explicit authorization.

## Verification required by the handoffs

- Use injected synthetic answers and secrets; never hard-code the real answer.
- Mock Supabase and Mercado Pago first.
- Test malformed JSON, wrong methods/content types, oversized bodies, missing
  configuration, every invalid buyer field, and generic non-leaking errors.
- Test answer case, accents, and whitespace equivalence plus incorrect answers.
- Test fixed server-side product fields and all return URLs.
- Test database/provider failures, retry recovery, duplicate and concurrent
  idempotency, valid/invalid signatures, every mapped provider state,
  mismatched amount/currency/case/reference, and out-of-order delivery.
- Test every public status and prove checkout return query parameters cannot
  alter it.
- Scan the generated `out` directory for the canonical answer and every
  server-only value.
- Only after mocked tests pass, apply the migration to a dedicated test
  Supabase project and exercise the Mercado Pago simulator/full sandbox flow.

## Decisions still intentionally open

- Approve the exact product title used in the Mercado Pago preference.
- Confirm the Cloudflare Pages project and its same-origin/function routing.
- Re-verify Mercado Pago's current signature algorithm and Cloudflare runtime
  compatibility at implementation time.
- Choose the concrete transaction/RPC design for atomic webhook processing.
- Choose rate limits and the exact same-origin enforcement suitable for the
  final Pages deployment.
