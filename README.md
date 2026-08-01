This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

## Landing de recrutamento E.C.O.

A rota `/eco` é uma landing gratuita de recrutamento e permanece compatível com o
export estático do GitHub Pages. O formulário envia JSON à Edge Function pública
`eco-lead`, que valida e grava o lead no Supabase sem expor credenciais no navegador.
O payload inclui projeto, funil, nome, e-mail, consentimento, UTMs, `fbclid`, URL,
referrer, metadata e um honeypot de proteção mínima contra spam.

### Variáveis de ambiente

```env
NEXT_PUBLIC_ECO_FORM_ENDPOINT=https://PROJECT_REF.supabase.co/functions/v1/eco-lead
NEXT_PUBLIC_META_PIXEL_ID=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

Cadastre as mesmas chaves em **Settings > Secrets and variables > Actions >
Variables**. Todas são públicas e incorporadas no build; não use tokens ou
credenciais nelas. `NEXT_PUBLIC_ECO_FORM_ENDPOINT` é obrigatória no workflow.

Não há fallback automático entre receptores, evitando cadastros duplicados. Para
rollback, restaure a URL anterior nessa variável e faça um novo deploy da landing.
O receptor confirma o cadastro com JSON `success: true`.

### Supabase: migration e Edge Function

Os arquivos estão em:

- `supabase/migrations/20260717000000_create_eco_leads.sql`
- `supabase/functions/eco-lead/index.ts`
- `supabase/functions/eco-lead/index_test.ts`

A migration cria `public.eco_leads`, o índice único case-insensitive de e-mail,
habilita RLS, revoga acesso de `anon` e `authenticated` e não cria policy pública.
A função usa apenas `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`, variáveis fornecidas
automaticamente pelo Supabase no runtime. A service role nunca deve ser configurada
como variável `NEXT_PUBLIC_*` nem commitada no repositório.

Com o Supabase CLI autenticado e o projeto vinculado:

```bash
supabase link --project-ref PROJECT_REF
supabase db push
supabase functions deploy eco-lead --no-verify-jwt
deno test supabase/functions/eco-lead/index_test.ts
```

O `supabase/config.toml` também registra `verify_jwt = false`, pois a função é pública.
O acesso ao banco continua protegido pela service role server-side e por RLS. CORS
aceita `https://liberula.com`, `https://www.liberula.com` e `http://localhost` em
qualquer porta. Alterações de domínio exigem atualizar a allowlist da função.

Após o deploy, a URL final é:

```text
https://PROJECT_REF.supabase.co/functions/v1/eco-lead
```

Teste a produção (use um e-mail descartável de QA e repita para validar deduplicação):

```bash
curl -i 'https://PROJECT_REF.supabase.co/functions/v1/eco-lead' \
  -X POST \
  -H 'Origin: https://liberula.com' \
  -H 'Content-Type: application/json' \
  --data '{"project":"eco","funnel":"free_recruitment","name":"Lead QA","email":"qa+eco@example.com","consent":true,"utm_source":"qa","utm_medium":"curl","utm_campaign":"eco-migration","utm_content":"","utm_term":"","fbclid":"qa-click-id","source_url":"https://liberula.com/eco","referrer":"","metadata":{"submitted_at":"2026-07-17T12:00:00.000Z","user_agent":"curl"},"website":""}'
```

Uma criação retorna `{"success":true,"duplicate":false}`; a repetição retorna
`{"success":true,"duplicate":true}`. Valide também o registro e os campos de
atribuição no painel do Supabase antes de trocar `NEXT_PUBLIC_ECO_FORM_ENDPOINT` no
GitHub Actions. Depois do deploy da landing, confirme no navegador que o evento Meta
`Lead` ocorre uma única vez e somente na criação confirmada.

### Janela de recrutamento

O bloqueio é controlado somente no backend pela variável `ECO_RECRUITMENT_CLOSED`.
Configure-a como secret da Edge Function com o valor `true` para rejeitar novas
candidaturas E.C.O. com HTTP 410, ou `false` para aceitá-las. Se a variável estiver
ausente ou tiver qualquer outro valor, o recrutamento permanece aberto. A restrição
é aplicada pela função `eco-lead`.

```bash
supabase secrets set ECO_RECRUITMENT_CLOSED=true
supabase functions deploy eco-lead --no-verify-jwt
```

A landing não contém data, contador ou bloqueio baseado no relógio do navegador.
Quando o backend responde que o recrutamento está fechado, o formulário é substituído
pelo aviso de fase encerrada.

Respostas que indiquem duplicidade (`duplicate: true`, código/mensagem `duplicate`
ou equivalente) são mostradas como sucesso, sem registrar um novo evento de lead.
O evento Meta `Lead` só dispara após a confirmação de uma nova candidatura pelo
serviço.

### Teste local

1. Copie as variáveis para `.env.local` e execute `npm run dev`.
2. Abra `http://localhost:3000/eco?utm_source=test&utm_campaign=recrutamento`.
3. Teste validação de nome, e-mail e consentimento, envio duplo, sucesso e erro.
4. Confirme no receptor o payload e, no PostHog, os eventos
   `eco_recruitment_landing_view`, `eco_recruitment_cta_click`,
   `eco_recruitment_form_started`, `eco_recruitment_form_error` e
   `eco_recruitment_email_submitted`.
5. Configure `ECO_RECRUITMENT_CLOSED=true` na Edge Function e confirme a resposta
   HTTP 410, o evento `eco_recruitment_closed_view` e a substituição do formulário.
6. Execute `npm run lint` e `npm run build` antes de publicar.
