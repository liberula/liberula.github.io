# Automatic ECO case delivery

## Purpose and boundary

The local operations panel can enable or disable automatic delivery of Case `ECO-SP-001` for future eligible live registrations. The persisted setting is `automatic_case_delivery_enabled`; its migration seed is `false`, so deployment starts with automation `DESLIGADO`.

This is not a participant scan. Enabling the setting never selects historical participants, existing `NÃO ENVIADO` rows, test participants, failed manual deliveries, or registrations received while automation was disabled. Those remain available to the unchanged manual panel workflow.

## Disabled and enabled behavior

With automation disabled, `eco-participant-ingest` still creates or links the participant and source, but the ingestion transaction creates no automatic job, delivery, or email. The participant appears as `NÃO ENVIADO`.

With automation enabled, a new live ingestion outcome of `created` or `linked` creates one durable job for the source event and `eco-sp-001`, unless the participant already has a sent delivery. `duplicate` never creates a job. The unique `(source_event_id, case_id)` constraint makes repeated ingestion idempotent.

The setting is changed through the protected `eco-automation-settings` function and the existing local server proxy. Both use the existing `ECO_DELIVERY_ADMIN_SECRET`; no administrative secret is included in browser assets. Disabling cancels pending jobs immediately. Processing jobs may finish, completed jobs remain completed, and failed jobs are not automatically restarted. Re-enabling affects only later eligible live ingestion events; cancelled jobs remain cancelled.

## Historical backfill protection

The authenticated ingestion contract accepts a bounded top-level delivery context:

- Quaero live `lead-submit`: `delivery_mode = automatic_if_enabled`.
- T008 historical backfill: `delivery_mode = none`.
- Older callers that omit the field: safely default to `none`.

The database validates this value inside the ingestion transaction. It never infers historical status from timestamps. Running or rerunning T008 therefore creates no automatic job and sends no email, regardless of the runtime toggle.

## Job states and processing

`eco_automatic_delivery_jobs` uses:

- `pending`: durable work waiting until `available_at`.
- `processing`: atomically claimed by one dispatcher using `FOR UPDATE SKIP LOCKED`.
- `completed`: the shared delivery path confirmed the Postmark result and marked the delivery sent.
- `failed`: non-retryable, ambiguous, disabled, or retry-exhausted outcome requiring review.
- `cancelled`: pending work cancelled when automation was switched off.

After the transaction commits a job, ingestion makes one bounded best-effort call to `eco-automatic-delivery-dispatch`. A failed immediate invocation does not lose work. The scheduled dispatcher later claims only durable jobs; it never queries arbitrary participants.

The dispatcher contains no email renderer or Postmark client. It calls the existing protected `eco-case-delivery` function with `prepare_automatic`, then the existing `send` action. Manual and automatic operations consequently share delivery creation/reuse, eligibility checks, atomic delivery claim, renderer, Postmark sender, provider result handling, and opening tracking. The delivery records `origin = automatic` or `origin = manual`; the primary panel shows only the label, never job IDs, delivery IDs, or references.

## Retry and interruption safety

At most three automatic attempts are allowed. Retryable failures are `postmark_timeout`, `postmark_network_error`, `postmark_server_error`, and `temporary_dispatch_failure`. Backoff is five minutes after attempt one and thirty minutes after attempt two. Attempt three ends as `retry_limit_reached`.

Authentication/configuration failures, participant or case ineligibility, already-sent state, invalid email, provider rejection, and retry exhaustion are not automatically retried. `postmark_result_unknown` is always failed for human review, never retried.

The dispatcher first recovers jobs left `processing` for ten minutes. A delivery already marked sent completes the job. A delivery left `sending` is treated as `postmark_result_unknown` and is not sent again. A job interrupted before delivery sending may return to the bounded queue only while automation is still enabled.

## Panel operations

