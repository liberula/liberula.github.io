# ECO-SP-001 free ending and paid continuation

## Canonical resolution boundary

The canonical address is `Rua Benjamin Constant, 200`, `Sé — São Paulo`.
`eco-sp-001-api/validate` is authoritative for answer validation and returns
only `{ "correct": true }` or `{ "correct": false }`. The client begins the
post-answer reveal only after the backend returns `correct: true`; it does not
attempt to validate aliases or require a second resolution payload. Canonical
answers and aliases remain server-only in `ECO_SP_001_ANSWER` and
`ECO_SP_001_ANSWER_ALIASES`.

Address aliases must use 200. The deploy-ready alias list and commands are in
`docs/eco-sp-001-backend-handoff.md`. Updating source does not change the
existing remote secret automatically; an operator must update that secret at
the human checkpoint.

## Post-answer sequence

Only an accepted answer replaces the briefing and answer form with:

1. institutional location confirmation;
2. Quina's physical entry into the real central building through a prepared
   service access;
3. confirmation of the central by technical signs, room numbering, equipment,
   and correspondence with Jonas's records;
4. the degraded but otherwise real administrative and technical interior;
5. a side-by-side comparison of Jonas's doorless photograph and Quina's
   matching frame with an immaculate red door;
6. the short operational transmission;
7. the partial view of a non-Euclidean space beyond the door;
8. Quina's crossing, loss of signal, and the return of the wall photographed
   by Jonas;
9. an ambiguous external-camera record;
10. reclassification as `AMEAÇA NÃO CONTIDA`;
11. the boundary of the free material;
12. restricted-material framing;
13. the founder-lot offer.

The route canon is explicit: the remote doors described by victims led through
intermediate points, not directly to the central. The central was the final
point. It remains a physical, degraded building; the spatial contradiction
begins only beyond the immaculate red door. The public ending describes the
impossible geometry without explaining its origin or nature.

The sequence uses short timed reveals and honors reduced-motion preferences.
No stage requires audio. Incorrect answers expose none of the location,
narrative, evidence, or commercial continuation.

## Visual asset status

The existing Quina operational image remains approved. Final art for the
degraded central interior, Jonas's doorless frame, Quina's matching red-door
frame, the immaculate door, the partial non-Euclidean view, external camera
frame, silhouette, and clothing evidence does not exist in this repository.
The component therefore uses visible placeholders marked in code with
`data-asset-status="placeholder"` and `IMAGEM PENDENTE`; they must not be
represented as final evidence. The Jonas/Quina assets must eventually preserve
the same framing, perspective, walls, and lateral elements.

## Narrative limits

The public ending does not identify the external figure, confirm Lia's fate,
confirm Jonas's fate, explain the door, declare that anything escaped, or kill
Quina. The restricted-material list is explicitly described as an edition in
development and is subject to editorial completion and founder-lot viability.

## Commercial boundary

The first narrative CTA is `CONTINUAR A INVESTIGAÇÃO` and routes to the existing
purchase presentation; it never creates an order automatically. Before the
buyer form and Mercado Pago redirect, the page repeats the product format,
price of `R$ 79,90`, production goal of 100 investigators, closing date of
31/08/2026, estimated delivery of 15 days after production confirmation,
failed-goal cancellation/refund rule, and online-purchase return rule.

If the production goal is not reached, the disclosed policy is cancellation of
production and full return of paid values through the original payment method.
For online cancellation, the page states the seven-day withdrawal period from
contracting or receipt, as applicable, with full restitution. The latter is
based on Article 49 of Brazil's Consumer Defense Code:
https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm

## Tracking and privacy

Existing events remain intact:

- `eco_case_answer_correct`
- `eco_case_reveal_started`
- `eco_case_agent_report_viewed`
- `eco_case_white_room_viewed` (legacy visual-evidence event name)
- `eco_case_quina_log_viewed`
- `eco_case_red_door_revealed`
- `eco_case_offer_viewed`
- `eco_case_offer_cta_clicked`
- `eco_purchase_cta_clicked`

The new `eco_case_free_ending_completed` event records the view of the
reclassification boundary. Events contain bounded case/campaign state only;
they contain no submitted answer, resolved address, name, email, private
reference, or payment data.

## Operator verification

Test both an incorrect and an accepted answer through the server endpoint.
Inspect the full sequence on mobile, desktop, keyboard navigation, and reduced
motion. Confirm the offer appears only after reclassification, then open the
dedicated purchase page and verify the commercial facts before testing the
existing checkout with an authorized sandbox procedure.
