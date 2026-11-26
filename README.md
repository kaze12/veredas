# Veredas

Wiki pública do sistema Veredas — https://veredas-wiki.netlify.app

## Como funciona

- **`conteudo/`** é a pasta `aberto` do vault do Obsidian (`/taiwan_com/Offline/dropbox/Obsidian/veredas/aberto`, que aponta para cá).
  É o **único** lugar onde se escreve. Pode editar pelo Obsidian ou direto aqui no GitHub (inclusive pelo Claude).
- No computador, o timer `kz-veredas-sync` (a cada 5 min) faz commit do que mudou no Obsidian, puxa o que mudou no GitHub e envia.
  O Dropbox (bisync) leva as mudanças para os outros aparelhos.
- A cada push, o Netlify roda `npm run build`: `scripts/obsidian-para-docs.mjs` converte `conteudo/` → `docs/` (wikilinks, `![[imagens]]`, callouts) e o Docusaurus gera o site.
- `docs/` é gerada e não vai para o git — não edite.

## Regras das notas

- `publish: false` (ou `draft: true`) no frontmatter → a nota **não** é publicada.
- Links `[[Nota]]`, `[[Nota|texto]]`, `[[Nota#Seção]]` e `![[imagem.png]]` funcionam como no Obsidian.
- Uma nota `Início.md` (ou `index.md`/`Home.md`) na raiz vira a página inicial; sem ela, a inicial é gerada sozinha.
- Nomes de arquivo podem ter espaço e acento; o endereço da página é gerado sem eles.

## Testar localmente

```
npm install
npm start
```
