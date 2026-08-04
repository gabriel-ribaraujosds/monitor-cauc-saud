# Monitor CAUC Saúde

Consulta pública da posição atual dos requisitos do CAUC (Cadastro Único de Convênios),
com destaque para os itens de saúde:

- **3.2.4** — Encaminhamento do Anexo 12 do RREO ao Siops
- **5.2** — Aplicação mínima de recursos em saúde

Identidade visual institucional em azul e branco, no mesmo design system dos
Indicadores Municipais (SIOPS).

## Arquivos

| Arquivo | Para que serve |
| --- | --- |
| `index.html` | O site. Todo o CSS e o JavaScript estão embutidos. |
| `dados-cauc.js` | Base do CAUC compactada, carregada pelo `index.html`. |
| `atualizar-dados.mjs` | Baixa a posição mais recente do Tesouro e regrava o `dados-cauc.js`. |
| `gerar-versao-unica.mjs` | Gera `monitor-cauc-saude.html` com tudo em um arquivo só. |
| `monitor-cauc-saude.html` | Versão de arquivo único, pronta para publicar. |

## Publicar

Basta servir os arquivos estáticos — não há backend.

- **Dois arquivos:** suba `index.html` e `dados-cauc.js` na mesma pasta.
- **Arquivo único:** suba apenas `monitor-cauc-saude.html`.

Funciona em qualquer hospedagem estática (GitHub Pages, Netlify, IIS, Apache,
nginx ou um diretório interno do FNS).

## Atualizar a base

```bash
node atualizar-dados.mjs
node gerar-versao-unica.mjs   # opcional, se usar a versão de arquivo único
```

O script consulta o catálogo CKAN do Tesouro Nacional
(`package_show?id=cauc`), escolhe os CSVs mais recentes de municípios e de
estados/DF, e regrava a base local.

A base gerencial do CAUC é divulgada **semanalmente** (em geral no primeiro dia
útil), então rodar o script uma vez por semana mantém o painel em dia.

### Por que a base fica embutida

O CSV do Tesouro responde com `Access-Control-Allow-Origin` restrito ao domínio
`www.tesouro.fazenda.gov.br`. Um site estático não consegue, portanto, baixar o
arquivo direto pelo navegador — seria preciso um backend só para intermediar a
chamada. Embutir a posição atual evita esse servidor e deixa o painel abrindo
instantaneamente, ao custo de rodar o script de atualização a cada divulgação.

## Como as situações são classificadas

Cada célula do CAUC traz a **data de validade** da comprovação do requisito.
A partir dela o painel classifica:

| Situação | Regra |
| --- | --- |
| **Alerta** | Célula com `!` — o CAUC não obteve comprovação de cumprimento. |
| **Vencido** | Data de validade anterior à data da posição da base. |
| **Vence em 30d** | Validade entre 1 e 30 dias após a posição da base. |
| **Regular** | Validade igual ou superior a 30 dias — inclui a comprovação do próprio dia da extração. |
| **Desabilitado** | Item indisponível na consulta para todos os entes. |
| **Sem informação** | Célula vazia no arquivo de origem. |

A coluna **Alertas CAUC** conta, por ente, os itens em *Alerta* ou *Vencido*
entre todos os requisitos do extrato.

Itens que o CAUC desabilita para um tipo de ente aparecem como
*item desabilitado nesta base* — é o caso do 3.2.4 na base de estados e DF.

## Fonte e limites

- Dados abertos do CAUC — Tesouro Nacional:
  <https://www.tesourotransparente.gov.br/ckan/dataset/cauc>
- Descrições dos itens conforme os metadados oficiais do conjunto.
- O painel mostra **apenas a posição atual**, sem série histórica.
- Consulta **gerencial**: não substitui o extrato diário oficial do CAUC.
