# dev-tools — testes visuais no navegador (só desenvolvimento)

Não fazem parte do site: nada em `index.html` depende destes arquivos.
Requisitos: Node 20+ e Google Chrome (ou defina `CHROME_PATH`).

- `serve.js` — servidor estático (`/` = site, `/assets/` = esta pasta `assets/`, com suporte a Range).
- `shot.js` — controla o Chrome headless via CDP. Ações: `selector` (carrega dados fictícios e entra), `generate`,
  `tab:<id>`, `jogador:<nome>`, `eval:<js>`, `save:<arq>` (página inteira), `view:<arq>`, `audit`, `tab_key:<n>`, `wait:<ms>`.
  Ao final imprime erros de JavaScript da página.
- `assets/fake-data.js` — 6 partidas fictícias com elenco e arremessos (nenhum dado real).
- `assets/audit.js` — mede contraste, alvos < 44 px, elementos sem nome acessível e rolagem horizontal.
- `runshots.sh` — varredura completa de todas as abas: `bash dev-tools/runshots.sh . saida 1440` (repita com 768 e 390).

Resultado esperado hoje: `AUDIT → {"contrast":[],"small":[],"noname":[],"hscroll":false}` em todas as telas.
Erro de console conhecido (legado, não introduzido pelo redesign): `renderPL` lê `#lp-sel` inexistente.
