#!/usr/bin/env node
// Converte as notas do Obsidian (conteudo/) em páginas do Docusaurus (docs/).
// Roda sozinho antes de cada build (npm run build / Netlify).
// NUNCA altera conteudo/: só lê de lá e escreve em docs/ (que é descartável).
//
// Trata: [[wikilinks]], [[nota|apelido]], [[nota#seção]], ![[imagem.png]],
// ![[nota]] (vira link), callouts > [!note], comentários %% %%,
// notas com publish: false (ficam de fora) e nomes com espaço/acento.

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ORIGEM = path.join(RAIZ, 'conteudo');
const DESTINO = path.join(RAIZ, 'docs');
const IGNORAR = new Set(['.obsidian', '.trash', '.git', 'node_modules']);
const NOMES_INICIO = ['index', 'inicio', 'início', 'home', 'leia-me', 'readme'];

const nfc = (s) => s.normalize('NFC');
const chave = (s) => nfc(s).toLowerCase();

function slugify(s) {
  return nfc(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'pagina';
}
const ancora = (t) => slugify(t.replace(/\./g, ' ')).replace(/\./g, '');

// ---------- 1. inventário ----------
const arquivos = []; // {orig, rel, saida, md, nome}
function varrer(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
    if (e.name.startsWith('.') || IGNORAR.has(e.name)) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) { varrer(abs); continue; }
    if (!e.isFile()) continue;
    const rel = path.relative(ORIGEM, abs);
    const ext = path.extname(e.name);
    const md = ext.toLowerCase() === '.md';
    const partes = rel.split(path.sep);
    const base = partes.pop();
    const saidaBase = md
      ? slugify(path.basename(base, ext)) + '.md'
      : slugify(path.basename(base, ext)) + ext.toLowerCase();
    const saida = path.join(...partes.map(slugify), saidaBase);
    arquivos.push({orig: abs, rel, saida, md, nome: path.basename(base, md ? ext : '')});
  }
}
varrer(ORIGEM);

// lê frontmatter das notas e descarta as não publicáveis
const ocultas = new Set();
for (const a of arquivos) {
  if (!a.md) continue;
  const bruto = fs.readFileSync(a.orig, 'utf8');
  let fm;
  try { fm = matter(bruto); } catch { fm = {data: {}, content: bruto}; }
  a.fm = fm.data || {};
  a.corpo = fm.content;
  const pub = a.fm.publish ?? a.fm.publicar;
  if (pub === false || String(pub).toLowerCase() === 'false' || a.fm.draft === true || a.fm.rascunho === true) {
    ocultas.add(a);
  }
}
const publicos = arquivos.filter((a) => !ocultas.has(a));

// índices para resolver links: por nome (estilo Obsidian) e por caminho
const porNome = new Map();
const porCaminho = new Map();
for (const a of publicos) {
  const k = chave(a.nome);
  if (!porNome.has(k)) porNome.set(k, a);
  porCaminho.set(chave(a.rel), a);
  if (a.md) porCaminho.set(chave(a.rel.slice(0, -3)), a);
}
for (const a of publicos) {
  for (const al of [].concat(a.fm?.aliases || [])) {
    if (typeof al === 'string' && !porNome.has(chave(al))) porNome.set(chave(al), a);
  }
}

function resolver(alvo, de) {
  alvo = nfc(alvo.trim());
  if (!alvo) return de;
  const semMd = alvo.replace(/\.md$/i, '');
  const relDir = path.dirname(de.rel);
  return (
    porCaminho.get(chave(path.normalize(path.join(relDir, alvo)))) ||
    porCaminho.get(chave(path.normalize(path.join(relDir, semMd)))) ||
    porCaminho.get(chave(alvo)) ||
    porCaminho.get(chave(semMd)) ||
    porNome.get(chave(path.basename(semMd))) ||
    porNome.get(chave(path.basename(alvo)))
  );
}

function linkRel(de, para) {
  let r = path.relative(path.dirname(de.saida), para.saida).split(path.sep).join('/');
  if (!r.startsWith('.')) r = './' + r;
  return r;
}

const IMG = /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i;

// ---------- 2. conversão do texto ----------
function converterTexto(texto, a, avisos) {
  // separa blocos de código para não mexer neles
  const pedacos = texto.split(/(^(?:```|~~~)[^\n]*\n[\s\S]*?^(?:```|~~~)[ \t]*$)/m);
  return pedacos.map((p, i) => (i % 2 ? p : converterTrecho(p, a, avisos))).join('');
}

