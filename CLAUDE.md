# WinFast — instruções para o Claude Code

Site estático de relatórios de basquete (`index.html` com JS puro, Supabase para login/dados, `video-*.js` para vídeos dos arremessos). Publicado pelo GitHub Pages a partir da `main`.

## Regras de trabalho
- **Visual:** siga `DESIGN.md`. Cores só em `wf-tokens.css`; no restante use `var(--wf-*)`. Sem gradientes, sombras decorativas ou bordas em cards.
- **Funcionalidade:** não altere cálculos estatísticos, dados, lógica dos gráficos, autenticação, filtros, rotas nem o vínculo vídeo ↔ arremesso. Redesign mexe em marcação e estilo.
- **Validação:** não dê uma mudança visual por concluída sem abrir no navegador em 1440×900, 768×1024 e 390×844, sem erros novos no console. Os testes de vídeo rodam com `node tests/video-match.test.js` e `node tests/video-local.test.js`.
- **Commits:** em português, um por etapa; só commitar/enviar quando o usuário pedir.
- **Ferramentas de design/QA:** ver `docs/FERRAMENTAS.md` (ficam fora do repositório).
- Erro de console já existente (não introduzido por redesign): `renderPL` lê `#lp-sel` inexistente (código legado).
