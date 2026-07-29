# ECO-SP-001 backend handoff

This repository currently delivers only the static client for the case. Do not
put the canonical answer, Cloudflare secrets, or validation fallback logic in
the Next.js application.

## Future endpoint contract

Create a Cloudflare Pages Function at the route:

`POST /api/eco/eco-sp-001/validate`

The browser sends:

```json
{ "answer": "normalized user input" }
```

Successful validation returns one of these responses with HTTP 200:

```json
{ "correct": true }
```

```json
{ "correct": false }
```

All responses must use `Content-Type: application/json; charset=utf-8` and
`Cache-Control: no-store`. An internal or configuration failure should return a
generic JSON error with HTTP 500 or 503. It must not identify the missing
variable or disclose the answer.

## Cloudflare setup for the later backend plan

1. Confirm the Cloudflare Pages project serving `liberula.com`.
2. Add a Pages Function mapped to
   `/api/eco/eco-sp-001/validate`. Keep it outside the public Next.js bundle.
3. Read the canonical answer only from the server-side binding
   `ECO_SP_001_ANSWER`.
4. Configure that binding separately for local/preview and production
   environments in Cloudflare. Do not prefix it with `NEXT_PUBLIC_`.
5. Accept only `POST`. Reject other methods with HTTP 405.
6. Require an `application/json` request and limit the request body to a small
   size, such as 4 KiB.
7. Require a plain object with one string property named `answer`. Reject empty
   or excessively long answers with HTTP 400.
8. Normalize both the submitted value and the environment value independently:
   Unicode NFD normalization, removal of Unicode diacritic marks, Portuguese
   locale lowercase conversion, trimming, and collapse of internal whitespace.
9. Compare the two normalized strings and return only `{ "correct": boolean }`.
10. Never log the submitted answer, canonical answer, request body, or secret
    binding.
11. Apply same-origin protection appropriate to the final Pages deployment and
    include `Cache-Control: no-store` on every response.

The normalization behavior is demonstrated without a canonical value in
`app/eco/eco-sp-001/answer-normalization.mjs`. The server implementation must
apply the rules itself rather than trusting that the browser normalized input.

## Backend tests required by the later plan

Use an injected environment value in automated tests; do not hard-code the real
answer. Cover:

- exact match;
- lowercase and uppercase variants;
- accented and unaccented variants;
- leading, trailing, and repeated internal whitespace;
- incorrect answer;
- empty, non-string, malformed JSON, oversized, and wrong-method requests;
- missing `ECO_SP_001_ANSWER`;
- generic, non-leaking error responses;
- `Cache-Control: no-store`.

After building the static site, search the generated `out` directory for the
production answer and all server-only environment values before deployment.
