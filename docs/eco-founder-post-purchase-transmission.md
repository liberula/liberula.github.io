# E-mail pós-compra e registro final de Quina

## Finalidade

O fluxo entrega um único fragmento narrativo ao comprador da campanha fundadora de ECO-SP-001 depois que um pagamento confiável é persistido como `paid`. Criação de pedido, retorno do navegador, preferência, consulta de status e pagamentos não confirmados não disparam a mensagem.

Pagamento e mensagem possuem estados independentes. Uma falha do Postmark nunca reverte, bloqueia ou reclassifica o pedido.

## Fluxo

1. O webhook valida assinatura e consulta o pagamento diretamente no Mercado Pago.
2. A RPC existente persiste a transição autorizada para `paid`.
3. Um trigger transacional cria `eco_founder_messages` com unicidade por pedido e tipo. A migration não faz backfill de pedidos pagos existentes.
4. O webhook solicita, sem bloquear sua resposta, uma execução do dispatcher. Se essa chamada falhar, o registro `pending` permanece durável.
5. `eco-founder-post-purchase-dispatch` reivindica um lote pequeno, monta HTML e texto simples pelo renderer compartilhado e chama o Postmark.
6. O identificador do provedor e `sent_at` são persistidos somente depois da aceitação confirmada.
7. O CTA aponta para `/eco/eco-sp-001/registros/quina-final` com um token
   aleatório de 256 bits que não contém e-mail nem UUID do pedido. A página
   consulta `eco-founder-record`; o conteúdo reservado não fica no bundle do
   site.

Notificações duplicadas podem solicitar o dispatcher novamente, mas não criam outra linha nem reivindicam uma mensagem `sent`.

## Estados e retry

Estados: `pending`, `processing`, `sent`, `failed` e `cancelled`.

- falha 5xx confirmada do Postmark: no máximo três tentativas, com 5 e 30 minutos de espera;
- configuração, autenticação, rejeição ou resposta inválida: falha sem loop automático;
- timeout, falha de rede ou worker interrompido depois da reivindicação: `postmark_result_unknown`, sem retry automático para evitar mensagem duplicada;
- sucesso: nunca é reivindicado novamente;
- reembolso antes do envio: cancela trabalho pendente;
- reembolso depois do envio: o link já entregue continua acessível, mas nenhum novo conteúdo é liberado.

Retry manual de falha inequivocamente não entregue:

```http
POST /functions/v1/eco-founder-post-purchase-dispatch
Authorization: Bearer <ECO_FOUNDER_EMAIL_SECRET>
Content-Type: application/json

{
  "action": "retry",
  "order_reference": "<referência pública>"
}
```

O RPC recusa retry de `postmark_result_unknown`, de mensagem já enviada, de pedido não pago ou depois do limite. Antes de qualquer intervenção em resultado ambíguo, conferir o Postmark manualmente.

## Registro reservado

`eco-founder-record` valida o token no servidor, confirma o estado do pedido,
aplica rate limit distribuído e responde sem cache. A página do site possui
`noindex` e `Referrer-Policy: no-referrer`; a imagem usa a mesma capability e
nunca é servida por um caminho público. Nenhuma resposta contém
dados do comprador. A API devolve o documento como texto para contornar a
restrição de HTML no domínio padrão das Edge Functions, e o site o exibe em
um iframe sandboxed.

A transmissão recuperada é uma transcrição textual estilizada como
comunicação operacional. Não existe arquivo de áudio, player, streaming,
proxy de mídia ou dependência de gravação.

O asset visual fica empacotado privadamente com a função:

`supabase/functions/eco-founder-record/assets/quina-final-transmission.png`

Ele não é publicado em `public/`. O e-mail usa uma URL protegida pela mesma
capability opaca do registro, e a Edge Function só entrega o PNG depois de
validar o pedido. O texto alternativo descreve somente Quina diante da passagem.
A interface não destaca nem menciona detalhes ocultos da imagem.

## Variáveis server-side

