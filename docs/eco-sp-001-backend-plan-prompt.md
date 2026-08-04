# Handoff prompt: implement the ECO-SP-001 backend

Use the following prompt to start the later backend plan:

> Implement the deferred server-side backend for ECO-SP-001 in the Liberula
> repository. Cloudflare Pages is the authoritative origin even though the
> checked-in GitHub Pages documentation is stale. Preserve the static Next.js
> export and implement Cloudflare-compatible server endpoints plus Supabase
> migrations.
>
> Read these handoffs before changing code:
>
> - `docs/eco-sp-001-backend-handoff.md`
> - `docs/eco-sp-001-buyer-payload.md`
> - `docs/eco-sp-001-orders-checkout-handoff.md`
> - `docs/eco-sp-001-webhook-status-handoff.md`
>
> Deliver, in dependency order:
>
> 1. Server-side answer validation at
>    `POST /api/eco/eco-sp-001/validate`, using only
>    `ECO_SP_001_ANSWER`, with Unicode/case/whitespace normalization and no
>    canonical answer in the client bundle.
> 2. A minimal Supabase order migration and
>    `POST /api/eco/eco-sp-001/orders`, defining case `eco-sp-001`, amount
>    `2990` cents, currency `BRL`, digital product identity, and initial `pending` state
>    exclusively on the server. Create Mercado Pago Checkout Pro preferences
>    with sandbox credentials, external-reference linkage, return URLs, and
>    database-backed idempotency.
> 3. A signed Mercado Pago `payment` webhook at
>    `POST /api/eco/eco-sp-001/webhooks/mercado-pago`. Re-check the current
>    official signature specification, prove validation compatibility with the
>    Cloudflare runtime, fetch authoritative payment data from Mercado Pago, and
>    apply transactional, idempotent, out-of-order-safe state transitions.
> 4. A server-controlled read endpoint at
>    `GET /api/eco/eco-sp-001/orders/:orderReference/status` for the existing
>    static status page.
>
> Required server variables are `ECO_SP_001_ANSWER`, `SUPABASE_URL`,
> `SUPABASE_SERVICE_ROLE_KEY`, `MERCADO_PAGO_ACCESS_TOKEN`, and
> `MERCADO_PAGO_WEBHOOK_SECRET`. Use only test/sandbox credentials. Never expose
> secrets, buyer data, canonical answers, raw provider responses, or sensitive
> request bodies in client assets, responses, analytics, or logs.
>
> Mock all external integrations first. Cover malformed requests, missing
> configuration, valid/invalid signatures, every payment state, duplicate and
> concurrent delivery, out-of-order events, external API failures, database
> failures, safe redirects, and asset leak scans. Apply migrations and perform a
> full payment only in a dedicated test environment after automated validation.
> Do not commit credentials, use production payment credentials, deploy, or
> change remote configuration without explicit authorization.
