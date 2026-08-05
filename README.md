# Monitor CAUC Saúde

**No ar:** <https://monitor-cauc-saude.pages.dev>

Espelho: <https://gabriel-ribaraujosds.github.io/monitor-cauc-saud/> — mesmo
conteúdo, publicado na mesma execução. A rede do FNS bloqueia a faixa de IPs do
GitHub Pages (185.199.108–111.x), por isso o endereço de referência é o do
Cloudflare.

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
| `verificar-publicacao.mjs` | Compara a posição publicada no site com a da fonte e falha se o site estiver atrás. |
| `gerar-versao-unica.mjs` | Gera `monitor-cauc-saude.html` com tudo em um arquivo só. |
| `monitor-cauc-saude.html` | Versão de arquivo único, pronta para publicar. |

## Publicar

Basta servir os arquivos estáticos — não há backend.

- **Dois arquivos:** suba `index.html` e `dados-cauc.js` na mesma pasta.
- **Arquivo único:** suba apenas `monitor-cauc-saude.html`.

Funciona em qualquer hospedagem estática (GitHub Pages, Netlify, IIS, Apache,
nginx ou um diretório interno do FNS).

### Publicação automática no GitHub Pages

O repositório já traz `.github/workflows/publicar.yml`, que faz tudo sozinho:

1. baixa a posição mais recente do CAUC (`atualizar-dados.mjs`);
2. gera a versão de arquivo único (`gerar-versao-unica.mjs`);
3. registra a base no repositório quando ela muda;
4. publica o site no GitHub Pages.

Ele roda **todo dia às 08h20 (horário de Brasília)**, com uma segunda execução
às 09h30 como rede de segurança, além de rodar a cada alteração no código e sob
demanda pela aba *Actions*. Para criar o repositório e ligar a publicação:

```bash
git remote add origin https://github.com/SEU-USUARIO/monitor-cauc-saude.git
git push -u origin main
```

O repositório precisa ser **público** para o GitHub Pages gratuito. O endereço
final é `https://SEU-USUARIO.github.io/monitor-cauc-saude/`.

O horário acompanha a gravação do arquivo no Tesouro, que ocorre por volta das
11h10 UTC (08h10 em Brasília). Agendar antes disso faz o painel publicar a
posição da véspera. Para mudar, edite o `cron` no workflow — o valor está
sempre em UTC, e o GitHub pode atrasar execuções agendadas em alguns minutos
nos horários de pico.

### Monitoramento da publicação

O workflow `.github/workflows/verificar.yml` roda todo dia às 11h07 (Brasília),
depois da última janela de publicação, e compara a posição servida pelo site com
a que o Tesouro divulga naquele momento. Se o site estiver atrás, a execução
falha e o GitHub avisa por e-mail.

A comparação é feita contra a fonte, não contra o calendário: em fim de semana
ou feriado, quando o Tesouro não publica, site e fonte seguem iguais e nada é
reportado. O alarme só existe quando a fonte andou e o site não.

Para conferir manualmente a qualquer momento:

```bash
node verificar-publicacao.mjs
```

> O GitHub desativa agendamentos em repositórios sem atividade por 60 dias. Como
> o workflow registra a base sempre que ela muda (o que ocorre semanalmente), o
> repositório se mantém ativo. Se ainda assim chegar o aviso por e-mail, basta
> reativar o workflow na aba *Actions*.

## Atualizar a base manualmente

```bash
node atualizar-dados.mjs
node gerar-versao-unica.mjs   # opcional, se usar a versão de arquivo único
```

O script consulta o catálogo CKAN do Tesouro Nacional
(`package_show?id=cauc`), escolhe os CSVs mais recentes de municípios e de
estados/DF, e regrava a base local.

A base gerencial do CAUC é divulgada **semanalmente** (em geral no primeiro dia
útil). A execução diária do workflow não muda essa periodicidade — ela apenas
garante que a nova posição entre no ar no mesmo dia em que for divulgada.

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
