# Painel local de operações de entrega E.C.O.

O painel em `/internal/eco/deliveries/` substitui a cópia manual de UUIDs e as chamadas `curl` durante testes controlados. Ele lista no máximo 100 participantes, prepara deliveries explícitas e envia somente deliveries explicitamente selecionadas.

## Por que é local

O site público é exportado como arquivos estáticos. Colocar uma service-role key ou o segredo administrativo no JavaScript público permitiria que qualquer visitante administrasse participantes e enviasse e-mails. Por isso:

- a página nasce bloqueada e só habilita controles em `localhost` ou `127.0.0.1`;
- os proxies recusam execução fora de `next dev` local;
- secrets são lidos somente pelos Route Handlers do processo local;
- não existe variável administrativa `NEXT_PUBLIC_`;
- os Route Handlers não são copiados como backend funcional para o diretório estático `out`;
- o painel não usa PostHog, armazenamento persistente, polling, jobs ou seleção automática.

Este painel não é um portal administrativo de produção.

## Configuração local

Crie ou atualize `.env.local` sem versioná-lo:

```text
ECO_ADMIN_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
ECO_ADMIN_SUPABASE_SECRET_KEY=sb_secret_<SECRET_KEY>
ECO_DELIVERY_FUNCTION_URL=https://<PROJECT_REF>.supabase.co/functions/v1/eco-case-delivery
ECO_DELIVERY_ADMIN_SECRET=<ADMIN_SECRET>
```

`ECO_ADMIN_SUPABASE_SECRET_KEY` recebe uma Secret API Key moderna criada em **Settings → API Keys**. Ela não é o JSON de `SUPABASE_SECRET_KEYS`: use somente o valor individual `sb_secret_...`. O proxy envia essa chave no header `apikey`; não tenta usá-la como JWT em `Authorization`.

`ECO_DELIVERY_FUNCTION_URL` pode ser omitida quando a função usa o caminho padrão no mesmo projeto de `ECO_ADMIN_SUPABASE_URL`. Nunca use prefixo `NEXT_PUBLIC_` e nunca faça commit de `.env.local`.

## Iniciar e abrir

```powershell
npm run dev
```

Abra:

```text
http://localhost:3000/internal/eco/deliveries/
```

O painel não deve ser aberto por IP de rede, hostname de preview ou domínio público. Fora dos dois hostnames locais permitidos, ele mostra somente que está indisponível.

## Fluxo de teste controlado

1. Em **TESTE CONTROLADO**, informe um e-mail de teste já registrado e aplique o filtro.
2. Confira nome, e-mail e status. O painel não cria participantes.
3. Se não houver delivery, use **Preparar** ou selecione a linha e clique em **PREPARAR DELIVERY**.
4. Confirme que o diálogo informa `eco-sp-001` e que a preparação não envia e-mail.
5. Depois da atualização automática, use **Copiar link** ou **ABRIR LANDING**. A landing abre em nova aba com `noopener` e `noreferrer`.
6. Para enviar, selecione uma delivery `pending` e clique em **ENVIAR E-MAIL REAL**, ou use a ação correspondente na linha.
7. Leia o alerta e confirme conscientemente que não é uma pré-visualização.
8. Confira o resultado no painel e em **Postmark > Activity**.
9. Use **ATUALIZAR** para consultar novamente o estado. Não existe polling contínuo.

Uma preparação ausente nunca é criada automaticamente pelo botão de envio. Uma delivery `sent` não oferece reenvio. Uma delivery `cancelled` não oferece envio ou retry.

## Inspeção de estado

O painel exibe estado, número de tentativas e código genérico da última falha. Ele não exibe resposta bruta do Postmark, SQL, stack trace, provider MessageID, source records ou metadados de aquisição.

O fluxo esperado de sucesso continua:

```text
pending → sending → sent
```

O painel não altera regras de claim, concorrência, limite de três tentativas ou falha ambígua. Depois de enviar, confira `sent`, `attempt_count` e o recebimento no Postmark Activity.

## Retry seguro

Uma delivery `failed` com menos de três tentativas mostra **Ver erro** e **Tentar novamente**. Antes de repetir `postmark_result_unknown`, verifique obrigatoriamente o Postmark Activity: o provedor pode ter aceitado o e-mail mesmo que a resposta tenha sido perdida. Todo retry exige outra confirmação explícita; não há retry automático.

## Limites e privacidade

- no máximo 100 participantes são consultados, por `registered_at desc`;
- no máximo 10 participantes podem ser selecionados;
- não há **Selecionar todos** nem **Enviar para todos**;
- e-mail é mostrado apenas porque o painel é uma ferramenta local de teste;
- nenhum participante é armazenado em `localStorage`, `sessionStorage` ou IndexedDB;
- nenhuma ação administrativa gera evento PostHog;
- nomes e e-mails não são escritos em logs pelos proxies.

## Validação

```powershell
npm test
npm run lint
npm run build
git diff --check
```

Após `npm run build`, confirme que não existe backend administrativo funcional em `out/api/internal/eco/` e que os arquivos públicos não contêm valores de secrets.

## Encerrar

No terminal onde `next dev` está rodando, pressione `Ctrl+C`. O painel e os proxies deixam de existir quando o processo local é encerrado.

## Administração futura

Se operações remotas forem necessárias, substitua esta ferramenta por um serviço administrativo autenticado, com identidade do operador, autorização por função, auditoria, proteção CSRF, expiração de sessão e gestão separada de secrets. Não publique estes Route Handlers como substituto desse sistema.
