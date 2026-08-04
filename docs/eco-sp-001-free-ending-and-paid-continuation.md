# ECO-SP-001: operational report and digital mission campaign

## Post-solution structure

The backend remains authoritative for answer validation. A `correct: true`
response unlocks a brief location confirmation followed by one continuous
E.C.O. operational report. The report uses one institutional document
container with internal sections, radio transcripts, photographic annexes,
and a final operational-status footer. It is not a sequence of independent
narrative cards.

The report confirms that Quina entered the investigated building, found the
access anomaly described by Jonas Valença, crossed the passage, and
disappeared. The support team subsequently confirmed and isolated the anomaly;
it did not disappear and the report never replaces it with an ordinary wall.

Final status:

- `ENCONTRAR: concluído`
- `CONTER: em andamento`
- `OCULTAR: ativo`

## Pending photographic assets

No image was created or changed for this work. Two editorial placeholders are
embedded as annexes in the report:

| Asset identifier | Ratio | Purpose |
| --- | --- | --- |
| `eco-sp-001-postsolve-room-threshold` | `16:10` | View from Jonas's room through the former office doorway into the anomalous corridor. |
| `eco-sp-001-postsolve-quina-final-record` | `16:9` | Automatic final record of Quina, from behind, before the second door. |

Each slot exposes `data-asset-id`, `data-asset-ratio`,
`data-asset-status="placeholder"`, and a private editorial description in
`data-editorial-description`. The visible captions are final copy; the
editorial descriptions are not displayed as fictional evidence.

## Liberula note and commercial boundary

After the report closes, a deliberately yellow Liberula product window breaks
the fourth wall. It states that ECO-SP-001 is an independent introductory case
and that the next mission will only be created if the campaign reaches 100
participants.

The offer is exclusively digital:

- founder price: `R$ 29,90`;
- goal: 100 participants;
- delivery: up to 90 days after the goal is reached;
- failed goal: full refund through the original payment method;
- story: not announced and not represented as already written;
- format: online access, no printing required;
- estimated play time: 60 to 120 minutes.

The CTA `FINANCIAR A PRÓXIMA MISSÃO` preserves the existing referral-aware
purchase path. The progress parser caps visual fill at 100% while preserving
the real participant count above the goal. Campaign closure remains controlled
by the existing backend configuration.

## Digital checkout

The browser sends only buyer name, email, and WhatsApp. The Edge Function no
longer builds Mercado Pago shipment data. Migration
`20260803000000_convert_eco_founder_to_digital.sql` makes legacy delivery
columns nullable. `20260804000000_set_eco_founder_price_2990.sql` sets new
orders to 2990 cents while preserving historical 4990- and 7990-cent order
integrity. Existing payment idempotency, referral, status, webhook, and return
contracts remain in place.

The migration and updated Edge Functions must be deployed together by an
operator. This implementation does not apply migrations or deploy remote code.

## Hints and Instagram

Three progressive hints are available locally from the answer panel. Each hint
requires an explicit confirmation, records only its numeric level, and is
preserved in session storage when available. Instagram is never required for
completion or hints. The community link appears only when
`NEXT_PUBLIC_ECO_INSTAGRAM_URL` is configured as an HTTPS Instagram URL.

## Analytics

The flow records bounded events for answer correctness, report release,
photographic annex views, report completion, Liberula-note view, financing
click, each hint level, purchase-page view, checkout start, and checkout
return. No event includes the submitted answer, participant PII, order
reference, or payment data.
