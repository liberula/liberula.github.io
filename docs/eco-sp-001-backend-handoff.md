# ECO-SP-001 — operação do validador

O caso usa o Edge Function `eco-sp-001-api`. A resposta canônica e suas
equivalências são configurações exclusivas do servidor e nunca devem receber o
prefixo `NEXT_PUBLIC_`.

## Configuração

Mantenha a resposta canônica separada:

```text
ECO_SP_001_ANSWER=Posto de Serviços Telefônica
```

Configure `ECO_SP_001_ANSWER_ALIASES` como um array JSON de strings:

```json
[
  "Posto Telefônica",
  "Posto de Serviços Telefônica Benjamin Constant",
  "Posto de Serviços Telefônica da Rua Benjamin Constant",
  "Posto Telefônica Benjamin Constant",
  "Central Telefônica Benjamin Constant",
  "Central Telefônica da Rua Benjamin Constant",
  "Antiga Central Telefônica da Benjamin Constant",
  "Antiga Central Telefônica da Rua Benjamin Constant",
  "Rua Benjamin Constant 200",
  "R. Benjamin Constant 200",
  "Benjamin Constant 200",
  "Rua Benjamin Constant 200 Sé",
  "Rua Benjamin Constant 200 São Paulo",
  "Rua Benjamin Constant 200 Sé São Paulo"
]
```

Revise manualmente qualquer inclusão. Não adicione descrições amplas como
`central antiga`, nomes de bairro isolados ou endereços sem número. O validador
normaliza cada entrada e faz somente igualdade exata; ele não usa busca parcial
ou aproximação.

Secrets atualizados pela Supabase ficam disponíveis às novas invocações sem
redeploy. O deploy do Edge Function só é necessário quando o código muda.

## Configuração no projeto Supabase

No PowerShell, a partir da raiz do repositório:

```powershell
$aliases = @'
["Posto Telefônica","Posto de Serviços Telefônica Benjamin Constant","Posto de Serviços Telefônica da Rua Benjamin Constant","Posto Telefônica Benjamin Constant","Central Telefônica Benjamin Constant","Central Telefônica da Rua Benjamin Constant","Antiga Central Telefônica da Benjamin Constant","Antiga Central Telefônica da Rua Benjamin Constant","Rua Benjamin Constant 200","R. Benjamin Constant 200","Benjamin Constant 200","Rua Benjamin Constant 200 Sé","Rua Benjamin Constant 200 São Paulo","Rua Benjamin Constant 200 Sé São Paulo"]
'@

supabase secrets set --project-ref icjuacgxxpmwqlmjmeuq "ECO_SP_001_ANSWER_ALIASES=$aliases"
supabase functions deploy eco-sp-001-api --project-ref icjuacgxxpmwqlmjmeuq
```

Não imprima nem registre o valor dos secrets depois da configuração.

## Smoke test

Defina uma função auxiliar local, que envia somente o exemplo informado:

```powershell
$endpoint = 'https://icjuacgxxpmwqlmjmeuq.supabase.co/functions/v1/eco-sp-001-api/validate'
function Test-EcoAnswer([string]$answer) {
  $body = @{ answer = $answer } | ConvertTo-Json -Compress
  Invoke-RestMethod -Method Post -Uri $endpoint -ContentType 'application/json' -Headers @{ Origin = 'https://liberula.com' } -Body $body
}
```

Respostas que devem retornar `{ "correct": true }`:

```powershell
Test-EcoAnswer 'Posto Telefônica'
Test-EcoAnswer 'Central Telefônica Benjamin Constant'
Test-EcoAnswer 'R. Benjamin Constant, 200'
Test-EcoAnswer 'Rua Benjamin Constant 200 Sé São Paulo'
```

Respostas que devem retornar `{ "correct": false }`:

```powershell
Test-EcoAnswer 'Central telefônica'
Test-EcoAnswer 'Central antiga'
Test-EcoAnswer 'Benjamin Constant'
Test-EcoAnswer 'Rua Benjamin Constant'
Test-EcoAnswer 'Rua Benjamin Constant 195'
```

Inspecione todas as respostas. O contrato de validação contém somente o booleano
`correct`. O backend é a autoridade sobre a lista de aliases e o frontend inicia
o final pós-resposta apenas quando recebe `{ "correct": true }`.
Nenhuma resposta revela a lista de aliases, o valor normalizado, dicas ou
detalhes de similaridade.

## Validação local

```powershell
deno test --allow-all supabase/functions/eco-sp-001-api
npm test
npm run lint
npm run build
git diff --check
```

Depois da exportação, confirme também que nenhum valor configurado no servidor
foi incluído no diretório `out`.
