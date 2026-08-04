# ECO-SP-001 — operação de pagamentos em produção

## Auditoria remota de 04/08/2026

O projeto vinculado é `icjuacgxxpmwqlmjmeuq`. Na auditoria somente leitura:

- `eco-sp-001-api` e `eco-sp-001-mercado-pago-webhook` estavam ativos, mas a
  presença no projeto não comprovava que o código local mais recente estava
  implantado;
- as migrations `20260803000000` e `20260804000000` ainda não constavam no
  histórico remoto;
- existiam aproximadamente 11 linhas em `eco_orders` e 1 em
  `eco_payment_events`; estatísticas agregadas não permitem classificá-las com
  segurança como teste ou produção;
- token, assinatura, collector, origens e salt possuíam secrets configurados;
- `MERCADO_PAGO_ENVIRONMENT` e `ECO_PAYMENTS_ENABLED` ainda não estavam
  configurados;
- o endpoint agregado respondeu com campanha ativa, 1 participante confirmado
  e meta 100.

Nenhuma migration, função, secret ou linha remota foi alterada durante a
auditoria.

## Estado e arquitetura

O navegador envia somente os dados validados do comprador, um código de
indicação opcional e um `Idempotency-Key` UUID para `eco-sp-001-api/orders`.
A Edge Function fixa o produto (`eco-sp-001`), título, quantidade `1`, moeda
`BRL` e preço `2990` centavos. O banco cria ou recupera o pedido e coordena uma
única preferência. A API do Mercado Pago recebe `unit_price: 29.90`, a
referência externa opaca, as URLs de retorno e a URL do webhook.

O retorno do checkout nunca confirma pagamento. A página consulta o status
salvo no backend usando apenas a referência pública opaca. O webhook valida a
assinatura HMAC, consulta `GET /v1/payments/{id}` e só então compara ambiente,
collector, preferência quando disponível, referência externa, valor e moeda.
A RPC do banco aplica a máquina de estados de forma transacional e idempotente.

## Ambientes e variáveis server-side

O ambiente é selecionado exclusivamente pela flag server-side:

- local usa `MERCADO_PAGO_ENVIRONMENT=development`, aceita origem `localhost`
  e retorna somente `sandbox_init_point`;
- preview ou staging usa `MERCADO_PAGO_ENVIRONMENT=test` e retorna somente
  `sandbox_init_point`;
- produção usa `MERCADO_PAGO_ENVIRONMENT=production`, exige uma origem oficial
  e retorna somente `init_point` de produção.

Não existe fallback e o prefixo do token não seleciona ambiente.

- `ECO_PAYMENTS_ENABLED`: somente `true` libera novos pedidos. Começar com
  `false` e ativar por último.
- `MERCADO_PAGO_ENVIRONMENT`: `development`, `test` ou `production`.
- `MERCADO_PAGO_ACCESS_TOKEN`: token da aplicação no mesmo ambiente.
- `MERCADO_PAGO_WEBHOOK_SECRET`: assinatura da URL/evento configurados no mesmo
  ambiente.
