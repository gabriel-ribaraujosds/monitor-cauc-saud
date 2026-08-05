/**
 * Verifica se o site publicado está com a mesma posição que o Tesouro Nacional
 * divulga neste momento.
 *
 *   node verificar-publicacao.mjs
 *
 * Sai com código 1 quando o site está atrás da fonte — é isso que faz o GitHub
 * marcar a execução como falha e avisar por e-mail.
 *
 * A comparação é feita contra a própria fonte, e não contra o calendário: se o
 * Tesouro não publicou (fim de semana, feriado), site e fonte continuam iguais
 * e nada é reportado. Alarme só existe quando a fonte andou e o site não.
 */

const SITE = 'https://monitor-cauc-saude.pages.dev/dados-cauc.js';
const CSV =
  'https://www.tesourotransparente.gov.br/ckan/dataset/72b5f371-0c35-4613-8076-c99c821a6410/resource/' +
  '07af297a-5e59-494a-a88a-55ddfd2f4b01/download/' +
  'relatorio-situacao-de-varios-entes---municipios---uf-todas---abrangencia-1.csv';

const CABECALHOS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
};

/** Lê só o início do CSV — o cabeçalho traz a data da extração. */
async function posicaoNaFonte() {
  const resp = await fetch(CSV, {
    headers: { ...CABECALHOS, Range: 'bytes=0-300' },
    signal: AbortSignal.timeout(60000),
  });
  if (!resp.ok && resp.status !== 206) throw new Error(`Fonte respondeu HTTP ${resp.status}.`);
  const texto = Buffer.from(await resp.arrayBuffer()).toString('latin1');
  const achado = /Data da Pesquisa:\s*(\d{2}\/\d{2}\/\d{4})/.exec(texto);
  if (!achado) throw new Error('Não foi possível ler a data da pesquisa no CSV da fonte.');
  return achado[1];
}

async function posicaoNoSite() {
  const resp = await fetch(`${SITE}?cb=${Date.now()}`, {
    headers: CABECALHOS,
    signal: AbortSignal.timeout(120000),
  });
  if (!resp.ok) throw new Error(`Site respondeu HTTP ${resp.status}.`);
  const codigo = await resp.text();
  const contexto = { window: {} };
  new Function('window', codigo).call(contexto, contexto.window);
  const dados = contexto.window.CAUC_DADOS;
  if (!dados) throw new Error('dados-cauc.js publicado não define CAUC_DADOS.');
  return { data: dados.municipios.dataPesquisa, geradoEm: dados.geradoEm };
}

const [fonte, site] = await Promise.all([posicaoNaFonte(), posicaoNoSite()]);

process.stdout.write(`Posição no Tesouro Nacional : ${fonte}\n`);
process.stdout.write(`Posição publicada no site   : ${site.data} (gerada em ${site.geradoEm})\n`);

if (fonte === site.data) {
  process.stdout.write('\nOK: o site está com a posição mais recente da fonte.\n');
  process.exit(0);
}

process.stdout.write(
  `\n::error::O site está desatualizado. A fonte publicou a posição de ${fonte} e o site ainda serve ${site.data}. ` +
    'Rode o workflow "Atualizar base do CAUC e publicar" pela aba Actions.\n'
);
process.exit(1);
