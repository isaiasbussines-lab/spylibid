#!/usr/bin/env node
// Spy Libid — gera HTML ESTÁTICO (sem JavaScript) a partir do template + JSON do relatório.
// Uso: node render_static.js template.html relatorio.json saida.html [--base ../]
// Precisa do pacote jsdom (npm i jsdom@24.1.1). --base prefixa os links do "Relatórios anteriores".
const fs = require('fs');
const path = require('path');
let JSDOM;
try { ({ JSDOM } = require('jsdom')); } catch (e) {
  console.error('Falta o jsdom: rode `npm i jsdom@24.1.1` nesta pasta.'); process.exit(1);
}
const [tplPath, jsonPath, outPath] = process.argv.slice(2);
const baseIdx = process.argv.indexOf('--base');
const base = baseIdx > 0 ? process.argv[baseIdx + 1] : '';
const D = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
if (base && Array.isArray(D.arquivo)) D.arquivo = D.arquivo.map((a) => ({ ...a, href: a.href ? base + a.href : a.href }));
const tpl = fs.readFileSync(tplPath, 'utf8');
const page = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
  '<meta name="robots" content="noindex,nofollow"><style>body{margin:0}</style></head><body>' +
  tpl.replace('__RADAR_DATA__', () => JSON.stringify(D).replace(/<\//g, '<\\/')) + '</body></html>';
const dom = new JSDOM(page, { runScripts: 'dangerously' });
const doc = dom.window.document;
if (!doc.querySelector('#app section')) { console.error('Render falhou: nenhuma seção gerada.'); process.exit(2); }
doc.querySelectorAll('script').forEach((s) => s.remove());
// título fixo legível no navegador
const t = doc.querySelector('title'); if (t) t.textContent = 'Spy Libid · ' + (D.data || '');
fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
fs.writeFileSync(outPath, '<!doctype html>\n' + doc.documentElement.outerHTML);
console.log('ok', outPath, fs.statSync(outPath).size, 'bytes');
