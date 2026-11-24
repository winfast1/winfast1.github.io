// Gera partidas fictícias com elenco, arremessos, log (pontos/trocas) para exercitar TODAS as abas.
window.__fake = function () {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const names = ['Mogi', 'Kuroba', 'Henricão', 'Bortoleto', 'Melão', 'Leozão', 'Tiago', 'Rafa', 'Dudu', 'Caio'];
  const advs = ['FEA Usp', 'Direito Puc', 'Teck Mack', 'Med Bragança', 'Poli Usp', 'Zumbi dos Palmares'];
  const dates = ['17/05/2026', '01/06/2026', '24/08/2026', '30/08/2026', '13/09/2026', '31/10/2026'];
  const comp = ['Paulista', 'Paulista', 'Amistoso', 'Paulista', 'Copa', 'Copa'];
  const games = advs.map((adv, gi) => {
    const players = names.map((n, i) => {
      const min = i < 5 ? 26 + Math.round(rnd() * 10) : 8 + Math.round(rnd() * 12);
      const fg2a = Math.round(2 + rnd() * 9 * (i < 5 ? 1 : .4)), fg3a = Math.round(rnd() * 6 * (i < 5 ? 1 : .4)), fta = Math.round(rnd() * 6);
      const fg2m = Math.round(fg2a * (.3 + rnd() * .35)), fg3m = Math.round(fg3a * (.15 + rnd() * .3)), ftm = Math.round(fta * (.5 + rnd() * .4));
      const shots = [];
      const push = (three, made) => {
        const right = rnd() > .5; const q = '1Q 2Q 3Q 4Q'.split(' ')[Math.floor(rnd() * 4)];
        let x, y;
        if (three) { const a = (rnd() - .5) * 2.4; x = right ? 94 - Math.cos(a) * 25 : 6 + Math.cos(a) * 25; y = 50 + Math.sin(a) * 40; }
        else { x = right ? 94 - rnd() * 18 : 6 + rnd() * 18; y = 28 + rnd() * 44; }
        const rem = Math.floor(rnd() * 600);
        shots.push({ q, time: String(Math.floor(rem / 60)).padStart(2, '0') + ':' + String(rem % 60).padStart(2, '0'), x: Math.max(3, Math.min(97, x)), y: Math.max(5, Math.min(95, y)), made, three, zone: three ? '3pts' : '2pts', assistedBy: made && rnd() > .5 ? names[Math.floor(rnd() * 5)] : '' });
      };
      for (let k = 0; k < fg2a; k++) push(false, k < fg2m);
      for (let k = 0; k < fg3a; k++) push(true, k < fg3m);
      const pts = fg2m * 2 + fg3m * 3 + ftm;
      return {
        name: '#' + (i + 4) + ' ' + n, number: String(i + 4), shots, pts, fg2a, fg2m, fg3a, fg3m, fta, ftm,
        reb: Math.round(rnd() * 8), oreb: Math.round(rnd() * 3), ast: Math.round(rnd() * 5), stl: Math.round(rnd() * 3), blk: Math.round(rnd() * 2),
        deflections: Math.round(rnd() * 4), to: Math.round(rnd() * 4), fouls: Math.round(rnd() * 4), foulsReceived: Math.round(rnd() * 4),
        plusMinus: Math.round((rnd() - .5) * 30), timeOnCourt: min * 60, timePerQuarter: [min * 15, min * 15, min * 15, min * 15], possessions: 30 + Math.round(rnd() * 30)
      };
    });
    const uspScore = players.reduce((a, p) => a + p.pts, 0);
    const advScore = Math.round(uspScore + (rnd() - .55) * 30);
    // log cronológico (guardado do fim para o início, como o site espera)
    const log = [];
    let us = 0, as = 0;
    for (let q = 0; q < 4; q++) {
      for (let e = 0; e < 14; e++) {
        const rem = 600 - Math.round((e + 1) * 600 / 15);
        const t = String(Math.floor(rem / 60)).padStart(2, '0') + ':' + String(rem % 60).padStart(2, '0');
        const mine = rnd() > .45, pts = rnd() > .7 ? 3 : 2;
        const p = names[Math.floor(rnd() * 5)];
        log.push({ q: (q + 1) + 'Q', time: t, team: mine ? 'Med Usp' : adv, player: '#4 ' + (mine ? p : 'Adv' + Math.floor(rnd() * 5)), action: 'Cesta ' + pts + 'pts', pts });
        if (mine) us += pts; else as += pts;
      }
      // trocas
      const t2 = '05:00';
      log.push({ q: (q + 1) + 'Q', time: t2, team: 'Med Usp', player: '#' + (4 + 1) + ' ' + names[1], action: '↕ Saiu → #' + (4 + 6) + ' ' + names[6], pts: 0 });
    }
    log.reverse();
    return {
      finished: true, date: dates[gi], gametype: comp[gi], competitionName: comp[gi], log,
      teams: [{ name: 'Med Usp', score: uspScore, players }, { name: adv, score: advScore, players: [] }]
    };
  });
  return games.map((g, i) => ({ name: 'Med Usp x ' + advs[i], created_at: '2026-0' + (i + 1) + '-01', gametype: comp[i], competitionName: comp[i], data: g }));
};

window.__enter = function () {
  const rows = __fake();
  document.getElementById('login-overlay').style.display = 'none';
  showGameSelector(rows, { user: { email: 'teste@winfast.com' } });
  return rows.length;
};
