# Abertura da landing de entrega E.C.O.

## Significado operacional

`public.eco_case_deliveries.opened_at` é o instante da primeira vez em que uma landing individual válida foi montada e ficou visível em um navegador. A entrega precisa estar no estado `sent`. O valor é `timestamptz null` e, depois de preenchido, não é substituído em visitas posteriores.

Esse campo significa **abertura da landing individual**. Ele não significa abertura do e-mail, leitura integral do PDF, conclusão do caso, envio de resposta ou compra. A aceitação da mensagem pelo Postmark confirma entrega ao provedor, não engajamento do participante. Não existe pixel de abertura do Postmark neste fluxo.

PostHog e o backend continuam independentes:

- PostHog recebe `eco_case_delivery_landing_viewed` e `eco_case_dossier_opened` para análise de funil;
- o banco Liberula usa `opened_at` como estado operacional da entrega.

Falha em um sistema não bloqueia nem condiciona o outro. O tracking de abertura também não bloqueia a landing, o dossiê ou o canal de resposta.

## Endpoint público

```text
POST https://<PROJECT_REF>.supabase.co/functions/v1/eco-case-delivery-open
Content-Type: application/json
```

Corpo exato:

```json
{
  "delivery_reference": "<OPAQUE_REFERENCE>"
}
```

A referência é Base64URL opaca sem padding: apenas letras ASCII, números, `_` e `-`, entre 16 e 200 caracteres. O endpoint não aceita ID de entrega, participante, e-mail, caso, arrays, chaves extras, query string para mutação ou `GET`. O corpo é limitado a 1 KiB.

Referências com formato válido recebem sempre `202 Accepted` com:

```json
{
  "success": true
}
```

A resposta é idêntica quando a referência não existe, pertence a uma entrega não enviada, já foi aberta, acabou de ser aberta ou quando ocorre falha interna de persistência. Ela nunca informa estado, `opened_at`, ID ou dados do participante. Requisições malformadas recebem somente o erro genérico `invalid_request`.

O gateway está configurado com `verify_jwt = false`. O navegador não envia bearer token, chave `service_role` nem `ECO_DELIVERY_ADMIN_SECRET`. A Edge Function usa as credenciais server-side fornecidas pelo runtime para chamar a RPC restrita `record_eco_case_delivery_open`.

O CORS permite `https://liberula.com` e origens `http://localhost`/`http://127.0.0.1` com porta opcional, sem credenciais. `OPTIONS` existe somente para preflight; apenas `POST` executa persistência.

## Persistência e elegibilidade

A RPC executa atomicamente o equivalente a:

```sql
update public.eco_case_deliveries
set opened_at = coalesce(opened_at, now())
where delivery_reference = '<OPAQUE_REFERENCE>'
  and status = 'sent'
returning opened_at;
```

Assim, `pending`, `sending`, `failed` e `cancelled` nunca recebem abertura. A segunda visita preserva exatamente o timestamp da primeira. A operação não muda `status`, `attempt_count`, `provider_message_id`, `sent_at` ou qualquer dado de envio e nunca chama Postmark.

A coluna e o índice único de `delivery_reference` já existem na migração base; o T007 adiciona apenas a RPC e não recria, renomeia nem preenche retroativamente `opened_at`.

## Integração da landing

O build recebe apenas a origem pública:

```text
NEXT_PUBLIC_LIBERULA_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
```

O cliente deriva `/functions/v1/eco-case-delivery-open`, valida `?delivery=` com o mesmo helper usado pelo backend, exige que a landing esteja em `liberula.com`, espera `document.visibilityState === "visible"` e inicia no máximo um `fetch` por instância montada. A trava é marcada antes da chamada, inclusive sob React Strict Mode. Não há loop de retry. Falhas são silenciosas para o participante e, em desenvolvimento, geram apenas uma mensagem fixa sem referência ou PII. Uma landing aberta diretamente em `localhost` nunca inicia tracking, mesmo que receba por engano uma referência real.

