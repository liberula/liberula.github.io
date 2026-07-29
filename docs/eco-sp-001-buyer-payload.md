# ECO-SP-001 buyer payload handoff

The founder form validates and prepares buyer data locally. It does not create
an order, contact Supabase, or open Mercado Pago.

The future server-controlled order endpoint should accept only this buyer
payload from the client:

```ts
type BuyerPayload = {
  name: string;
  email: string;
  whatsapp: string;
  address: {
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
    postalCode: string;
  };
};
```

Normalization performed by the form:

- surrounding whitespace is removed and repeated internal whitespace collapses;
- email is lowercased;
- WhatsApp contains only 10–15 digits;
- state is an uppercase two-letter UF;
- postal code contains exactly eight digits;
- complement is optional and becomes an empty string when omitted.

The future endpoint must validate every field again. It must define the case,
product, amount, and currency server-side rather than accepting them from the
browser. Buyer data must not be written to logs or analytics.