function converterTrecho(t, a, avisos) {
  t = t.replace(/%%[\s\S]*?%%/g, ''); // comentários do Obsidian

  // links markdown comuns para notas/arquivos locais: [x](Nota%20Tal.md)
  t = t.replace(/(!?)\[([^\]]*)\]\(<?([^)<>]+?)>?\)/g, (m, ex, txt, url) => {
    if (/^[a-z]+:|^#|^\//i.test(url)) return m;
    const [alvo, hash] = url.split('#');
    let dec; try { dec = decodeURIComponent(alvo); } catch { dec = alvo; }
    const dest = resolver(dec, a);
    if (!dest) { avisos.push(`link não encontrado: ${dec}`); return ex ? '' : txt; }
    return `${ex}[${txt}](${linkRel(a, dest)}${hash ? '#' + ancora(hash) : ''})`;
  });

  // embeds ![[...]]
  t = t.replace(/!\[\[([^\]|#]+)(#[^\]|]*)?(?:\|([^\]]*))?\]\]/g, (m, alvo, sec, extra) => {
    const dest = resolver(alvo, a);
    if (!dest) { avisos.push(`embed não encontrado: ${alvo}`); return ''; }
    if (!dest.md) {
      const alt = extra && !/^\d+(x\d+)?$/.test(extra) ? extra : dest.nome;
      return IMG.test(dest.saida) ? `![${alt}](${linkRel(a, dest)})` : `[${alt}](${linkRel(a, dest)})`;
    }
    return `[${extra || dest.fm?.title || dest.nome}](${linkRel(a, dest)}${sec ? '#' + ancora(sec.slice(1)) : ''})`;
  });

  // wikilinks [[...]]
  t = t.replace(/\[\[([^\]|#]*)(#[^\]|]*)?(?:\|([^\]]*))?\]\]/g, (m, alvo, sec, apelido) => {
    const secTxt = sec ? sec.slice(1).replace(/^\^/, '') : '';
    const texto = apelido || (alvo ? alvo.split('/').pop() : secTxt) + (alvo && secTxt ? ` › ${secTxt}` : '');
    const dest = alvo ? resolver(alvo, a) : a;
    if (!dest) { avisos.push(`link para nota inexistente/privada: ${alvo}`); return texto; }
    const href = (dest === a && !alvo ? '' : linkRel(a, dest)) + (secTxt ? '#' + ancora(secTxt) : '');
    return `[${texto}](${href || '#'})`;
  });

  // callouts > [!tipo] título  ->  :::tipo[título]
  const mapa = {note: 'note', info: 'info', tip: 'tip', hint: 'tip', important: 'tip', success: 'tip',
    warning: 'warning', caution: 'warning', attention: 'warning', danger: 'danger', error: 'danger',
    bug: 'danger', failure: 'danger'};
  const linhas = t.split('\n');
  const out = [];
  for (let i = 0; i < linhas.length; i++) {
    const m = linhas[i].match(/^>\s*\[!(\w+)\][+-]?\s*(.*)$/);
    if (!m) { out.push(linhas[i]); continue; }
    const tipo = mapa[m[1].toLowerCase()] || 'note';
    out.push('', m[2] ? `:::${tipo}[${m[2]}]` : `:::${tipo}`, '');
    while (i + 1 < linhas.length && /^>/.test(linhas[i + 1])) out.push(linhas[++i].replace(/^>\s?/, ''));
    out.push('', ':::', '');
  }
  return out.join('\n');
}

// ---------- 3. escrita ----------
fs.rmSync(DESTINO, {recursive: true, force: true});
fs.mkdirSync(DESTINO, {recursive: true});

// rótulos das pastas com o nome original (com acento/espaço)
const pastas = new Map();
for (const a of publicos.filter((x) => x.md)) {
  const partes = a.rel.split(path.sep).slice(0, -1);
  for (let i = 1; i <= partes.length; i++) {
    pastas.set(path.join(...partes.slice(0, i).map(slugify)), partes[i - 1]);
  }
}
for (const [saida, rotulo] of pastas) {
  fs.mkdirSync(path.join(DESTINO, saida), {recursive: true});
  fs.writeFileSync(path.join(DESTINO, saida, '_category_.json'),
    JSON.stringify({label: rotulo, link: {type: 'generated-index', slug: '/' + saida.split(path.sep).join('/')}}, null, 2));
}

let temInicio = false;
const avisosGerais = [];
for (const a of publicos) {
  const alvo = path.join(DESTINO, a.saida);
  fs.mkdirSync(path.dirname(alvo), {recursive: true});
  if (!a.md) { fs.copyFileSync(a.orig, alvo); continue; }

  const avisos = [];
  const corpo = converterTexto(a.corpo, a, avisos);
  const fm = {};
  // só repassa campos que o Docusaurus entende; o resto do frontmatter do Obsidian é ignorado
  for (const k of ['title', 'description', 'sidebar_label', 'sidebar_position', 'slug', 'keywords', 'hide_table_of_contents']) {
    if (a.fm[k] !== undefined) fm[k] = a.fm[k];
  }
  const tags = [].concat(a.fm.tags || []).filter((x) => typeof x === 'string' && x.trim());
  if (tags.length) fm.tags = tags.map((x) => x.replace(/^#/, ''));
  if (!fm.title && !/^\s*#\s+\S/.test(corpo)) fm.title = a.nome;
  if (!fm.sidebar_label) fm.sidebar_label = a.nome;
  if (!temInicio && !a.rel.includes(path.sep) && NOMES_INICIO.includes(chave(a.nome))) {
    fm.slug = '/'; temInicio = true;
  }
  fs.writeFileSync(alvo, matter.stringify(corpo, fm));
  for (const av of avisos) avisosGerais.push(`${a.rel}: ${av}`);
}

if (!temInicio) {
  const topo = publicos.filter((a) => a.md && !a.rel.includes(path.sep));
  const lista = topo.map((a) => `- [${a.fm.title || a.nome}](./${a.saida})`).join('\n');
  const pastasTopo = [...pastas].filter(([s]) => !s.includes(path.sep))
    .map(([s, r]) => `- [${r}](/${s.split(path.sep).join('/')})`).join('\n');
  fs.writeFileSync(path.join(DESTINO, 'index.md'), matter.stringify(
    `# Veredas\n\n${[lista, pastasTopo].filter(Boolean).join('\n') || '_Ainda não há páginas publicadas._'}\n`,
    {slug: '/', sidebar_position: 0, sidebar_label: 'Início', hide_table_of_contents: true}));
}

console.log(`[veredas] ${publicos.filter((a) => a.md).length} nota(s) publicada(s), ` +
  `${ocultas.size} oculta(s), ${publicos.filter((a) => !a.md).length} anexo(s).`);
for (const av of avisosGerais) console.log(`[veredas] aviso: ${av}`);
