# ECO-SP-001 production launch checklist

The checkout environment is selected only by the server-side
`MERCADO_PAGO_ENVIRONMENT` secret:

- `test` returns the preference `sandbox_init_point`;
- `production` returns the preference `init_point`.

The browser consumes the validated checkout URL returned by the API and does
not choose an environment or construct a Mercado Pago URL.

Before production launch:

- replace the test Access Token with the production Access Token;
- set `MERCADO_PAGO_ENVIRONMENT=production`;
- configure the production webhook URL and its matching secret;
- verify the backend returns the production Checkout Pro URL;
- perform one controlled real-payment smoke test;
- confirm no sandbox URL is returned.

Do not place Mercado Pago credentials in frontend variables, repository files,
test fixtures, or public bundles.
