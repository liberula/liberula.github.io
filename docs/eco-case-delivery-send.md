# Envio manual de entregas E.C.O.

Esta operação é a quarta etapa de um fluxo deliberadamente separado:

1. `eco-participant-ingest` registra o participante, mas não cria nem envia uma entrega.
2. `eco-case-delivery` com `action: "prepare"` cria a entrega individual em `pending`, mas não envia e-mail.
3. `eco-case-delivery` com `action: "send"` tenta enviar somente os IDs indicados pelo operador.
4. Abrir `/eco/eco-sp-001/iniciar/?delivery=...` registra os eventos públicos existentes, mas não envia outro e-mail.

Não há seleção automática, cron, fila, reenvio automático ou vínculo entre abrir a landing e enviar e-mail.

## Configuração necessária

A Edge Function usa exclusivamente secrets de servidor:

```text
ECO_DELIVERY_ADMIN_SECRET
ECO_PUBLIC_BASE_URL
POSTMARK_SERVER_TOKEN
POSTMARK_FROM_EMAIL
POSTMARK_REPLY_TO
POSTMARK_MESSAGE_STREAM
```

Para o primeiro fluxo, `ECO_PUBLIC_BASE_URL` deve ser `https://liberula.com` e o Message Stream esperado é `outbound`. Não coloque nenhum desses valores em variável `NEXT_PUBLIC_`.

## Identidade do e-mail

O assunto operacional é:

```text
E.C.O. | Acesso autorizado ao Caso ECO-SP-001
```

Neste e-mail, o participante é apresentado como **ASPIRANTE**. Essa palavra é somente uma decisão de apresentação para quem recebeu o primeiro caso gratuito; ela não cria cargo, progressão ou campo de rank no banco.

Quando há nome, o e-mail remove espaços excedentes, converte o valor para maiúsculas com regras de português, limita a apresentação e escapa caracteres HTML. Sem nome válido, exibe `ASPIRANTE: IDENTIDADE NÃO REGISTRADA`. O valor armazenado do participante não é alterado.

O emblema é construído a partir de `ECO_PUBLIC_BASE_URL`:

```text
<ECO_PUBLIC_BASE_URL>/eco/eco-emblem.webp
```

Em produção, o resultado esperado é `https://liberula.com/eco/eco-emblem.webp`. O HTML usa URL HTTPS absoluta, dimensões explícitas de 64 × 64 px e texto alternativo. A identificação `E.C.O.` e `ENCONTRAR. CONTER. OCULTAR.` também aparece como texto, portanto bloquear imagens não remove a identidade ou as instruções.

O HTML usa estrutura externa em tabelas, estilos críticos inline, largura máxima de 600 px, fontes de sistema e nenhum JavaScript, stylesheet externo, web font, imagem base64, SVG, animação ou background image. Se os estilos do botão forem removidos, o link continua sendo um `<a>` normal. O corpo em texto simples contém a mesma classificação, identificação do Aspirante, instruções e URL individual.

Essas alterações visuais não modificam preparação, elegibilidade, claim atômico, `attempt_count`, limite de retry ou transições de estado.

## Contrato de envio

O endpoint aceita apenas `POST`, JSON e o segredo administrativo no bearer token:

```json
{
  "action": "send",
  "delivery_ids": [
    "00000000-0000-4000-8000-000000000000"
  ]
}
```

Devem ser informados de 1 a 10 UUIDs únicos. Não é possível selecionar por e-mail, caso, ordem cronológica ou estado.

Uma entrega `pending` pode ser enviada. Uma entrega `failed` pode ser tentada novamente apenas quando `attempt_count < 3`. Estados `sending`, `sent` e `cancelled` não são enviados. O participante não pode estar `blocked` ou `completed`; o caso deve estar ativo; e e-mail, referência e `entry_path` precisam ser válidos.

## Estados e concorrência

Antes de chamar o Postmark, o banco reivindica atomicamente a entrega:

```text
pending | failed
→ sending (attempt_count + 1, last_error_code limpo)
→ sent | failed
```

O predicado de estado e o bloqueio da linha impedem duas requisições concorrentes de enviarem a mesma entrega. Em sucesso, `sent_at`, `email_provider = postmark` e `provider_message_id` são persistidos. Em falha, somente um código genérico limitado é armazenado; respostas completas do provedor nunca são gravadas.

