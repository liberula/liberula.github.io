# Entrega do dossiê ECO-SP-001

## Preparação do arquivo

O operador humano deve colocar o PDF final aprovado exatamente em:

```text
public/eco/eco-sp-001/eco-sp-001-atalho.pdf
```

Não use um arquivo provisório ou o rascunho atual. A página pode ser compilada
sem o PDF, mas a validação final da entrega exige o arquivo real nesse caminho.

## Validação local

Depois de inserir o PDF aprovado, execute:

```bash
npm test
npm run build
```

Confirme que a exportação estática produziu:

```text
out/eco/eco-sp-001/iniciar/index.html
out/eco/eco-sp-001/eco-sp-001-atalho.pdf
```

## Validação em produção

Teste as duas URLs:

```text
https://liberula.com/eco/eco-sp-001/iniciar/
https://liberula.com/eco/eco-sp-001/eco-sp-001-atalho.pdf
```

No PostHog, confirme o recebimento dos eventos:

```text
eco_case_delivery_landing_viewed
eco_case_dossier_opened
```

O evento `eco_case_dossier_opened` comprova somente que o link do dossiê foi
acionado. Ele não comprova que a pessoa leu, analisou ou concluiu o PDF.
