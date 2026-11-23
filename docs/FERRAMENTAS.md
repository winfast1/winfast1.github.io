# Ferramentas de desenvolvimento (não fazem parte do site publicado)

Nada aqui é dependência de produção: o site continua sendo HTML/JS estático (`index.html` + `video-*.js`).
As ferramentas ficam na máquina de desenvolvimento, **fora do repositório**.

| Ferramenta | Origem (commit verificado) | Onde está | Para que serve |
|---|---|---|---|
| `design-taste-frontend` (Taste Skill 2.5.1) | github.com/Leonxlnx/taste-skill (`6c0b5c7`) | `~/.claude/skills/design-taste-frontend` | Direção visual, hierarquia, composição |
| `web-design-guidelines` 1.1.0 | github.com/vercel-labs/agent-skills (`5a37a63`) | `~/.claude/skills/web-design-guidelines` | Auditoria de acessibilidade/UX do código |
| `image-to-code` | github.com/Leonxlnx/imagegen-skills (`beb16b0`) | `~/.claude/skills/image-to-code` | Referência visual antes de implementar |
| Awesome DESIGN.md | github.com/VoltAgent/awesome-design-md (`fcc7028`) | `~/.claude/design-refs/awesome-design-md` | Biblioteca de referências (consulta; não é skill) |
| Playwright CLI | npm `@playwright/cli` (repo `microsoft/playwright-cli`) | **não instalado** — ver abaixo | Navegar/testar o site no navegador |

## Como foram instalados
As skills foram copiadas (não linkadas) das pastas `skills/<nome>` de cada repositório para `~/.claude/skills/`.
O checksum de `web-design-guidelines/references/command.md` confere com o SHA-256 declarado pela skill
(`d246b026…`, após normalizar CRLF). Para atualizar: clonar de novo o repositório, comparar e recopiar a pasta.

**Atenção ao Taste Skill:** ele é voltado a sites institucionais/landing pages e traz um hook `Stop` que roda
`gate.mjs` quando a skill está ativa. Para esta plataforma de análise esportiva use-o só como apoio de
composição e tipografia, sempre subordinado ao `DESIGN.md` (que manda em caso de conflito).

## Playwright CLI — pendência de instalação
`npm install -g @playwright/cli@latest` falha neste computador com `SELF_SIGNED_CERT_IN_CHAIN`
(rede com inspeção TLS). Não se deve desativar a verificação de certificado. Opções:
1. Informar ao Node o certificado raiz da rede: `setx NODE_EXTRA_CA_CERTS "C:\caminho\raiz-corporativa.pem"` e reabrir o terminal; ou
2. rodar o `npm install` em uma rede sem inspeção TLS.
Depois: `playwright-cli --help` e `playwright-cli install --skills`.

Enquanto isso, os testes usam Chrome headless via protocolo CDP (mesmo navegador, mesma ideia): abrir página,
navegar entre abas, capturar telas, medir contraste/alvos/rolagem e ler erros do console.

## Fluxo de uso (resumo; detalhes no `DESIGN.md` §9)
1. Diagnóstico → 2. Referência visual → 3. Atualizar `DESIGN.md`/`wf-tokens.css` → 4. Implementar →
5. Auditar (`web-design-guidelines`) → 6. Testar em 1440×900, 768×1024 e 390×844 → 7. Corrigir → commit.

## Observação sobre a publicação
O GitHub Pages publica toda a raiz do repositório. `DESIGN.md`, `docs/` e `img/` ficam acessíveis publicamente
(sem dados sensíveis). Nunca colocar segredos, dumps de dados ou as pastas das ferramentas dentro do repositório.