Uma falha de rede depois do início da requisição é ambígua: a entrega recebe `postmark_result_unknown` e não é repetida automaticamente. Antes de tentar novamente, procure a mensagem em **Postmark > Activity** usando destinatário e horário. Se ela tiver sido aceita, não reenvie; uma conciliação administrativa desse caso fica fora desta operação.

Aceitação pelo Postmark significa apenas que o e-mail foi aceito pelo provedor. Não significa abertura do e-mail, da landing, do PDF ou conclusão do caso. `opened_at` não é alterado.

## Validação local

Os testes usam Postmark e banco simulados e não fazem chamadas externas:

```powershell
npx --yes deno test --allow-all supabase/functions/eco-case-delivery
npm test
npm run lint
npm run build
git diff --check
```

## Aplicação e deploy pelo operador

Estes passos são manuais e devem ser executados no projeto Liberula correto:

```powershell
supabase db push --dry-run --linked
supabase db push --linked
supabase secrets list --project-ref icjuacgxxpmwqlmjmeuq
supabase functions deploy eco-case-delivery --project-ref icjuacgxxpmwqlmjmeuq
```

Confirme apenas que os seis nomes de secrets listados acima existem; não imprima seus valores.

## Smoke controlado

Use somente um participante de teste cujo endereço de e-mail seja controlado pelo operador. Não use um lead real no primeiro envio.

1. Localize o UUID de um participante elegível (`registered`, `active` ou `paused`).
2. Prepare uma entrega com `action: "prepare"` ou reutilize uma entrega `pending` já preparada.
3. Copie o `delivery_id` retornado. Não use `participant_id` no pedido de envio.
4. Envie exatamente essa entrega:

```powershell
$projectRef = "icjuacgxxpmwqlmjmeuq"
$adminSecret = Read-Host "ECO_DELIVERY_ADMIN_SECRET"
$deliveryId = "<DELIVERY_UUID>"
$endpoint = "https://$projectRef.supabase.co/functions/v1/eco-case-delivery"
$body = @{
  action = "send"
  delivery_ids = @($deliveryId)
} | ConvertTo-Json -Compress

Invoke-RestMethod `
  -Method Post `
  -Uri $endpoint `
  -Headers @{ Authorization = "Bearer $adminSecret" } `
  -ContentType "application/json" `
  -Body ([Text.Encoding]::UTF8.GetBytes($body))
```

5. Confirme que a resposta contém `result: sent` e `status: sent`.
6. Em Postmark Activity, confirme uma única mensagem, destinatário correto, botão apontando para a landing individual e ausência de anexo.
7. Inspecione somente os campos operacionais no SQL Editor:

```sql
select
  id,
  status,
  sent_at,
  email_provider,
  provider_message_id,
  attempt_count,
  last_error_code,
  opened_at
from public.eco_case_deliveries
where id = '<DELIVERY_UUID>'::uuid;
```

O resultado esperado é `status = sent`, `sent_at` preenchido, `email_provider = postmark`, `provider_message_id` preenchido, `attempt_count = 1`, `last_error_code = null` e `opened_at` inalterado.

8. Abra o link recebido. Confirme em PostHog `eco_case_delivery_landing_viewed` e, ao abrir o dossiê, `eco_case_dossier_opened`.
9. Confirme no Postmark Activity que abrir a landing ou o dossiê não gerou outro e-mail.

Repetir `action: "send"` para a mesma entrega já enviada deve retornar `already_sent` sem chamar o Postmark novamente.

## Revisão visual manual

Antes do primeiro lote real, envie uma nova delivery somente para um endereço de teste controlado e confirme:

- no Postmark Activity: assunto correto, corpos HTML e texto simples, nenhum anexo e uma única aceitação;
- no Gmail desktop: emblema 64 × 64, hierarquia institucional, botão e URL completa legíveis;
- no Gmail mobile: largura responsiva, texto sem cortes e URL longa quebrando linha sem rolagem horizontal;
- no Gmail mobile e desktop com imagens bloqueadas: identificação textual E.C.O., caso, instruções, botão/link e aviso individual continuam compreensíveis;
- em Outlook ou outro cliente secundário disponível: tabela, bordas, espaçamento e ação principal permanecem funcionais;
- em modo escuro: contraste continua legível mesmo que o cliente altere parcialmente as cores;
- a linha do destinatário mostra `ASPIRANTE: <NOME>` ou `ASPIRANTE: IDENTIDADE NÃO REGISTRADA`;
- o botão e a URL visível abrem a landing individual existente, nunca o PDF diretamente;
- abrir a landing ou o dossiê não envia outro e-mail nem altera novamente a delivery já `sent`.