- `MERCADO_PAGO_COLLECTOR_ID`: ID numérico da conta vendedora esperada.
- `ECO_ALLOWED_ORIGINS`: origens adicionais exatas, separadas por vírgula.
- `ECO_STATUS_RATE_LIMIT_SALT`: segredo aleatório com pelo menos 32 caracteres.
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`: fornecidos no ambiente das Edge
  Functions.

Nenhuma dessas variáveis pode usar `NEXT_PUBLIC_`. Tokens não devem aparecer em
issues, prompts, logs, arquivos versionados ou respostas de erro.

## Payload da preferência

O servidor envia a estrutura equivalente a:

```json
{
  "items": [{
    "title": "Próximo Caso E.C.O. | Lote Fundador",
    "quantity": 1,
    "currency_id": "BRL",
    "unit_price": 29.90
  }],
  "external_reference": "<referência interna imutável>",
  "back_urls": {
    "success": "https://liberula.com/eco/eco-sp-001/comprar?order=<referência pública>",
    "pending": "https://liberula.com/eco/eco-sp-001/comprar?order=<referência pública>",
    "failure": "https://liberula.com/eco/eco-sp-001/comprar?order=<referência pública>"
  },
  "notification_url": "https://icjuacgxxpmwqlmjmeuq.supabase.co/functions/v1/eco-sp-001-mercado-pago-webhook",
  "auto_return": "approved"
}
```

`X-Idempotency-Key` usa o UUID interno estável do pedido. Uma falha depois da
criação da preferência pode ser repetida com a mesma chave. O banco impede duas
preferências persistidas e rejeita a reutilização da chave do cliente com outro
comprador ou outra origem.

Em desenvolvimento e teste, somente os hosts `sandbox.mercadopago.com` e
`sandbox.mercadopago.com.br` são aceitos. Em produção, somente
`www.mercadopago.com` e `www.mercadopago.com.br` são aceitos. Credenciais
embutidas e portas customizadas são rejeitadas.

## Webhook e máquina de estados

Configurar no painel do Mercado Pago o evento **Pagamentos** e a URL HTTPS
acima, separadamente para teste e produção. O endpoint aceita somente `POST`,
JSON limitado e uma assinatura `x-signature` válida formada pelo manifesto
oficial `id`, `x-request-id` e `ts`. Uma notificação válida não é autoridade:
ela apenas autoriza a consulta do pagamento na API do provedor.

Transições persistidas:

| Provedor | Pedido |
| --- | --- |
| `approved` | `paid` |
| `pending`, `in_process` | `pending` |
| `rejected` | `rejected` |
| `cancelled` | `cancelled` |
| `refunded` | `refunded` |

Um evento com timestamp mais antigo é registrado sem regressão. `paid` não
regride para `pending`, `rejected` ou `cancelled`; somente um reembolso mais
novo pode levá-lo a `refunded`. `refunded` é terminal. A chave de observação,
o `payment_id` e as constraints de unicidade tornam repetições idempotentes.

## Migrations e ordem de publicação

Aplicar, nesta ordem, todas as migrations pendentes, incluindo:

1. `20260803000000_convert_eco_founder_to_digital.sql`;
2. `20260804000000_set_eco_founder_price_2990.sql`;
3. `20260804010000_prepare_eco_payments_production.sql`.

Depois:

1. manter `ECO_PAYMENTS_ENABLED=false`;
2. configurar os secrets do ambiente escolhido;
3. publicar `eco-sp-001-mercado-pago-webhook`;
4. publicar `eco-sp-001-api`;
5. configurar e simular o webhook no painel do Mercado Pago;
6. validar sandbox;
7. trocar token, assinatura e ambiente para produção;
8. repetir a simulação do webhook de produção;
9. definir `ECO_PAYMENTS_ENABLED=true` somente no checkpoint humano.

Não misturar token de teste com assinatura ou collector de produção.

## Teste em sandbox

1. Em localhost, confirmar `MERCADO_PAGO_ENVIRONMENT=development`; em preview
   ou staging, confirmar `MERCADO_PAGO_ENVIRONMENT=test`. Ativar pagamentos
   somente durante o teste controlado.
2. Criar um pedido novo com dados controlados.
3. Confirmar no checkout `R$ 29,90`, `BRL` e quantidade `1`.
4. Confirmar que a URL começa pelo host sandbox permitido.
5. Finalizar com uma conta/cartão de teste.
6. Verificar o retorno com apenas `order=<referência pública>` como autoridade
   local; ignorar os demais parâmetros para confirmação.
7. Aguardar o webhook e confirmar no banco o status, `preference_id`,
   `payment_id` e timestamp do provedor.
8. Reenviar a mesma notificação e confirmar ausência de novo efeito.

## Teste real controlado

Executar somente com autorização explícita e credenciais configuradas fora do
repositório:

1. abrir a oferta em `https://liberula.com/eco/eco-sp-001/comprar`;
2. usar e-mail e telefone controlados;
3. criar um único pedido novo;
4. conferir **R$ 29,90** antes de pagar;
5. confirmar host `www.mercadopago.com.br` e concluir com meio real;
6. verificar o retorno e aguardar a consulta do status do backend;
7. confirmar uma única preferência e um único pagamento no banco;
8. confirmar status `paid`, valor `2990`, moeda `BRL`, referência externa,
   `payment_id`, `preference_id` e timestamp;
9. confirmar o crédito na conta real do Mercado Pago;
10. conferir eventos de analytics e logs sem PII.

## Diagnóstico

- `503 service_unavailable` ao criar: pagamentos desligados ou configuração
  server-side incompleta.
- `502 checkout_unavailable`: preferência recusada, resposta inválida ou falha
  ao persistir; repetir com a mesma chave de idempotência.
- `401 unauthorized` no webhook: assinatura, request ID ou secret incorretos.
- `notification_rejected`: pagamento consultado não corresponde ao ambiente,
  collector, pedido, preferência, valor ou moeda.
- status temporariamente indisponível: verificar rate limit, RPC e conectividade
  do Supabase; não presumir aprovação.

Logs podem conter somente IDs técnicos/correlação e categorias genéricas. Nunca
copiar corpos completos, dados do comprador, tokens ou resposta bruta do
Mercado Pago.

## Rollback operacional

Definir `ECO_PAYMENTS_ENABLED=false` interrompe imediatamente a criação de novos
pedidos sem remover a oferta ou alterar pedidos existentes. Não desabilitar o
webhook: notificações pendentes precisam continuar atualizando pedidos já
criados. Preservar banco, funções de status e credenciais até reconciliar todos
os pagamentos existentes. Para restaurar, corrigir a causa, validar sandbox ou
uma preferência controlada e só então reativar a flag.

## Critério operacional

A integração só pode ser declarada pronta depois que migrations e funções
implantadas forem confirmadas, secrets de produção estiverem presentes, a
simulação oficial do webhook funcionar e um pagamento real controlado de
R$ 29,90 completar todo o ciclo. Código e testes locais, isoladamente, não
comprovam recebimento real.
