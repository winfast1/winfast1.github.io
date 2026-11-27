# DESIGN.md — Identidade visual da WinFast (layout publicado)

Este branch mantém **a estrutura e as proporções do layout publicado** e aplica só a identidade preto/laranja.
Regra principal: mudança visual = mudar **valores de cor**, nunca medidas, colunas, posições ou espaçamentos.

## Onde ficam as cores
Todas as cores vivem no bloco `:root` no topo de `index.html`. O CSS e o JS usam apenas `var(--…)`.
Os nomes antigos foram mantidos para não tocar no CSS/JS que os usa:

| Variável | Papel | Valor |
|---|---|---|
| `--green-*` | escala de pretos (institucional: cabeçalho, botões selecionados, títulos) | `#000000` … `#3A3A3A`, claros `#EBEBE9`/`#F4F4F2` |
| `--navy-*` | quadra e cinzas | quadra `--navy-900 #111111`; adversário `--navy-700 #6B6B6B` |
| `--amber-500` | **laranja da marca** (`--accent`): destaques, aba ativa, aro/tabela da cesta | `#F5A000` |
| `--amber-600` | laranja para gráficos sobre fundo claro (`--team`, série da nossa equipe) | `#C77700` |
| `--amber-700` | laranja para **texto** sobre fundo claro (`--accent-ink`) | `#9A5B00` |
| `--gold-400` | dourado complementar | `#FFB52E` |
| `--paper/--surface/--card` | fundos claros | `#F4F4F2` / `#FAFAF9` / `#FFFFFF` |
| `--ink/--text/--muted` | textos | `#111111` / `#1A1A1A` / `#595959` |
| `--pos*` / `--neg*` | verde = resultado positivo · vermelho = negativo | inalterados |
| `--seq-1…5` | Heat Map (aproveitamento) | `#4A3510` → `#FFD27A` |

- Laranja `#F5A000` não é usado como cor de texto sobre fundo claro (contraste 2,1:1): use `--accent-ink`.
- Verde/vermelho apenas para indicadores com direção conhecida (mais pontos = bom; mais turnovers = ruim).

## Mapa de arremessos por região (Heat Map)
- Quadra **completa** (duas metades, duas cestas); cada arremesso na coordenada registrada (`X_pct`/`Y_pct` sobre 600×320), sem espelhar nem duplicar.
- **Cor = aproveitamento**, 5 faixas laranja (mais claro = melhor): 0–7%, 8–22%, 23–37%, 38–52%, 53%+.
- **Tamanho = nº de arremessos**: área do hexágono proporcional à contagem; opacidade fixa.
- Legenda **sem fundo próprio** (fundo claro do card), com as duas escalas separadas; os tamanhos de exemplo
  são calculados dos dados filtrados (1, ~15%, ~50% e o máximo — ex.: 1, 7, 22, 44).

## Validação obrigatória
Comparar antes × depois em 1440, 1024, 768 e 390 px, medindo as caixas dos cards/colunas (devem ser iguais),
conferindo que o número de marcadores e a soma dos hexágonos batem com o total de arremessos, e sem erros novos no console.
