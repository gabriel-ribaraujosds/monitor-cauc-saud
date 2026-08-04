/**
 * Monitor CAUC Saúde — atualizador da base local.
 *
 * Baixa a posição mais recente do CAUC no catálogo de dados abertos do
 * Tesouro Nacional (CKAN) e grava `dados-cauc.js`, consumido pelo index.html.
 *
 *   node atualizar-dados.mjs
 *
 * A base gerencial do CAUC é divulgada semanalmente; o extrato oficial do ente
 * continua sendo o emitido diariamente pelo Tesouro Nacional.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const CKAN = 'https://www.tesourotransparente.gov.br/ckan/api/3/action/package_show?id=cauc';

/** Descrições oficiais dos itens do extrato (metadados do CAUC, Tesouro Nacional). */
const ITENS = {
  '1.1': 'Regularidade quanto a tributos, a contribuições previdenciárias federais e à dívida ativa da União',
  '1.2': 'Regularidade no pagamento de precatórios judiciais',
  '1.3': 'Regularidade quanto a contribuições para o FGTS',
  '1.4': 'Regularidade em relação à adimplência financeira em empréstimos e financiamentos concedidos pela União',
  '1.5': 'Regularidade perante o Poder Público Federal',
  '2.1.1': 'Prestação de contas de recursos federais recebidos anteriormente — SIAFI/Subsistema Transferências',
  '2.1.2': 'Prestação de contas de recursos federais recebidos anteriormente — Transferegov.br',
  '3.1.1': 'RGF — Publicação do Relatório de Gestão Fiscal',
  '3.1.2': 'RGF — Encaminhamento do Relatório de Gestão Fiscal ao Siconfi',
  '3.2.1': 'RREO — Publicação do Relatório Resumido de Execução Orçamentária',
  '3.2.2': 'RREO — Encaminhamento do Relatório Resumido de Execução Orçamentária ao Siconfi',
  '3.2.3': 'RREO — Encaminhamento do Anexo 8 do RREO ao Siope',
  '3.2.4': 'RREO — Encaminhamento do Anexo 12 do RREO ao Siops',
  '3.3': 'Encaminhamento das contas anuais',
  '3.4.1': 'Encaminhamento da Matriz de Saldos Contábeis mensal',
  '3.4.2': 'Encaminhamento da Matriz de Saldos Contábeis de encerramento',
  '3.5': 'Encaminhamento de informações para o Cadastro da Dívida Pública — CDP',
  '3.6': 'Transparência da execução orçamentária e financeira em meio eletrônico de acesso público',
  '3.7': 'Adoção de Sistema Integrado de Administração Financeira e Controle — Siafic',
  '4.1': 'Exercício da plena competência tributária',
  '4.2': 'Regularidade previdenciária',
  '4.3': 'Regularidade quanto à concessão de incentivos fiscais',
  '5.1': 'Aplicação mínima de recursos em educação',
  '5.2': 'Aplicação mínima de recursos em saúde',
  '5.3': 'Limite de despesas com Parcerias Público-Privadas (PPP)',
  '5.4': 'Limite de operações de crédito, inclusive por antecipação de receita',
  '5.5': 'Aplicação mínima do Fundeb para pagamento de profissionais da educação básica',
  '5.6': 'Aplicação mínima da complementação da União ao Fundeb em despesas de capital',
  '5.7': 'Aplicação de 50% da complementação VAAT do Fundeb na educação infantil',
  '5.8': 'Destinação mínima de recursos para a constituição do Fundeb',
};

/** Rótulo curto usado nas tabelas e nos filtros. */
const APELIDOS = {
  '3.2.4': 'Anexo 12 do RREO ao Siops',
  '5.2': 'Aplicação mínima em saúde',
};

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function decodificar(buffer) {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  if (!utf8.includes('�')) return utf8;
  return new TextDecoder('windows-1252').decode(buffer);
}

/** Divide uma linha CSV com separador ";" e aspas duplas. */
function dividirLinha(linha) {
  const campos = [];
  let atual = '';
  let entreAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (entreAspas) {
      if (c === '"') {
        if (linha[i + 1] === '"') { atual += '"'; i++; } else { entreAspas = false; }
      } else atual += c;
    } else if (c === '"') entreAspas = true;
    else if (c === ';') { campos.push(atual); atual = ''; }
    else atual += c;
  }
  campos.push(atual);
  return campos.map((v) => v.trim());
}

function parsearCsv(texto) {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim() !== '');
  const cabecalho = linhas.findIndex((l) => l.startsWith('"UF"'));
  if (cabecalho < 0) throw new Error('Cabeçalho não encontrado no CSV do CAUC.');

  const metadados = {};
  for (const l of linhas.slice(0, cabecalho)) {
    const [chave, ...resto] = dividirLinha(l)[0].split(':');
    if (resto.length) metadados[chave.trim()] = resto.join(':').trim();
  }

  const colunas = dividirLinha(linhas[cabecalho]);
  // Depois dos entes o arquivo traz um anexo com a legenda dos itens ("Código
  // do Itens";"Exigência"), que tem duas colunas apenas — descartado aqui.
  const registros = linhas
    .slice(cabecalho + 1)
    .map(dividirLinha)
    .filter((r) => r.length === colunas.length && /^\d+$/.test(r[2] || ''));
  return { dataPesquisa: metadados['Data da Pesquisa'] || '', colunas, registros };
}

