# Ingestão de participantes E.C.O.

## Limite de responsabilidade

Quaero continua responsável pela captura genérica de leads. Liberula recebe
eventos versionados e passa a ser responsável pelo participante E.C.O., suas
fontes de aquisição, casos, entregas e progressão futura.

O endpoint deste ticket somente registra ou vincula o participante. Ele:

- não envia e-mail;
- não chama a landing do dossiê;
- não cria `eco_case_deliveries`;
- não marca caso como aberto;
- não acessa o banco da Quaero.

Replays históricos futuros usarão o mesmo endpoint e o mesmo contrato
idempotente.

## Endpoint e autenticação

```text
POST /functions/v1/eco-participant-ingest
Content-Type: application/json
Authorization: Bearer <ECO_INGEST_SECRET>
```

O secret obrigatório é `ECO_INGEST_SECRET`. Ele existe somente no ambiente do
Edge Function e nunca deve usar prefixo `NEXT_PUBLIC_`.

## Contrato do evento

```json
{
  "event_id": "123e4567-e89b-42d3-a456-426614174000",
  "event_type": "eco.participant.registered",
  "event_version": 1,
  "occurred_at": "2026-07-31T12:00:00.000Z",
  "source": {
    "system": "quaero",
    "record_id": "lead-opaque-reference"
  },
  "participant": {
    "name": "Participante de teste",
    "email": "participant@example.test",
    "consent": true
  },
  "acquisition": {
    "project": "eco",
    "funnel": "free_recruitment",
    "utm_source": null,
    "utm_medium": null,
    "utm_campaign": null,
    "utm_content": null,
    "utm_term": null,
    "fbclid": null,
    "source_url": null,
    "referrer": null,
    "metadata": {}
  }
}
```

## Idempotência

O Edge Function chama somente o RPC transacional
`ingest_eco_participant_event`. O banco serializa concorrência por evento,
fonte e e-mail.

- `created`: participante e fonte foram criados;
- `linked`: o e-mail já existia e recebeu uma fonte nova;
- `duplicate`: o `event_id` ou a identidade da fonte já havia sido processado.

O primeiro `registered_at` cronológico é preservado. Um nome novo preenche um
nome em branco, mas nunca substitui automaticamente um nome existente.

## Teste local manual

Depois de iniciar a Supabase local e aplicar as migrations, crie um arquivo
local não versionado para as variáveis do Function:

```text
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<service-role local exibida por supabase status>
ECO_INGEST_SECRET=local-synthetic-ingest-secret-at-least-32-characters
```

Inicie somente a função:

```powershell
supabase functions serve eco-participant-ingest --env-file .\supabase\functions\.env.local
```

Em outro PowerShell, envie UTF-8 explicitamente:

```powershell
$endpoint = 'http://127.0.0.1:54321/functions/v1/eco-participant-ingest'
$secret = 'local-synthetic-ingest-secret-at-least-32-characters'
$event = @{
  event_id = '123e4567-e89b-42d3-a456-426614174000'
  event_type = 'eco.participant.registered'
  event_version = 1
  occurred_at = '2026-07-31T12:00:00.000Z'
  source = @{ system = 'quaero'; record_id = 'lead-local-001' }
  participant = @{
    name = 'Participante local'
    email = 'participant@example.test'
    consent = $true
  }
  acquisition = @{
    project = 'eco'
    funnel = 'free_recruitment'
    utm_source = $null
    utm_medium = $null
    utm_campaign = $null
    utm_content = $null
    utm_term = $null
    fbclid = $null
    source_url = $null
    referrer = $null
    metadata = @{}
  }
}
$json = $event | ConvertTo-Json -Depth 8 -Compress
$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
Invoke-RestMethod -Method Post -Uri $endpoint `
  -ContentType 'application/json; charset=utf-8' `
  -Headers @{ Authorization = "Bearer $secret" } `
  -Body $bytes
```

A primeira chamada retorna `created`. Repetir o mesmo evento retorna
`duplicate`. Confirme no banco local que não existe linha em
`eco_case_deliveries`.

## Aplicação humana no projeto Liberula

Estes passos são deliberadamente manuais. Primeiro revise a migration e faça o
dry run:

```powershell
supabase db push --dry-run --linked
supabase db push --linked
```

Gere um secret aleatório sem imprimi-lo e configure-o:

```powershell
$secretBytes = New-Object byte[] 48
$random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$random.GetBytes($secretBytes)
$ingestSecret = [Convert]::ToBase64String($secretBytes)
$random.Dispose()

supabase secrets set --project-ref icjuacgxxpmwqlmjmeuq "ECO_INGEST_SECRET=$ingestSecret"
```

Secrets da Supabase ficam disponíveis sem redeploy. O deploy abaixo é necessário
uma vez para publicar o novo código da função:

```powershell
supabase functions deploy eco-participant-ingest --project-ref icjuacgxxpmwqlmjmeuq
```

Entregue o mesmo valor de `ECO_INGEST_SECRET` ao operador autorizado da Quaero
por um canal seguro. Não coloque o valor em código, documentação, logs ou
variáveis públicas. Ao terminar a sessão local:

```powershell
$ingestSecret = $null
$secretBytes = $null
```

## Validação antes da aplicação remota

```powershell
npx --yes deno test --allow-all supabase/functions/eco-participant-ingest
npm test
npm run build
git diff --check
```
