# Vídeos dos arremessos nos Heat Maps

Na aba **Jogador**, cada ponto do mapa de arremessos que tem clipe ganha um contorno branco; clicar abre um pop-up com o vídeo (play/pause, volume, tela cheia, fechar).

## Como o site acessa os vídeos (sem Azure, sem login, sem link público)

Os clipes ficam na pasta do OneDrive **sincronizada no computador** (ex.: `...\Área de Trabalho\BASQUETE`). Na aba Jogador, clique em **Selecionar pasta de vídeos** e escolha essa pasta raiz. O navegador (Chrome ou Edge no desktop) passa a ler a pasta em modo **somente leitura**; o vídeo toca direto do disco, via `blob:` local.

- Nenhum vídeo, caminho ou dado sai do computador; nada vai para o GitHub.
- Só vê os vídeos quem tem a pasta sincronizada no PC — ou seja, quem tem acesso no OneDrive. Para liberar alguém, compartilhe a pasta com a pessoa e ela a sincroniza ("Adicionar atalho ao meu OneDrive" / Sincronizar).
- A pasta escolhida fica lembrada no navegador; em cada nova sessão o Chrome pede um clique em **Reconectar pasta de vídeos**.
- Se os arquivos estiverem "somente online" (Files On-Demand), o OneDrive baixa o clipe ao abrir; o primeiro clique pode demorar alguns segundos.
- Firefox e Safari não oferecem essa API: o painel avisa para usar Chrome/Edge.

## Estrutura esperada

```
BASQUETE/                              ← pasta escolhida no site
  MEDUSP/
    MED USP_VS_ZUMBI DOS PALMARES/     ← mesmo nome da partida cadastrada no site
      Arremesso Convertido/Arremesso Convertido #01 - Q2 02m19s - Mogi.mp4
      Arremesso Errado/Arremesso Errado #01 - Q1 00m45s - Leozão.mp4
      Relatorio/dados_eventos.csv      ← log do app de timeline (recomendado)
```

- A pasta da partida é procurada até 3 níveis abaixo da raiz, ignorando maiúsculas, acentos, pontuação e os separadores `vs`/`x` (`MED USP_VS_ZUMBI DOS PALMARES` ≡ `Med Usp x Zumbi dos Palmares`). Pasta ausente ou repetida em dois lugares: nada é vinculado e o relatório mostra o nome esperado.
- **Os clipes precisam estar extraídos.** Hoje a pasta `MED USP_VS_ZUMBI DOS PALMARES` só tem `.zip`; o site não lê vídeo de dentro de zip (o relatório avisa quando encontra só zips).
- Dois exports do mesmo jogo na mesma pasta (ex.: `1quarto` e `1 e 2 quarto`) geram clipes repetidos: extraia apenas o export mais completo.

## Como a associação funciona (automática, sem vínculo manual)

Para cada partida, ao desenhar o mapa com a pasta conectada:

1. Acha a pasta da partida, lista os clipes e cruza com `Relatorio/dados_eventos.csv`.
2. Agrupa por **quarto + atleta + resultado** (convertido/errado). Arremessos do log (ordem cronológica) e clipes (ordem do relógio do vídeo) são pareados 1:1 **somente se as contagens forem iguais**.
3. Confere a sequência: a ordem dos arremessos de todos os atletas no quarto deve coincidir com a ordem dos relógios de vídeo; se não, o ponto fica "conferir" (contorno tracejado âmbar).

O que **não** é vinculado, e aparece em **Relatório de vínculos**:

| Situação | Efeito |
|---|---|
| Log e pasta com quantidades diferentes no grupo (clipe faltando ou sobrando) | grupo inteiro sem vínculo |
| Clipe listado no CSV sem arquivo / arquivo sem linha no CSV | aviso |
| Clipe duplicado (mesmo atleta, quarto, tempo, resultado) | grupo bloqueado |
| Nome do arquivo diverge do CSV, ou status ≠ `READY` | clipe bloqueado |
| Atleta do clipe não existe no elenco do log, ou é ambíguo | sem vínculo + pedido de alias |
| Número repetido (ex.: dois `Errado #09`) ou lacuna (`#07`) | aviso (o pareamento não usa o número) |
| Pasta ausente / ambígua; quarto sem clipes; só `.zip` | "sem vídeo" com a explicação no clique |

Apelidos diferentes entre o app de timeline e o site (ex.: `Leozão` × `Leonardo S.`) vão em `athleteAliases` de `video-config.js`. Primeiro nome único (`Mogi` → `Mogi Silva`) resolve sozinho.

## Testes

```
node --test tests/video-match.test.js tests/video-local.test.js
```

Usam o `dados_eventos.csv` e os nomes de arquivo reais do jogo Med USP × Zumbi dos Palmares (inclui o `#09` duplicado e a lacuna `#07` que já existem nesses dados) e um sistema de arquivos simulado com a estrutura `BASQUETE/MEDUSP/<partida>`.
