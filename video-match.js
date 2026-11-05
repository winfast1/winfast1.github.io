/* WinFast · associação automática arremesso ⇄ vídeo
 *
 * Lógica pura (sem DOM, sem rede): roda no navegador (window.WFVideoMatch) e no Node (testes).
 *
 * Princípio: só vincula quando o log e os clipes concordam. Qualquer dúvida
 * (contagem diferente, atleta desconhecido, número duplicado, ordem incoerente)
 * vira um status explícito em vez de um vínculo possivelmente errado.
 *
 * Chave de agrupamento: quarto + atleta + resultado (convertido/errado).
 * Dentro de cada grupo os arremessos (ordem cronológica do log) são pareados com os
 * clipes (ordem cronológica do vídeo) 1:1 — só se as contagens forem idênticas.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WFVideoMatch = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VIDEO_EXT = /\.(mp4|m4v|mov|webm)$/i;
  var CLIP_RE = /^Arremesso\s+(Convertido|Errado)\s+#(\d+)\s*-\s*([A-Za-z]+\d*)\s+(\d+)m(\d+)s\s*-\s*(.+?)\.(mp4|m4v|mov|webm)$/i;

  var STATUS = {
    OK: 'ok', CHECK: 'check', MISSING: 'missing', MISMATCH: 'mismatch',
    UNRESOLVED: 'unresolved-athlete', DUPLICATE: 'duplicate', CONFLICT: 'conflict',
    NO_CLIPS: 'no-clips', NO_FOLDER: 'no-folder'
  };

  function norm(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  // Nome de partida/pasta: ignora separadores "vs", "x", "contra" (MED USP_VS_ZUMBI ≡ Med Usp x Zumbi).
  function gameKey(s) {
    var drop = { vs: 1, x: 1, v: 1, versus: 1, contra: 1 };
    return norm(s).split(' ').filter(function (t) { return t && !drop[t]; }).join(' ');
  }

  function normQuarter(q) {
    var s = String(q == null ? '' : q).trim().toUpperCase();
    var m = s.match(/^(\d)\s*Q$/) || s.match(/^Q\s*(\d)$/);
    return m ? 'Q' + m[1] : s;
  }

  function isVideoFile(name) { return VIDEO_EXT.test(name || ''); }

  function parseClipName(fileName) {
    var m = String(fileName || '').match(CLIP_RE);
    if (!m) return null;
    return {
      made: m[1].toLowerCase() === 'convertido',
      num: parseInt(m[2], 10),
      q: normQuarter(m[3]),
      clockSec: parseInt(m[4], 10) * 60 + parseInt(m[5], 10),
      clock: m[4] + 'm' + m[5] + 's',
      athlete: m[6].trim()
    };
  }

  // CSV com ';' (ou ','), campos entre aspas, BOM e aspas escapadas ("").
  function parseCsv(text) {
    text = String(text || '').replace(/^﻿/, '');
    var first = text.split(/\r?\n/, 1)[0] || '';
    var delim = (first.split(';').length >= first.split(',').length) ? ';' : ',';
    var rows = [], row = [], cur = '', inQ = false, i, ch;
    for (i = 0; i < text.length; i++) {
      ch = text[i];
      if (inQ) {
        if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
        else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === delim) { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (ch !== '\r') cur += ch;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    if (!rows.length) return [];
    var head = rows[0].map(function (h) { return h.trim(); });
    return rows.slice(1).filter(function (r) { return r.some(function (c) { return c !== ''; }); })
      .map(function (r) { var o = {}; head.forEach(function (h, k) { o[h] = (r[k] || '').trim(); }); return o; });
  }

  function baseName(p) { return String(p || '').split(/[\\/]/).pop(); }

  /* Monta o conjunto de clipes de uma partida.
   * files:   [{id, name, ...}]  — vídeos encontrados nas pastas da partida
   * csvRows: linhas de dados_eventos.csv (opcional) — o "log" gravado pelo app de timeline */
  function buildClipSet(files, csvRows) {
    var issues = [], clips = [];
    (files || []).forEach(function (f) {
      if (!isVideoFile(f.name)) return;
      var p = parseClipName(f.name);
      if (!p) { issues.push({ level: 'warn', type: 'unparsed-file', file: f.name, message: 'Arquivo de vídeo fora do padrão de nome: ' + f.name }); return; }
      p.file = f; p.fileName = f.name; p.flag = null;
      clips.push(p);
    });

    // Duplicidades
    function dupGroups(keyFn) {
      var g = {};
      clips.forEach(function (c) { var k = keyFn(c); (g[k] = g[k] || []).push(c); });
      return Object.keys(g).filter(function (k) { return g[k].length > 1; }).map(function (k) { return g[k]; });
    }
    // Número repetido com atleta/tempo distintos = numeração do app colidiu; o pareamento não usa o número, então só avisa.
    dupGroups(function (c) { return c.made + ':' + c.num; }).forEach(function (grp) {
      issues.push({ level: 'warn', type: 'duplicate-number', message: 'Número repetido (' + (grp[0].made ? 'Convertido' : 'Errado') + ' #' + pad(grp[0].num) + ') em clipes diferentes: ' + grp.map(function (c) { return c.fileName; }).join(' | ') });
    });
    dupGroups(function (c) { return [c.made, c.q, c.clockSec, norm(c.athlete)].join(':'); }).forEach(function (grp) {
      if (grp.every(function (c) { return c.flag === STATUS.DUPLICATE; })) return;
      grp.forEach(function (c) { c.flag = STATUS.DUPLICATE; });
      issues.push({ level: 'error', type: 'duplicate-clip', message: 'Clipes duplicados (mesmo atleta, quarto, tempo e resultado): ' + grp.map(function (c) { return c.fileName; }).join(' | ') });
    });

    // Cruzamento com o log do app de timeline (dados_eventos.csv)
    if (csvRows) {
      var byName = {}, byId = {}, seenClip = {};
      clips.forEach(function (c) {
        byName[c.fileName] = c;
        var id = [c.made, c.num, c.q, norm(c.athlete)].join(':');
        (byId[id] = byId[id] || []).push(c);
      });
      csvRows.forEach(function (r) {
        var made = /convertido/i.test(r.categoria || '');
        var num = parseInt(r.numero, 10);
        var label = (made ? 'Convertido' : 'Errado') + ' #' + pad(num);
        var c = (r.clipe && byName[baseName(r.clipe)]) || (byId[[made, num, normQuarter(r.periodo), norm(r.atleta)].join(':')] || [])[0];
        if (!c) {
          issues.push({ level: 'error', type: 'csv-missing-file', message: 'Listado no log mas sem arquivo de vídeo: ' + label + ' (' + (r.periodo || '?') + ' ' + (r.relogio_jogo || '?') + ' · ' + (r.atleta || '?') + ')' });
          return;
        }
        seenClip[c.fileName] = true;
        if (r.status && r.status.toUpperCase() !== 'READY') {
          c.flag = c.flag || STATUS.CONFLICT;
          issues.push({ level: 'error', type: 'csv-not-ready', message: 'Clipe ainda não finalizado no log (status ' + r.status + '): ' + c.fileName });
        }
        var sameAthlete = norm(r.atleta) === norm(c.athlete);
        var sameQ = normQuarter(r.periodo) === c.q;
        var sameClock = !r.relogio_jogo || r.relogio_jogo === c.clock;
        if (!sameAthlete || !sameQ || !sameClock) {
          c.flag = c.flag || STATUS.CONFLICT;
          issues.push({ level: 'error', type: 'csv-mismatch', message: 'Nome do arquivo diverge do log (' + label + '): arquivo "' + c.athlete + ' ' + c.q + ' ' + c.clock + '" × log "' + (r.atleta || '?') + ' ' + (r.periodo || '?') + ' ' + (r.relogio_jogo || '?') + '"' });
        }
        if (r.clipe && baseName(r.clipe) !== c.fileName) {
          issues.push({ level: 'warn', type: 'csv-name-differs', message: 'Nome do arquivo difere do registrado no log: ' + c.fileName + ' × ' + baseName(r.clipe) });
        }
      });
      clips.forEach(function (c) {
        if (!seenClip[c.fileName]) issues.push({ level: 'warn', type: 'file-not-in-log', message: 'Arquivo sem registro no log (dados_eventos.csv): ' + c.fileName });
      });
    }

    // Lacunas de numeração (provável clipe apagado/não exportado)
    [true, false].forEach(function (made) {
      var nums = clips.filter(function (c) { return c.made === made; }).map(function (c) { return c.num; });
      if (csvRows) csvRows.forEach(function (r) { if (/convertido/i.test(r.categoria || '') === made) nums.push(parseInt(r.numero, 10)); });
      if (!nums.length) return;
      var set = {}, mx = Math.max.apply(null, nums), gaps = [], n;
      nums.forEach(function (x) { set[x] = true; });
      for (n = 1; n <= mx; n++) if (!set[n]) gaps.push(n);
      if (gaps.length) issues.push({ level: 'info', type: 'numbering-gap', message: 'Numeração com lacuna em ' + (made ? 'Convertido' : 'Errado') + ': falta ' + gaps.map(function (g) { return '#' + pad(g); }).join(', ') });
    });

    return { clips: clips, issues: issues };
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // "08:23" → segundos. Retorna NaN se não houver relógio.
  function clockToSec(t) {
    var m = String(t == null ? '' : t).match(/(\d+):(\d+)/);
    return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : NaN;
  }

  // Resolve o nome do clipe (ex.: "Leozão") para um atleta do elenco do log.
  function makeAthleteResolver(rosterNames, aliases) {
    var byFull = {}, byFirst = {}, aliasMap = {};
    rosterNames.forEach(function (n) {
      byFull[norm(n)] = n;
      var f = norm(n).split(' ')[0];
      (byFirst[f] = byFirst[f] || []).push(n);
    });
    Object.keys(aliases || {}).forEach(function (k) { aliasMap[norm(k)] = aliases[k]; });
    return function (clipAthlete) {
      var k = norm(clipAthlete);
      if (aliasMap[k]) return { name: aliasMap[k], how: 'alias' };
      if (byFull[k]) return { name: byFull[k], how: 'exact' };
      if (byFirst[k] && byFirst[k].length === 1) return { name: byFirst[k][0], how: 'first-name' };
      if (byFirst[k] && byFirst[k].length > 1) return { name: null, how: 'ambiguous', candidates: byFirst[k] };
      return { name: null, how: 'unknown' };
    };
  }

  /* Associa os arremessos de UMA partida aos clipes.
   * shots:   [{sid, Atleta, Quarto, Tempo, Convertido:'Sim'|'Não'}]  em ordem de registro do log
   * clipSet: resultado de buildClipSet
   * opts:    {aliases:{apelido:'Nome no elenco'}, quarterSeconds:600, orderTolerance:3} */
  function matchGame(shots, clipSet, opts) {
    opts = opts || {};
    var QLEN = opts.quarterSeconds || 600, TOL = opts.orderTolerance == null ? 3 : opts.orderTolerance;
    var links = {}, issues = (clipSet.issues || []).slice();
    var allClips = clipSet.clips || [];

    shots.forEach(function (s, i) { s._i = i; });

    var roster = []; shots.forEach(function (s) { if (roster.indexOf(s.Atleta) < 0) roster.push(s.Atleta); });
    var resolve = makeAthleteResolver(roster, opts.aliases);

    var usable = [], unresolvedNames = {}, flaggedGroups = {}, unresolvedQR = {};
    function gkey(q, a, made) { return normQuarter(q) + '|' + a + '|' + (made ? 1 : 0); }
    allClips.forEach(function (c) {
      var r = resolve(c.athlete);
      if (!r.name) {
        var key = norm(c.athlete);
        if (!unresolvedNames[key]) {
          unresolvedNames[key] = { name: c.athlete, how: r.how, candidates: r.candidates, n: 0 };
        }
        unresolvedNames[key].n++;
        unresolvedQR[c.q + '|' + (c.made ? 1 : 0)] = (unresolvedQR[c.q + '|' + (c.made ? 1 : 0)] || []).concat(c.athlete);
        c.flag = c.flag || STATUS.UNRESOLVED;
        return;
      }
      c.rosterName = r.name;
      if (c.flag) { (flaggedGroups[gkey(c.q, r.name, c.made)] = flaggedGroups[gkey(c.q, r.name, c.made)] || []).push(c); return; }
      usable.push(c);
    });
    Object.keys(unresolvedNames).forEach(function (k) {
      var u = unresolvedNames[k];
      issues.push({
        level: 'error', type: 'unresolved-athlete', athlete: u.name,
        message: u.how === 'ambiguous'
          ? 'Atleta do clipe "' + u.name + '" é ambíguo no elenco (' + u.candidates.join(', ') + ') — ' + u.n + ' clipe(s) não vinculados. Defina em athleteAliases.'
          : 'Atleta do clipe "' + u.name + '" não encontrado entre os arremessadores do log — ' + u.n + ' clipe(s) não vinculados. Defina em athleteAliases.'
      });
    });

    var clipQuarters = {};
    allClips.forEach(function (c) { clipQuarters[c.q] = true; });

    var shotGroups = {}, clipGroups = {};
    shots.forEach(function (s) {
      var k = gkey(s.Quarto, s.Atleta, s.Convertido === 'Sim');
      (shotGroups[k] = shotGroups[k] || []).push(s);
    });
    usable.forEach(function (c) {
      var k = gkey(c.q, c.rosterName, c.made);
      (clipGroups[k] = clipGroups[k] || []).push(c);
    });

    function setLink(s, status, clip, reason, detail) {
      links[s.sid] = { status: status, clip: clip || null, reason: reason || '', detail: detail || null };
    }

    var paired = []; // pares candidatos a verificação de ordem
    Object.keys(shotGroups).forEach(function (k) {
      var ss = shotGroups[k].slice(), cs = (clipGroups[k] || []).slice();
      var s0 = ss[0], who = s0.Atleta + ' · ' + normQuarter(s0.Quarto) + ' · ' + (s0.Convertido === 'Sim' ? 'convertidos' : 'errados');
      if (!allClips.length) {
        ss.forEach(function (s) { setLink(s, STATUS.NO_CLIPS, null, 'Nenhum clipe encontrado para esta partida.'); });
        return;
      }
      if (flaggedGroups[k]) {
        var fl = flaggedGroups[k][0].flag;
        ss.forEach(function (s) {
          setLink(s, fl, null, fl === STATUS.DUPLICATE
            ? 'Há clipe duplicado para este grupo (' + who + ') — vínculo bloqueado.'
            : 'Há clipe deste grupo em conflito com o log (' + who + ') — vínculo bloqueado.');
        });
        return;
      }
      var unr = unresolvedQR[normQuarter(s0.Quarto) + '|' + (s0.Convertido === 'Sim' ? 1 : 0)];
      if (!cs.length && unr) {
        ss.forEach(function (s) {
          setLink(s, STATUS.UNRESOLVED, null, 'Há clipes deste quarto/resultado de atleta não identificado (' + unr.filter(function (x, i) { return unr.indexOf(x) === i; }).join(', ') + ') — defina o apelido em athleteAliases.');
        });
        return;
      }
      if (!cs.length) {
        var qHas = !!clipQuarters[normQuarter(s0.Quarto)];
        ss.forEach(function (s) {
          setLink(s, qHas ? STATUS.MISSING : STATUS.NO_CLIPS, null,
            qHas ? 'Sem clipe correspondente (' + who + ').' : 'Nenhum clipe deste quarto na pasta da partida.');
        });
        if (qHas) issues.push({ level: 'error', type: 'missing-clip', message: 'Sem clipe para ' + ss.length + ' arremesso(s): ' + who });
        return;
      }
      if (ss.length !== cs.length) {
        ss.forEach(function (s) { setLink(s, STATUS.MISMATCH, null, 'Divergência: o log tem ' + ss.length + ' arremesso(s) e a pasta tem ' + cs.length + ' clipe(s) (' + who + ').', { shots: ss.length, clips: cs.length }); });
        issues.push({ level: 'error', type: 'count-mismatch', message: 'Divergência de contagem em ' + who + ': log ' + ss.length + ' × clipes ' + cs.length + ' — nenhum vinculado.' });
        return;
      }
      cs.sort(function (a, b) { return a.clockSec - b.clockSec || a.num - b.num; });
      var order = ss.map(function (s) { return { s: s, e: clockToSec(s.Tempo) }; });
      var hasClock = order.every(function (o) { return !isNaN(o.e); });
      // Dentro do grupo a ordem cronológica vem do log; usa o relógio quando disponível, senão o índice.
      // O relógio pode ser "restante" (decrescente) ou "decorrido" (crescente): detecta pela tendência.
      if (hasClock && order.length > 1) {
        var asc = 0, desc = 0;
        order.forEach(function (o, i) { if (i) { if (o.e > order[i - 1].e) asc++; else if (o.e < order[i - 1].e) desc++; } });
        order.sort(function (a, b) { return (desc > asc ? b.e - a.e : a.e - b.e) || a.s._i - b.s._i; });
      } else {
        order.sort(function (a, b) { return a.s._i - b.s._i; });
      }
      order.forEach(function (o, i) {
        setLink(o.s, STATUS.OK, cs[i], '');
        paired.push({ s: o.s, clip: cs[i], e: clockToSec(o.s.Tempo) });
      });
    });

    // Clipes que sobraram sem arremesso correspondente no log
    Object.keys(clipGroups).forEach(function (k) {
      if (shotGroups[k]) return;
      var cs = clipGroups[k], c0 = cs[0];
      issues.push({ level: 'error', type: 'clip-without-shot', message: cs.length + ' clipe(s) sem arremesso correspondente no log: ' + c0.rosterName + ' · ' + c0.q + ' · ' + (c0.made ? 'convertido' : 'errado') + ' (' + cs.map(function (c) { return '#' + pad(c.num); }).join(', ') + ')' });
    });

    // Coerência de sequência por quarto: a ordem dos arremessos no log (todos os atletas)
    // deve coincidir com a ordem dos relógios de vídeo dos clipes pareados.
    var byQ = {};
    paired.forEach(function (p) { (byQ[normQuarter(p.s.Quarto)] = byQ[normQuarter(p.s.Quarto)] || []).push(p); });
    Object.keys(byQ).forEach(function (q) {
      var arr = byQ[q].filter(function (p) { return !isNaN(p.e); });
      if (arr.length < 2) return;
      function inversions(sign) {
        var bad = {};
        for (var i = 0; i < arr.length; i++) for (var j = 0; j < arr.length; j++) {
          if (i === j) continue;
          // i vem antes de j no log (segundo o sentido do relógio) por mais que a tolerância…
          if (sign * (arr[j].e - arr[i].e) > TOL && arr[i].clip.clockSec > arr[j].clip.clockSec + TOL) {
            bad[arr[i].s.sid] = true; bad[arr[j].s.sid] = true;
          }
        }
        return bad;
      }
      var a = inversions(1), b = inversions(-1);
      var bad = Object.keys(a).length <= Object.keys(b).length ? a : b;
      var ids = Object.keys(bad);
      if (!ids.length) return;
      arr.forEach(function (p) {
        if (bad[p.s.sid]) {
          links[p.s.sid].status = STATUS.CHECK;
          links[p.s.sid].reason = 'A ordem deste clipe diverge da sequência do log no ' + q + ' — confira o vídeo.';
        }
      });
      issues.push({ level: 'warn', type: 'order-mismatch', message: 'Sequência dos vídeos não bate com o log no ' + q + ' (' + ids.length + ' arremesso(s) marcados como "conferir").' });
    });

    return { links: links, issues: issues, stats: summarize(links) };
  }

  function summarize(links) {
    var st = { total: 0, linked: 0, ok: 0, check: 0 }, by = {};
    Object.keys(links).forEach(function (k) {
      var l = links[k];
      st.total++; by[l.status] = (by[l.status] || 0) + 1;
      if (l.status === STATUS.OK) { st.ok++; st.linked++; }
      else if (l.status === STATUS.CHECK) { st.check++; st.linked++; }
    });
    st.by = by;
    return st;
  }

  // Textos de apoio para a interface
  var STATUS_LABEL = {
    ok: 'Vídeo vinculado',
    check: 'Vídeo vinculado — conferir',
    missing: 'Clipe ausente',
    mismatch: 'Divergência log × clipes',
    'unresolved-athlete': 'Atleta do clipe não identificado',
    duplicate: 'Clipe duplicado',
    conflict: 'Clipe em conflito com o log',
    'no-clips': 'Sem vídeos para este jogo/quarto',
    'no-folder': 'Pasta da partida não encontrada'
  };

  return {
    STATUS: STATUS, STATUS_LABEL: STATUS_LABEL,
    norm: norm, gameKey: gameKey, normQuarter: normQuarter, isVideoFile: isVideoFile,
    parseClipName: parseClipName, parseCsv: parseCsv, buildClipSet: buildClipSet,
    clockToSec: clockToSec, makeAthleteResolver: makeAthleteResolver,
    matchGame: matchGame, summarize: summarize
  };
});
