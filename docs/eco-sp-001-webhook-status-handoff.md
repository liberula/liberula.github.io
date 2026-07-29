# ECO-SP-001 webhook and payment status handoff

T004 currently includes only the static status page and its browser contract.
No webhook Function, provider request, database update, secret, or remote
configuration has been created.

Official references:

- [Mercado Pago Webhooks and signature validation](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks)
- [Checkout Pro payment notifications](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/payment-notifications)
- [Get an authoritative payment](https://www.mercadopago.com.br/developers/pt/reference/payments/_payments_id/get)

## Public routes for the future backend

- Webhook: `POST /api/eco/eco-sp-001/webhooks/mercado-pago`
- Status read:
  `GET /api/eco/eco-sp-001/orders/:orderReference/status`
- Buyer page:
  `/eco/eco-sp-001/status?order=:orderReference`

The buyer page ignores checkout `status`, `collection_status`, `payment_id`, and
similar query parameters. They cannot change or supply the displayed state.

The status endpoint must resolve the opaque reference server-side and return
only:

```json
{
  "status": "pending",
  "updatedAt": "2026-08-01T12:30:00.000Z"
}
```

Allowed public states are `pending`, `paid`, `rejected`, `cancelled`, and
`refunded`. Do not return buyer data, internal IDs, provider IDs, addresses,
tokens, or raw provider responses. Add `Cache-Control: no-store`.

## Future webhook implementation

1. Confirm the official Mercado Pago signature specification again when starting
   the backend plan; do not rely only on this handoff.
2. Create a Cloudflare Pages Function for the webhook route above.
3. Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `MERCADO_PAGO_ACCESS_TOKEN`, and `MERCADO_PAGO_WEBHOOK_SECRET` as server-only
   preview bindings.
4. Configure the test webhook URL in Mercado Pago **Suas integrações**, select
   the Checkout Pro `payment` topic, save, and store the generated test signature
   secret only in Cloudflare.
5. Accept only `POST`, enforce a small body limit, and reject malformed JSON.
6. Require `x-signature`, `x-request-id`, and the `data.id` query parameter.
   The current official JavaScript validator consumes exactly those inputs plus
   the secret. Prefer the official validator only after proving that its package
   and cryptography work in the Cloudflare runtime.
7. If the SDK is incompatible, implement the current official HMAC construction
   with Web Crypto and constant-time comparison only after verifying its exact
   manifest and normalization rules against official test vectors. Stop rather
   than accepting unsigned or unverifiable notifications.
8. Reject missing or invalid signatures with HTTP 401 before any provider or
   database operation.
9. Accept only the `payment` topic and require the signed `data.id` to match the
   payment resource indicated by the notification.
10. Treat the notification only as a resource pointer. Fetch
    `GET https://api.mercadopago.com/v1/payments/:id` with the server-side
    sandbox access token.
11. Reject or safely acknowledge resources that are not sandbox payments.
    Validate the authoritative payment ID, `external_reference`, currency, and
    transaction amount before resolving the internal order.
12. Resolve the order through the immutable external reference created in T003.
    Require the stored order to be `eco-sp-001`, `7990` cents, and `BRL`.
13. Map authoritative provider states:
    - `approved` to `paid`;
    - `pending` and `in_process` to `pending`;
    - `rejected` to `rejected`;
    - `cancelled` to `cancelled`;
    - `refunded` to `refunded`.
    Treat any other state as unsupported until explicitly reviewed.
14. Store the provider payment ID and authoritative provider timestamps.
15. Process the event and order update in one database transaction or RPC. Add a
    unique processed-event key and unique provider payment ID.
16. A duplicate event must return success without repeating effects. Fetching
    the provider again is safe, but the database mutation must remain singular.
17. For out-of-order delivery, compare authoritative provider update timestamps
    and enforce transitions in the database:
    - never downgrade `paid` to `pending`, `rejected`, or `cancelled`;
    - allow `paid` to become `refunded` only when the current provider resource
      authoritatively reports a refund;
    - never replace a newer provider state with an older observation.
18. Return HTTP 200/201 only after the notification is safely processed or
    recognized as an idempotent duplicate. Return a retryable 5xx on Mercado Pago
    API or Supabase failure.
19. Emit structured operational logs containing event type, processing outcome,
    latency, and non-sensitive correlation identifiers only. Never log buyer
    fields, request bodies, signatures, tokens, raw provider responses, or
    secrets.

## Future status endpoint

1. Validate the opaque order reference format and rate-limit abusive reads.
2. Query through the service role, selecting only status and `updated_at`.
3. Return 404 for unknown references and a controlled 503 for unavailable
   configuration/database access.
4. Set `Cache-Control: no-store` and never infer status from request query
   parameters.
5. Keep pending reads lightweight; the current client polls every five seconds,
   at most twelve times per page load, and stops on terminal states.

## Backend tests required

Use fixed synthetic secrets and mocked provider/database adapters. Cover:

- current official valid signature and invalid signature;
- missing signature inputs, malformed signature, malformed JSON, and mismatched
  signed resource ID;
- unknown topic, payment, external reference, and order;
- Mercado Pago API failure and Supabase read/update failure;
- authoritative approved, pending/in-process, rejected, cancelled, and refunded
  states;
- amount, currency, case, live-mode, and external-reference mismatches;
- duplicate delivery and concurrent delivery;
- older pending/rejected/cancelled notification after paid;
- authoritative refund after paid;
- non-leaking logs and responses;
- public status responses for every supported state;
- proof that return query parameters cannot change status.

After all mocked tests pass, use only the Mercado Pago webhook simulator and a
dedicated test Supabase project. Resend the same notification and deliberately
deliver older fixtures after newer ones before attempting the full sandbox flow.
