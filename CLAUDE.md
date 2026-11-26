# Instruções para o Claude

- Edite conteúdo **somente em `conteudo/`**. É o vault do Obsidian do usuário; use sintaxe do Obsidian (`[[wikilinks]]`, `![[imagem]]`, callouts `> [!note]`).
- Não crie nem edite `docs/` (gerada no build). Não mude config do site sem o usuário pedir.
- Nomes de nota legíveis em português (com espaço/acento), não slugs.
- Notas que não devem ir para o site: `publish: false` no frontmatter.
- Antes de commitar mudanças estruturais, rode `npm run build` e confira que não há erro.
- Faça commits pequenos e pushes em `main`; o computador do usuário puxa a cada 5 min. Evite reescrever histórico (sem force-push).
