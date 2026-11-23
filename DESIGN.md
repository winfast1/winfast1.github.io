# DESIGN.md — Sistema visual da WinFast

Referência única para qualquer alteração visual do site de relatórios. Antes de mexer em cor,
tipografia, espaçamento ou componente: leia este arquivo; depois de mexer: atualize-o se a regra mudou.

> Cores: **somente** em `wf-tokens.css` (único arquivo com HEX). Todo o resto usa `var(--wf-*)`.
> Não há valores oficiais de marca: os tons abaixo foram amostrados do logotipo
> (laranja predominante `#F8A000`, brilho dourado `#FFB52E`, fundo `#000000`) e ajustados para contraste.

## 1. Princípios

1. **Dados primeiro.** A marca aparece na moldura (cabeçalho, ações, aba ativa); a leitura dos números nunca depende dela.
2. **Preto institucional, laranja de identidade.** Nem o site todo é preto, nem tudo é laranja.
3. **Conteúdo claro.** Fundo cinza-claro, cards brancos, texto quase preto.
4. **Cor com significado.** Verde/vermelho só para resultado estatístico; laranja/preto/cinza para tudo o mais.
5. **Minimalismo.** Sem bordas em cards, sem sombras decorativas, sem gradientes, sem badges ornamentais.

## 2. Cores (tokens)

| Token | Valor | Uso |
|---|---|---|
| `--wf-black` | `#000000` | Cabeçalho, navegação, login, chip/aba selecionado, textos de alto destaque |
| `--wf-ink-700` | `#1F1F1F` | Hover sobre preto |
| `--wf-orange-500` | `#F5A000` | **Identidade e ação principal**: botão primário (texto preto), aba ativa (sublinhado), avatar, foco sobre preto |
| `--wf-gold-400` | `#FFB52E` | Hover do botão laranja e detalhes pontuais |
| `--wf-orange-600` | `#C77700` | Laranja **para gráficos** sobre fundo claro (3,5:1): série "nossa equipe", barras |
| `--wf-orange-ink` | `#9A5B00` | Laranja **para texto** sobre fundo claro (5,4:1) |
| `--wf-court` | `#111111` | Quadra e painéis densos |
| `--wf-bg` / `--wf-card` | `#F4F4F2` / `#FFFFFF` | Fundo da página / cards |
| `--wf-subtle` / `--wf-divider` | `#EBEBE9` / `#E0E0DD` | Trilhos, chips, zebra / divisórias |
| `--wf-text` / `--wf-text-2` | `#111111` / `#595959` | Texto principal / rótulos e unidades |
| `--wf-on-dark` / `--wf-on-dark-2` | `#FFFFFF` / `#B8B8B8` | Texto sobre preto |
| `--wf-pos` / `--wf-neg` | `#1A7046` / `#B3261E` | Resultado positivo / negativo (texto) |
| `--wf-chart-pos` / `--wf-chart-neg` | `#2E9E6B` / `#D2553F` | Barras e marcas de gráfico positivas/negativas |
| `--wf-neutral` | `#666666` | Informação neutra |
| `--wf-team` / `--wf-opp` | laranja-600 / `#8C8C8C` | Séries: nossa equipe / adversário |
| `--wf-shot-made` / `--wf-shot-miss` | `#34B27A` / `#F0705A` | Acerto / erro **sobre a quadra escura** |
| `--wf-seq-1…5` | marrom → dourado claro | Heat Map (ver §6) |

### Regras de aplicação
- **Laranja `--wf-orange-500` nunca como cor de texto sobre fundo claro** (2,1:1). Texto laranja em fundo claro: `--wf-orange-ink`.
- Texto sobre laranja é **sempre preto** (9,9:1).
- Preto como superfície: cabeçalho/nav/login e estados *selecionado* de chips e pílulas.
- Laranja como superfície: **uma** ação principal por tela (Entrar, Gerar relatório, Comparar jogo), mais o avatar.
- Foco por teclado: contorno 2 px **preto** em superfícies claras e **laranja** sobre preto (`.wf-hdr`, `.gs-topbar`, `#login-overlay`, `.wfv-box`).

## 3. Tipografia

- **Barlow** 400/500/600/700 (texto e números) · **Barlow Condensed** 600/700 (números grandes e nomes).
- Escala: placar 64 px · títulos de seção 34/18 px · corpo 15 px · rótulos/metadados 13 px.
- Números sempre com `font-variant-numeric: tabular-nums` (já global no `body`).
- Sem caixa alta e sem espaçamento de letras decorativos (exceção: o *overline* do cabeçalho do jogo).
- Logotipo: sempre a **imagem** `img/winfast-logo.png` (PNG com fundo transparente, laranja/dourado).
  Usar apenas sobre fundo **preto**; nunca recolorir, esticar ou redesenhar. Altura: 28 px no cabeçalho, 44 px no login.

