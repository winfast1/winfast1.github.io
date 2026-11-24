#!/bin/bash
# Uso: bash dev-tools/runshots.sh <pastaDoSite> <pastaDeSaida> <largura>
# Ex.: bash dev-tools/runshots.sh . /tmp/shots 1440   (use 1440, 768 e 390)
D="$(cd "$(dirname "$0")" && pwd)"; SITE="$(cd "$1" && pwd)"; O="$2"; W="$3"; mkdir -p "$O"; O="$(cd "$O" && pwd)"
node "$D/serve.js" "$SITE" "$D/assets" 8767 >/dev/null 2>&1 & SP=$!
sleep 1
node "$D/shot.js" "$W" "$O" "view:login-$W.png" audit
node "$D/shot.js" "$W" "$O" selector audit "save:selector-$W.png" generate audit "save:jogos-$W.png" \
  tab:temporada audit "save:temporada-$W.png" tab:longitudinal audit "save:longitudinal-$W.png" \
  tab:shotchart "eval:setSCView('region')" audit "save:heatmap-$W.png" tab:comparar audit "save:comparar-$W.png" \
  tab:quinteto audit "save:quinteto-$W.png" jogador:Mogi audit "save:jogador-$W.png"
kill $SP 2>/dev/null
