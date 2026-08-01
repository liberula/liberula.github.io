# Envio do Caso E.C.O.

O fluxo operacional local é selecionar participantes, pré-visualizar o e-mail e clicar em **ENVIAR E-MAIL**. A preparação é uma implementação interna e não aparece no painel.

## Renderer e identidade do e-mail

O renderer compartilhado está em `lib/eco/delivery-email.mjs`. Ele produz `subject`, `preheader`, `htmlBody` e `textBody` e é importado tanto pelo sender Postmark quanto pelo proxy local de prévia. Não há uma segunda versão do template.

O assunto é:

```text
E.C.O. — Caso ECO-SP-001 disponível
```

O nome válido é normalizado e exibido como `ASPIRANTE: <NOME>`. Sem nome, aparece somente `ASPIRANTE`.

As constantes visuais foram copiadas de:

- `app/eco/eco-sp-001/EcoCase.module.css`;
- `app/eco/eco-sp-001/iniciar/DeliveryLanding.module.css`.

Elas ficam inline porque clientes de e-mail não carregam o CSS do site. O template usa as cores exatas `#080909`, `#111313`, `#f0ede5`, `#bbb7ae`, `#8e8a82`, `#d94b55` e `#b62430`, fontes de sistema, tabelas conservadoras e largura máxima de 600 px.

O emblema foi removido porque perdia clareza no tamanho de e-mail e adicionava uma dependência de imagem. A marca agora é tipográfica; o ticket não adiciona outra imagem. O HTML não usa JavaScript, stylesheet externo, web font, SVG ou background image.

## Contratos

O proxy local aceita o contrato normal por participante:

```json
{
  "action": "send_participants",
  "case_id": "eco-sp-001",
  "participant_ids": ["00000000-0000-4000-8000-000000000000"]
}
```

São permitidos de 1 a 10 UUIDs únicos. O proxy consulta elegibilidade, cria ou reutiliza registros com a ação interna `prepare` e chama a ação interna `send`. Uma referência existente é preservada.

Para compatibilidade, a Edge Function e o proxy ainda aceitam:

```json
{ "action": "prepare", "case_id": "eco-sp-001", "participant_ids": ["UUID"] }
```

```json
{ "action": "send", "delivery_ids": ["UUID"] }
```

Esses contratos internos não devem ser usados no fluxo normal do operador.

## Estados, concorrência e retry

A máquina interna permanece:

```text
pending | failed
→ sending (attempt_count + 1)
→ sent | failed
```

O claim atômico impede envio concorrente duplicado. Sucesso persiste `sent_at`, `email_provider` e `provider_message_id`; falha persiste somente um código genérico. `opened_at` não é alterado.

Uma entrega já `sent` não é reenviada. `cancelled` é bloqueada. `failed` só pode ser tentada novamente com `attempt_count < 3` e confirmação explícita. Não há retry automático nem suporte a resend.

## Prévia sem efeitos colaterais

`GET /api/internal/eco/delivery-preview` gera o exemplo. `participant_id=<UUID>` usa o nome da pessoa selecionada, e `format=html` abre o HTML em nova aba. O endpoint é local-only, usa uma URL falsa válida e não cria ou altera registros, não chama a Edge Function, não chama Postmark e não emite analytics.

No painel, valide os modos **DESKTOP**, **MOBILE** e **TEXTO**. Desktop e mobile apenas mudam a largura do frame; o HTML é idêntico ao corpo enviado pelo Postmark para os mesmos dados.

## Envio controlado e inspeção

Use apenas uma caixa de entrada controlada:

1. inicie `npm run dev` e abra `http://localhost:3000/internal/eco/deliveries/`;
2. filtre e selecione uma pessoa controlada;
3. confira os três modos da prévia;
4. clique em **ENVIAR E-MAIL** e valide quantidade e endereço no diálogo;
5. confirme remetente, assunto, corpo HTML/texto e uma única aceitação em **Postmark > Activity**;
6. confirme que botão e URL visível levam à landing individual;
7. atualize o painel e confirme **ENVIADO**.

Aceitação pelo Postmark não significa abertura ou conclusão. Se o resultado for ambíguo, procure por destinatário e horário no Postmark Activity antes de qualquer nova tentativa.

## Configuração e validação

A Edge Function usa somente secrets de servidor:

```text
ECO_DELIVERY_ADMIN_SECRET
ECO_PUBLIC_BASE_URL
POSTMARK_SERVER_TOKEN
POSTMARK_FROM_EMAIL
POSTMARK_REPLY_TO
POSTMARK_MESSAGE_STREAM
```

Nunca use `NEXT_PUBLIC_` para esses valores.

```powershell
npm test
npm run lint
npm run build
git diff --check
```

Os testes usam dependências simuladas e não fazem solicitações reais ao Postmark. Deploy, envio real e reconciliação histórica são etapas manuais fora desta implementação.
