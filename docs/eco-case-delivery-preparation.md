# Preparação de entregas individuais E.C.O.

## Limites da operação

O fluxo possui quatro etapas independentes:

1. **Registro do participante:** `eco-participant-ingest` registra ou vincula a
   pessoa recebida da Quaero.
2. **Preparação da entrega:** `eco-case-delivery` cria ou recupera uma linha
   individual em `eco_case_deliveries` e devolve sua URL.
3. **Envio por e-mail:** não está implementado neste ticket e nunca é disparado
   pela preparação.
4. **Abertura da landing:** o participante acessa a rota pública já existente
   `/eco/eco-sp-001/iniciar/`. Os eventos PostHog dessa página registram a
   visualização e o clique no dossiê; eles não criam entrega e não enviam
   e-mail.

A preparação não chama Postmark, SMTP, Telegram, outro Edge Function ou qualquer
provedor externo. Toda entrega nova permanece com status `pending`.

## Configuração de servidor

O Edge Function exige duas variáveis exclusivamente server-side:

- `ECO_DELIVERY_ADMIN_SECRET`: autentica o operador;
- `ECO_PUBLIC_BASE_URL`: origem pública usada nas URLs, em produção
  `https://liberula.com`.

Nenhuma delas pode usar prefixo `NEXT_PUBLIC_`. A URL retornada contém uma
referência opaca que funciona como bearer link sensível: não publique, não
inclua em logs e compartilhe somente com o participante correspondente.

## Contrato

```text
POST /functions/v1/eco-case-delivery
Content-Type: application/json
Authorization: Bearer <ECO_DELIVERY_ADMIN_SECRET>
```

```json
{
  "action": "prepare",
  "case_id": "eco-sp-001",
  "participant_ids": [
    "123e4567-e89b-42d3-a456-426614174000"
  ]
}
```

Cada chamada aceita entre 1 e 10 UUIDs distintos. Não há seleção por e-mail,
filtro, lote automático ou seleção implícita. O operador deve fornecer todos os
IDs explicitamente.

Uma entrega nova retorna `result: created`; uma repetição retorna
`result: existing`, com o mesmo ID, referência e status. Entregas `sent`,
`failed` ou `cancelled` nunca voltam para `pending` durante a preparação.

## Teste local manual

Depois de iniciar a Supabase local e aplicar as migrations, forneça as variáveis
em um arquivo local não versionado:

```text
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<service-role local exibida por supabase status>
ECO_DELIVERY_ADMIN_SECRET=local-synthetic-delivery-secret-at-least-32-characters
ECO_PUBLIC_BASE_URL=http://localhost:3000
```

Inicie somente a função:

```powershell
supabase functions serve eco-case-delivery `
  --env-file .\supabase\functions\.env.local
```

Localize IDs elegíveis no banco local ou no SQL Editor autorizado. A consulta
não precisa retornar nome ou e-mail:

```sql
select id, status
from public.eco_participants
where status in ('registered', 'active', 'paused')
order by registered_at
limit 10;
```

Prepare uma entrega explícita em outro PowerShell:

```powershell
$endpoint = 'http://127.0.0.1:54321/functions/v1/eco-case-delivery'
$adminSecret = 'local-synthetic-delivery-secret-at-least-32-characters'
$participantId = '123e4567-e89b-42d3-a456-426614174000'
$payload = @{
  action = 'prepare'
  case_id = 'eco-sp-001'
  participant_ids = @($participantId)
}
$json = $payload | ConvertTo-Json -Depth 4 -Compress
$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
$response = Invoke-RestMethod -Method Post -Uri $endpoint `
  -ContentType 'application/json; charset=utf-8' `
  -Headers @{ Authorization = "Bearer $adminSecret" } `
  -Body $bytes
$response | ConvertTo-Json -Depth 6
```

Confirme a linha sem consultar dados pessoais:

```sql
select
  id,
  participant_id,
  case_id,
  status,
  attempt_count,
  sent_at,
  opened_at,
  email_provider,
  provider_message_id,
  last_error_code
from public.eco_case_deliveries
where participant_id = '123e4567-e89b-42d3-a456-426614174000'
  and case_id = 'eco-sp-001';
```

Para uma entrega nova, valide `status = pending`, `attempt_count = 0` e todos os
campos de envio como `null`. Execute novamente o mesmo POST e confirme
`result: existing`, a mesma URL e apenas uma linha no banco.

## Aplicação humana no projeto Liberula

Os comandos abaixo são deliberadamente manuais e não foram executados durante
este ticket.

Revise e aplique a migration:

```powershell
supabase db push --dry-run --linked
supabase db push --linked
```

Gere um secret forte sem imprimi-lo e configure as duas variáveis:

```powershell
$secretBytes = New-Object byte[] 48
$random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$random.GetBytes($secretBytes)
$deliveryAdminSecret = [Convert]::ToBase64String($secretBytes)
$random.Dispose()

supabase secrets set --project-ref icjuacgxxpmwqlmjmeuq `
  "ECO_DELIVERY_ADMIN_SECRET=$deliveryAdminSecret" `
  "ECO_PUBLIC_BASE_URL=https://liberula.com"
```

Publique somente a nova função:

```powershell
supabase functions deploy eco-case-delivery `
  --project-ref icjuacgxxpmwqlmjmeuq
```

Escolha um UUID elegível com a consulta anterior, defina o endpoint remoto e
repita o mesmo contrato manual:

```powershell
$endpoint = 'https://icjuacgxxpmwqlmjmeuq.supabase.co/functions/v1/eco-case-delivery'
$participantId = '<UUID-ELEGIVEL>'
```

Use `$deliveryAdminSecret` apenas no header bearer. Depois:

1. confirme `success: true`, `result: created` e a URL sob
   `https://liberula.com/eco/eco-sp-001/iniciar/`;
2. abra a URL retornada e confirme que a landing existente carrega;
3. valide no PostHog `eco_case_delivery_landing_viewed` e, ao abrir o PDF,
   `eco_case_dossier_opened`;
4. consulte a linha e confirme que permanece `pending`, com campos de envio
   vazios;
5. repita a preparação e confirme `result: existing`, mesma URL e nenhuma linha
   adicional;
6. confirme nos logs que nenhuma chamada de e-mail ou provedor foi realizada.

Ao terminar a sessão:

```powershell
$deliveryAdminSecret = $null
$secretBytes = $null
```

## Validação local

```powershell
npx --yes deno test --allow-all supabase/functions/eco-case-delivery
npm test
npm run lint
npm run build
git diff --check
```