## 4. Layout, espaço e forma

- Contêiner máx. 1440 px, gutter 40 px (16 px no celular). Grade: coluna lateral 260 px + conteúdo.
- Espaçamento em múltiplos de 4/8 px; padding de card 28 px (`--wf-card-pad`); raio 12 px (cards) e 8 px (controles).
- **Cards:** fundo branco, sem borda, sem sombra. Separação por espaço e divisórias discretas.
- Sombra permitida apenas no menu suspenso de período.
- Alvos clicáveis ≥ 44 px; elementos clicáveis são `<button>`/`<a>` reais.

## 5. Hierarquia dos indicadores

1. **Principal** (placar, KPI): 34–64 px, peso 700, `--wf-text`.
2. **Secundário** (rótulos, unidades, datas): 13 px, `--wf-text-2`.
3. **Cor semântica só quando a direção é conhecida.** Mapa métrica → direção:
   - Maior é melhor: pontos, assistências, roubadas, rebotes, FG%, 3P%, LL%, TS%, eFG%, ORTG, Net RTG.
   - Menor é melhor: pontos sofridos, turnovers, TO%, DRTG, faltas cometidas.
   - Sem referência definida → **neutro** (preto/cinza). Não inventar faixas.
4. Referências existentes no código (ORTG, DRTG, Net, TS%, eFG%, zonas) permanecem como rótulo de texto ("forte", "bom"…).
5. Indicadores de variação usam ▲/▼ **além** da cor (nunca só cor).

## 6. Shot chart e Heat Map

- Quadra: meia quadra `--wf-court`, linhas `--wf-court-line`. Arremessos do lado esquerdo são espelhados para uma só meia quadra.
- Acerto = círculo `--wf-shot-made`; erro = ✕ `--wf-shot-miss` (forma **e** cor).
- Aro fino claro = vídeo disponível; tracejado = vínculo a conferir.
- Heat Map: escala sequencial de **um matiz** (laranja). Sobre a quadra escura, **mais claro = maior aproveitamento** (0 % → 60 %+). Hexágonos separados por contorno `--wf-court`.
- Lista de zonas ao lado: barra 4 px `--wf-team` + percentual; desvio vs. referência em `--wf-chart-pos/neg`.

## 7. Componentes

| Componente | Regra |
|---|---|
| Cabeçalho | Preto, logotipo à esquerda, registro e avatar à direita, abas abaixo; aba ativa = texto branco + sublinhado laranja 2 px |
| Botão primário | `--wf-orange-500`, texto preto 600, hover `--wf-gold-400`, 44 px |
| Botão secundário/texto | Sem preenchimento; texto `--wf-black` |
| Chip / pílula | Padrão `--wf-subtle`; selecionado preto com texto branco |
| Sub-abas | Texto `--wf-text-2`; ativa `--wf-black` + sublinhado laranja |
| Card | Branco, raio 12, padding 28, sem borda/sombra |
| Tabela | Cabeçalho 13 px `--wf-text-2`; zebra/hover `--wf-bg`; números alinhados à direita |
| Barra de percentual | Trilho `--wf-subtle` 8 px, preenchimento `--wf-team`; percentual em texto, nunca só barra |
| Gráfico de linhas | Nossa equipe `--wf-team`, adversário `--wf-opp`, eixos/linhas `--wf-divider`; rótulos de valor nos pontos |
| Modal de vídeo | Fundo `--wf-court`, cabeçalho `--wf-black`, botão primário laranja |

## 8. Acessibilidade e responsividade

- Contraste mínimo 4,5:1 (texto) e 3:1 (gráficos/estados). Validar com `scratchpad`/auditoria (ver `docs/FERRAMENTAS.md`).
- Sem rolagem horizontal em 390 px. Larguras de verificação: **1440×900, 768×1024, 390×844**.
- Funcionalidade nunca depende só de hover; tooltips têm equivalente textual.

## 9. Como usar este arquivo (fluxo para futuras mudanças)

1. **Diagnóstico** da tela atual (capturas "antes").
2. **Referência visual** (skills `design-taste-frontend`/`image-to-code` ou protótipo HTML) alinhada a este documento.
3. **Atualizar este arquivo** se uma regra mudar; cores novas entram primeiro em `wf-tokens.css`.
4. **Implementar** reaproveitando os componentes do §7.
5. **Auditar** com a skill `web-design-guidelines`.
6. **Testar no navegador** nas 3 resoluções, sem erros novos no console.
7. **Corrigir** diferenças e só então commitar.

Ver `docs/FERRAMENTAS.md` para instalação e uso das ferramentas.