The panel shows `LIGADO` or `DESLIGADO`, explanatory copy, and bounded counts for pending, failed, and completed-in-the-last-24-hours automatic jobs. It refreshes on page load, explicit refresh, setting change, and manual operation completion. Enabling and disabling each require an explicit confirmation describing the real-email consequence. Manual send remains available in both states. Automatic failures appear as `FALHA NO ENVIO AUTOMÁTICO` with only an approved generic error category.

## Safe deployment

Use the known project refs:

- Liberula: `icjuacgxxpmwqlmjmeuq`
- Quaero: `ctgzkcxyzsqddltfhblg`

From the Liberula repository, an authorized operator runs:

```bash
supabase link --project-ref icjuacgxxpmwqlmjmeuq
supabase db push
supabase functions deploy eco-case-delivery --no-verify-jwt --project-ref icjuacgxxpmwqlmjmeuq
supabase functions deploy eco-automatic-delivery-dispatch --no-verify-jwt --project-ref icjuacgxxpmwqlmjmeuq
supabase functions deploy eco-automation-settings --no-verify-jwt --project-ref icjuacgxxpmwqlmjmeuq
supabase functions deploy eco-participant-ingest --no-verify-jwt --project-ref icjuacgxxpmwqlmjmeuq
```

From the Quaero repository, deploy the updated live event context:

```bash
supabase link --project-ref ctgzkcxyzsqddltfhblg
supabase functions deploy lead-submit --no-verify-jwt --project-ref ctgzkcxyzsqddltfhblg
```

Do not deploy or execute the T008 backfill as part of this rollout.

## Scheduled recovery

Supabase Cron can invoke an Edge Function on a schedule and records job run history. Configure it in the Liberula project Dashboard under **Integrations → Cron → Create job**:

- Name: `eco-automatic-delivery-recovery`
- Schedule: `*/5 * * * *`
- Method: `POST`
- URL: `https://icjuacgxxpmwqlmjmeuq.supabase.co/functions/v1/eco-automatic-delivery-dispatch`
- Header: `Authorization: Bearer <the existing ECO_DELIVERY_ADMIN_SECRET>`
- Header: `Content-Type: application/json`
- Body: `{"action":"dispatch","limit":3}`

Store the authorization value through Supabase Vault or the Cron UI's protected secret mechanism; do not paste it into source control or a public SQL file. This follows Supabase's documented Cron/`pg_cron` plus Edge Function scheduling model: [Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions) and [Cron](https://supabase.com/docs/guides/cron).

After saving, inspect the Cron run history and confirm successful five-minute invocations. The request is safe while automation is disabled: the claim RPC returns no jobs.

## Failed-job inspection

Use the local panel counter and the affected participant row. `VER ERRO` exposes only the bounded error category. For `postmark_result_unknown`, inspect Postmark Activity before any manual retry. Do not expose raw responses, participant PII, source lead data, delivery references, tokens, or secrets in logs or tickets.

## Controlled live-registration smoke test

1. Start with the toggle showing `DESLIGADO`.
2. Record the current automatic-job count, delivery count, and Postmark activity timestamp.
3. Submit one controlled, unique, consented `eco/free_recruitment` lead through the live Quaero form.
4. Confirm the participant appears as `NÃO ENVIADO`, no automatic job was created, the delivery count did not change, and Postmark has no new activity.
5. Enable automation in the panel and accept the exact real-email confirmation.
6. Submit a second controlled lead using a different inbox you own.
7. Confirm one automatic job, one delivery with origin `AUTOMÁTICO`, exactly one Postmark message, and panel state `ENVIADO`.
8. Open the received link once and confirm the existing opening state changes to `ABRIU`.
9. Disable automation and confirm pending automatic jobs are zero/cancelled.
10. Submit a third controlled lead with another unique inbox. Confirm `NÃO ENVIADO`, no new Postmark activity, and no automatic job.
11. Use the existing manual action for the third participant and confirm exactly one manual email, origin `MANUAL`, and unchanged opening behavior.
12. Remove controlled test data only through the separately approved cleanup procedure.

Exactly-one evidence comes from the single source event/job, one participant/case delivery, one Postmark MessageID/activity entry, and one received inbox message. Do not use repeated live submissions as a substitute for these checks.
