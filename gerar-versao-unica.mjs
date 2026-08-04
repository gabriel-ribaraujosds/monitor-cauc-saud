/**
 * Gera `monitor-cauc-saude.html`: um único arquivo com o site e a base embutida,
 * útil para publicar em qualquer hospedagem estática ou enviar por e-mail.
 *
 *   node gerar-versao-unica.mjs
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));

let html = await fs.readFile(path.join(RAIZ, 'index.html'), 'utf8');
const dados = await fs.readFile(path.join(RAIZ, 'dados-cauc.js'), 'utf8');

const marcador = '<script src="dados-cauc.js"></script>';
if (!html.includes(marcador)) throw new Error('Referência a dados-cauc.js não encontrada no index.html.');

// O ícone também precisa viajar dentro do arquivo: a versão única costuma ser
// aberta solta, sem os PNGs ao lado.
const icone = await fs.readFile(path.join(RAIZ, 'favicon-32.png'));
const antesDoIcone = html;
html = html
  .replace(/\s*<link rel="apple-touch-icon"[^>]*>/i, '')
  .replace(/\s*<link rel="icon"[^>]*192x192[^>]*>/i, '')
  .replace(
    /<link rel="icon"[^>]*32x32[^>]*>/i,
    `<link rel="icon" type="image/png" href="data:image/png;base64,${icone.toString('base64')}" />`
  );
if (html === antesDoIcone) throw new Error('Links de ícone não encontrados no index.html.');

// `</script>` dentro do JSON encerraria a tag antes da hora.
const embutido = '<script>\n' + dados.replace(/<\/script>/gi, '<\\/script>') + '</script>';

const saida = path.join(RAIZ, 'monitor-cauc-saude.html');
await fs.writeFile(saida, html.replace(marcador, embutido), 'utf8');

const kb = Math.round((await fs.stat(saida)).size / 1024);
process.stdout.write(`OK: ${saida} (${kb} KB)\n`);