/** Compacta a matriz de situações num dicionário + índices de largura fixa. */
function compactar({ dataPesquisa, colunas, registros }) {
  const fixas = ['UF', 'Nome do Ente Federado', 'Código IBGE', 'Código SIAFI', 'Região', 'População', 'Fonte'];
  const itens = colunas.slice(fixas.length);
  const idx = Object.fromEntries(colunas.map((c, i) => [c, i]));

  const dicionario = [];
  const posicoes = new Map();
  const chave = (v) => {
    if (!posicoes.has(v)) { posicoes.set(v, dicionario.length); dicionario.push(v); }
    return posicoes.get(v);
  };

  const linhas = registros.map((r) => {
    const codigos = itens
      .map((it) => chave(r[idx[it]] ?? ''))
      .map((n) => B64[Math.floor(n / 64)] + B64[n % 64])
      .join('');
    return [
      r[idx['UF']],
      r[idx['Nome do Ente Federado']],
      r[idx['Código IBGE']],
      r[idx['Código SIAFI']],
      r[idx['Região']],
      Number(r[idx['População']] || 0),
      codigos,
    ];
  });

  if (dicionario.length > 64 * 64) throw new Error('Dicionário maior que a largura de codificação.');
  linhas.sort((a, b) => a[0].localeCompare(b[0], 'pt-BR') || a[1].localeCompare(b[1], 'pt-BR'));
  return { dataPesquisa, itens, dicionario, entes: linhas };
}

/**
 * O portal do Tesouro fica atrás de um WAF que responde mal a clientes sem
 * cabeçalhos de navegador e sofre quedas curtas. Daí o User-Agent explícito,
 * as tentativas repetidas e o diagnóstico detalhado em caso de falha.
 */
const CABECALHOS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
  Accept: '*/*',
  'Accept-Language': 'pt-BR,pt;q=0.9',
};

const TENTATIVAS = 4;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function requisitar(url, descricao) {
  let ultimoErro;
  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    try {
      const resp = await fetch(url, {
        headers: CABECALHOS,
        signal: AbortSignal.timeout(120000),
      });
      if (!resp.ok) {
        const amostra = (await resp.text()).slice(0, 300).replace(/\s+/g, ' ');
        throw new Error(`HTTP ${resp.status} ${resp.statusText} — resposta: ${amostra}`);
      }
      return resp;
    } catch (erro) {
      ultimoErro = erro;
      const causa = erro.cause ? ` (causa: ${erro.cause.code || erro.cause.message})` : '';
      process.stdout.write(
        `  tentativa ${tentativa}/${TENTATIVAS} falhou em ${descricao}: ${erro.message}${causa}\n`
      );
      if (tentativa < TENTATIVAS) await espera(tentativa * 5000);
    }
  }
  throw new Error(`${descricao}: ${ultimoErro.message}\n  URL: ${url}`);
}

async function baixar(url, descricao) {
  const resp = await requisitar(url, descricao);
  return decodificar(await resp.arrayBuffer());
}

async function main() {
  process.stdout.write('Consultando o catálogo do Tesouro Nacional…\n');
  const pacote = await (await requisitar(CKAN, 'catálogo CKAN')).json();
  if (!pacote.success) throw new Error('CKAN não retornou o conjunto "cauc".');

  const recursos = pacote.result.resources.filter((r) => (r.format || '').toUpperCase() === 'CSV');
  const maisRecente = (padrao) =>
    recursos
      .filter((r) => padrao.test(r.name || ''))
      .sort((a, b) => new Date(b.last_modified) - new Date(a.last_modified))[0];

  const recMun = maisRecente(/munic/i);
  const recEst = maisRecente(/estado/i);
  if (!recMun || !recEst) throw new Error('Recursos CSV de municípios/estados não localizados.');

  process.stdout.write('Baixando a posição dos municípios…\n');
  const municipios = compactar(parsearCsv(await baixar(recMun.url, 'CSV dos municípios')));
  process.stdout.write('Baixando a posição dos estados e do DF…\n');
  const estados = compactar(parsearCsv(await baixar(recEst.url, 'CSV dos estados e DF')));

  const dados = {
    geradoEm: new Date().toISOString(),
    fonte: {
      nome: 'Tesouro Nacional — dados abertos do CAUC',
      catalogo: 'https://www.tesourotransparente.gov.br/ckan/dataset/cauc',
      municipios: recMun.url,
      estados: recEst.url,
    },
    itens: ITENS,
    apelidos: APELIDOS,
    municipios,
    estados,
  };

  const saida = path.join(RAIZ, 'dados-cauc.js');
  await fs.writeFile(saida, `window.CAUC_DADOS = ${JSON.stringify(dados)};\n`, 'utf8');

  const kb = Math.round((await fs.stat(saida)).size / 1024);
  process.stdout.write(
    `\nOK: ${saida} (${kb} KB)\n` +
      `  municípios: ${municipios.entes.length} entes — posição ${municipios.dataPesquisa}\n` +
      `  estados/DF: ${estados.entes.length} entes — posição ${estados.dataPesquisa}\n`
  );
}

main().catch((e) => {
  console.error('Falha ao atualizar a base:', e.message);
  process.exit(1);
});
