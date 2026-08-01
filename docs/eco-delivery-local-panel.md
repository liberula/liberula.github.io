# Painel local de envio E.C.O.

O painel em `/internal/eco/deliveries/` oferece um fluxo único ao operador:

```text
selecionar participantes → pré-visualizar e-mail → enviar e-mail
```

A criação ou reutilização do registro de entrega acontece internamente no momento do envio. O operador não precisa preparar registros, copiar UUIDs ou interpretar estados do banco.

## Por que é local

O site público é exportado como arquivos estáticos. O painel e seus proxies só funcionam em `next dev`, em `localhost` ou `127.0.0.1`. Secrets são lidos apenas pelos Route Handlers locais e nunca usam prefixo `NEXT_PUBLIC_`.

O painel não é um portal administrativo remoto. Ele não persiste participantes no navegador, não emite analytics e não faz polling.

## Configuração

Crie ou atualize `.env.local` sem versioná-lo:

```text
ECO_ADMIN_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
ECO_ADMIN_SUPABASE_SECRET_KEY=sb_secret_<SECRET_KEY>
ECO_DELIVERY_FUNCTION_URL=https://<PROJECT_REF>.supabase.co/functions/v1/eco-case-delivery
ECO_DELIVERY_ADMIN_SECRET=<ADMIN_SECRET>
```

`ECO_ADMIN_SUPABASE_SECRET_KEY` é a Secret API Key individual `sb_secret_...`. `ECO_DELIVERY_FUNCTION_URL` pode ser omitida quando usa o caminho padrão do mesmo projeto.

## Iniciar

```powershell
npm run dev
```

Abra `http://localhost:3000/internal/eco/deliveries/`. Não use IP de rede, preview ou domínio público.

## Estados exibidos

O estado interno continua armazenado como `pending`, `sending`, `sent`, `failed` ou `cancelled`, mas o painel mostra somente:

| Estado interno | Estado do operador |
| --- | --- |
| sem registro ou `pending` | NÃO ENVIADO |
| `sending` | ENVIANDO |
| `sent` | ENVIADO |
| `failed` | FALHOU |
| participante bloqueado/concluído ou `cancelled` | BLOQUEADO |

IDs, referências e contagem de tentativas não aparecem na tabela principal.

## Pré-visualizar sem enviar

1. Para usar uma pessoa real, selecione exatamente uma linha. Para usar o exemplo claramente marcado, não selecione ninguém.
2. Clique em **PRÉ-VISUALIZAR E-MAIL**.
3. Confira **DESKTOP**, **MOBILE** e **TEXTO**.
4. Use **ABRIR EM NOVA ABA** para inspecionar o HTML isoladamente.

Desktop e mobile usam exatamente o mesmo HTML em larguras diferentes. O proxy chama o mesmo renderer usado pelo Postmark e usa a landing sem o parâmetro `delivery`; portanto, a prévia não pode apontar para uma entrega real nem registrar abertura. Ele executa apenas uma consulta `GET` opcional do nome, não cria registro, não atualiza banco, não chama a Edge Function, não chama Postmark e não emite analytics.

## Enviar um e-mail controlado

1. Em **TESTE CONTROLADO**, filtre um endereço já registrado e controlado pelo operador.
2. Selecione a pessoa e revise a prévia.
3. Clique em **ENVIAR E-MAIL**.
4. Confirme a quantidade e a lista explícita de destinatários no diálogo que avisa sobre e-mails reais pelo Postmark.
5. Confira o resultado individual e atualize a tabela; o estado esperado é **ENVIADO**.
6. Confirme a mensagem em **Postmark > Activity** e na caixa de entrada controlada.

Depois do envio, a coluna **ABERTURA** mostra **NÃO ABRIU** até a primeira abertura real da landing e **ABRIU EM ...** depois dela. Estados ainda não enviados mostram **—**. A ação **ABRIR ACESSO** abre o link individual real: ela pode registrar a primeira abertura e deve ser usada somente de forma deliberada em um teste controlado.

Não há seleção automática nem “Selecionar todos”. O limite é 10. Pessoas já enviadas ou bloqueadas não podem ser selecionadas. Uma falha elegível mostra **TENTAR NOVAMENTE** e exige nova confirmação; não existe reenvio de mensagens já enviadas neste trabalho.

## Contrato local simplificado

O navegador envia somente IDs de participante:

```json
{
  "action": "send_participants",
  "case_id": "eco-sp-001",
  "participant_ids": ["00000000-0000-4000-8000-000000000000"]
}
```

O proxy valida cada pessoa, chama internamente a preparação compatível para criar ou reutilizar o registro e então chama o envio compatível pelo ID interno. O resultado por pessoa é limitado a `sent`, `failed`, `already_sent`, `blocked`, `not_found` ou `retry_limit_reached`; a interface traduz esses valores.

As ações antigas `prepare` e `send` permanecem aceitas pelo proxy para compatibilidade, mas não aparecem no fluxo normal.

## Segurança e estado interno

A máquina de estados, referência opaca, `sent_at`, `opened_at`, `attempt_count`, Message ID do Postmark, claim atômico, limite de três tentativas e proteção de concorrência continuam inalterados. Respostas brutas do Postmark/Supabase, secrets e identificadores internos não são mostrados.

Em caso de `postmark_result_unknown`, consulte o Postmark Activity antes de tentar novamente: o provedor pode ter aceitado a mensagem mesmo quando a resposta se perdeu.

## Validação

```powershell
npm test
npm run lint
npm run build
git diff --check
```

Os testes automatizados não fazem envio real. Depois do build, confirme que `out` não contém um backend administrativo funcional nem valores de secrets.

Para encerrar, pressione `Ctrl+C` no terminal do `next dev`.
