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

## Landing E.C.O.

A landing está disponível em `/eco` e continua compatível com o export estático
usado pelo GitHub Pages.

### Configurar o Formspree

1. Crie uma conta em [Formspree](https://formspree.io/) e selecione **New Form**.
2. Informe um nome para o formulário e o e-mail que receberá os cadastros.
3. No painel do formulário, copie o endpoint no formato
   `https://formspree.io/f/SEU_FORM_ID`.
4. Se o Formspree solicitar confirmação do e-mail de destino, confirme antes de
   testar a landing.

A landing envia um `POST` JSON diretamente para esse endpoint, com os headers
`Content-Type: application/json` e `Accept: application/json`. O payload contém
`name`, `email`, `priceReference`, `product`, `submittedAt`, `sourceUrl`, as cinco
UTMs e `fbclid`. O evento `Lead` da Meta só é disparado depois de uma resposta
HTTP `2xx` do Formspree.

### Configurar as Repository Variables no GitHub Pages

1. No repositório do GitHub, abra **Settings > Secrets and variables > Actions**.
2. Abra a aba **Variables** e crie estas Repository Variables:

   - `NEXT_PUBLIC_ECO_LEAD_ENDPOINT`
   - `NEXT_PUBLIC_META_PIXEL_ID`
   - `NEXT_PUBLIC_POSTHOG_KEY`
   - `NEXT_PUBLIC_POSTHOG_HOST`

3. Use o endpoint completo do Formspree como valor de
   `NEXT_PUBLIC_ECO_LEAD_ENDPOINT`.
4. No PostHog, confira **Project settings** e use o host da região real do projeto:
   `https://us.i.posthog.com` para US ou `https://eu.i.posthog.com` para EU.
5. Execute novamente o workflow **Deploy Next.js site to Pages**.

Variáveis `NEXT_PUBLIC_*` são incorporadas ao JavaScript durante o build. Alterar
uma variável no GitHub exige obrigatoriamente um novo build e deploy. Esses
valores são públicos no navegador e não devem conter credenciais privadas. O
workflow interrompe o deploy com uma mensagem clara quando o endpoint de leads
está ausente; PostHog e Meta Pixel permanecem opcionais.

### Testar uma submissão

Para testar localmente, adicione ao `.env.local`:

```env
NEXT_PUBLIC_ECO_LEAD_ENDPOINT=https://formspree.io/f/SEU_FORM_ID
```

Reinicie `npm run dev`, abra `http://localhost:3000/eco`, informe um nome e um
e-mail de teste e envie o formulário. Confirme os três sinais:

1. a landing mostra **Cadastro recebido**;
2. a submissão aparece na aba **Submissions** do formulário no Formspree;
3. no painel de rede do navegador, a requisição retorna um status `2xx`.

Também teste com um endpoint inválido: a landing deve mostrar a mensagem de erro
e não deve disparar o evento `Lead` da Meta.

Para validar a versão publicada pelo DevTools:

1. abra **Network > Fetch/XHR**;
2. envie o formulário;
3. confirme uma requisição para `formspree.io` com status `2xx`;
4. confirme o cadastro na aba **Submissions** do Formspree.

Para habilitar o Meta Pixel, defina `NEXT_PUBLIC_META_PIXEL_ID` com o ID real no
ambiente do build. A página envia `PageView`, `ViewContent` e, somente depois de
uma resposta bem-sucedida do endpoint de leads, `Lead`. Sem a variável, o pixel
fica desativado e o build continua funcionando.

### Testar o PostHog

1. Abra o projeto correto no PostHog e confirme se a região é US ou EU.
2. Abra **Live Events**.
3. Carregue `/eco` e confirme `eco_page_view`.
4. Role a página e confirme `eco_view_content`.
5. Envie um lead real e confirme `eco_lead` somente após o sucesso do Formspree.

A inicialização global usa captura manual de `$pageview`, evitando duplicidade no
App Router. Sem key ou host, o SDK não é inicializado e a página continua
funcionando. Extensões de bloqueio podem impedir requisições do PostHog; isso não
afeta o formulário e não é contornado por proxy neste projeto.