## Prévia local e painel

Uma URL de entrega real contém:

```text
https://liberula.com/eco/eco-sp-001/iniciar/?delivery=<OPAQUE_REFERENCE>
```

A prévia local usa a mesma landing **sem** `delivery`. Essa é a distinção visual e técnica: prévia não tem referência; acesso real tem uma referência opaca. Abrir ou renderizar a prévia não chama o endpoint e não altera o banco.

Na tabela local, **ABERTURA** é apresentada assim:

| Condição | Rótulo |
| --- | --- |
| entrega não enviada | — |
| `sent` e `opened_at is null` | NÃO ABRIU |
| `sent` e `opened_at` preenchido | ABRIU EM 01/08/2026 17:10 |

Referências e IDs de entrega não aparecem na tabela. **ABRIR ACESSO** é a única ação do painel que redireciona para um link real enviado. Atenção: abrir esse link real, inclusive para uma entrega de teste, muda legitimamente seu estado operacional para **ABRIU**.

## Testes locais

Sem chamar Supabase, Postmark ou PostHog reais:

```powershell
npm test
npm run lint
npm run build
```

Com Deno instalado, execute também:

```powershell
deno test supabase/functions/eco-case-delivery-open/index_test.ts
```

Os testes da Edge Function usam dependências sintéticas. Os testes Node verificam a RPC, a integração da landing, a prévia e o painel.

## Deploy pelo operador

Depois de revisar o diff e autenticar/vincular manualmente o Supabase CLI:

```powershell
supabase db push
supabase functions deploy eco-case-delivery-open --no-verify-jwt
```

No projeto do **Cloudflare Pages**, abra **Settings > Variables and Secrets** e configure a variável de build de produção, sem barra final e sem chave:

```text
NEXT_PUBLIC_LIBERULA_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
```

Depois salve a configuração e gere um novo deployment para que o valor seja incorporado ao bundle estático. A configuração deste projeto usa:

```text
Build command: npm run build
Build output directory: out
```

Para validar o mesmo build localmente em PowerShell:

```powershell
npm ci
$env:NEXT_PUBLIC_LIBERULA_SUPABASE_URL="https://<PROJECT_REF>.supabase.co"
npm run build
```

Se o Cloudflare Pages estiver conectado ao repositório, publique a revisão pela branch de produção configurada e acompanhe o deployment em **Workers & Pages > projeto > Deployments**. Para um deploy manual equivalente com Wrangler autenticado:

```powershell
npx wrangler pages deploy out --project-name <CLOUDFLARE_PAGES_PROJECT> --branch main
```

Cloudflare Pages é a origem autoritativa deste projeto. O workflow legado de GitHub Pages presente no repositório não é o procedimento de publicação do T007. Nenhum desses comandos ou deploys faz parte da execução automatizada deste ticket.

## Controlled smoke test / smoke test controlado

1. Abra o painel local e envie uma única mensagem para um endereço controlado.
2. Atualize o painel e confirme **ENVIADO** e **NÃO ABRIU**.
3. Abra o link individual recebido no e-mail, não a URL de prévia.
4. Atualize o painel e confirme **ENVIADO** e **ABRIU EM ...**.
5. No SQL Editor, consulte apenas a entrega controlada e anote `opened_at`:

   ```sql
   select status, opened_at, sent_at, attempt_count, provider_message_id
   from public.eco_case_deliveries
   where delivery_reference = '<REFERÊNCIA_CONTROLADA>';
   ```

6. Reabra o mesmo link e repita a consulta. Confirme que `opened_at` não mudou.
7. Confirme que `status` continua `sent`, `sent_at`, `attempt_count` e `provider_message_id` não mudaram e nenhum segundo e-mail apareceu no Postmark.
8. Confirme no PostHog que os eventos existentes `eco_case_delivery_landing_viewed` e `eco_case_dossier_opened` continuam chegando, sem exigir sucesso do tracking operacional.