- `ECO_FOUNDER_EMAIL_SECRET`
- `ECO_FOUNDER_EMAIL_DISPATCH_URL`
- `ECO_FOUNDER_RECORD_PAGE_URL`
- `ECO_FOUNDER_RECORD_API_URL`
- `NEXT_PUBLIC_ECO_FOUNDER_RECORD_API_URL` (somente endpoint, nunca segredo)
- `ECO_PUBLIC_BASE_URL`
- `ECO_FOUNDER_RECORD_RATE_LIMIT_SALT`
- `ECO_SUPPORT_EMAIL`
- `POSTMARK_SERVER_TOKEN`
- `POSTMARK_FROM_EMAIL`
- `POSTMARK_REPLY_TO`
- `POSTMARK_MESSAGE_STREAM`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Somente o endpoint público da API usa `NEXT_PUBLIC_`; tokens, service role,
Postmark e segredos de dispatcher permanecem exclusivamente server-side.

Valores de endpoint para o projeto Liberula (`icjuacgxxpmwqlmjmeuq`):

```text
ECO_FOUNDER_EMAIL_DISPATCH_URL=https://icjuacgxxpmwqlmjmeuq.supabase.co/functions/v1/eco-founder-post-purchase-dispatch
ECO_FOUNDER_RECORD_API_URL=https://icjuacgxxpmwqlmjmeuq.supabase.co/functions/v1/eco-founder-record
NEXT_PUBLIC_ECO_FOUNDER_RECORD_API_URL=https://icjuacgxxpmwqlmjmeuq.supabase.co/functions/v1/eco-founder-record
ECO_FOUNDER_RECORD_PAGE_URL=https://liberula.com/eco/eco-sp-001/registros/quina-final
```

## Publicação e recuperação

Ordem recomendada, mantendo pagamentos desativados durante a mudança:

1. aplicar `20260804020000_add_eco_founder_post_purchase_message.sql`;
2. publicar `eco-founder-record --no-verify-jwt` com bundling local; o asset
   declarado em `static_files` não é incluído por `--use-api`;
3. publicar `eco-founder-post-purchase-dispatch --no-verify-jwt`;
4. configurar os secrets e URLs das duas funções e do webhook;
5. republicar `eco-sp-001-mercado-pago-webhook --no-verify-jwt`;
6. configurar recuperação a cada cinco minutos para enviar `{"action":"dispatch","limit":3}` ao dispatcher autenticado;
7. validar em sandbox com um pedido novo; não alterar compradores existentes;
8. somente depois do checkpoint, reativar criação de pedidos.

Comandos das funções, para execução humana somente depois da migration e da
configuração dos secrets:

```bash
supabase functions deploy eco-founder-record --project-ref icjuacgxxpmwqlmjmeuq --no-verify-jwt
supabase functions deploy eco-founder-post-purchase-dispatch --project-ref icjuacgxxpmwqlmjmeuq --no-verify-jwt
supabase functions deploy eco-sp-001-mercado-pago-webhook --project-ref icjuacgxxpmwqlmjmeuq --no-verify-jwt
```

O primeiro comando precisa de bundling local e Docker disponível, porque inclui
o PNG declarado em `static_files`. Não acrescentar `--use-api`: esse modo não
envia arquivos estáticos da função.

## Validação controlada

1. Criar pedido sandbox `pending` e confirmar ausência de mensagem.
2. Entregar webhook assinado e autoritativo `approved`.
3. Confirmar uma linha de mensagem e um único envio Postmark.
4. Repetir o webhook e confirmar que `sent_at` e `provider_message_id` não mudam.
5. Abrir o CTA, confirmar `noindex`, imagem e transcrição textual completa.
6. Testar HTML, texto simples, imagens bloqueadas, Gmail, Outlook, Apple Mail e viewport estreito.
7. Simular 5xx e confirmar retry limitado; simular timeout e confirmar revisão humana sem retry.
8. Confirmar que logs contêm somente categorias operacionais, nunca PII, token ou corpo da mensagem.

Eventos operacionais: `eco_founder_email_requested`, `eco_founder_email_sent`,
`eco_founder_email_failed` e `eco_founder_record_opened`.
