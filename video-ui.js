/* WinFast · vídeos dos arremessos nos Heat Maps (controlador + interface)
 *
 * Fluxo: ponto do mapa → WFVideo.openShot(sid) → vínculo (video-match.js) → blob: URL local do
 * clipe (video-local.js, pasta do OneDrive sincronizada) → pop-up com <video controls>.
 * A associação de cada partida é calculada sob demanda, no navegador, assim que o mapa é desenhado
 * e a pasta de vídeos está conectada. Nenhuma associação manual.
 */
(function (root) {
  'use strict';
  var M = root.WFVideoMatch;
  var cfg = root.WF_VIDEO_CONFIG || {};
  var backend = root.WFVideoLocal;   // substituível (testes)
  function L() { return (backend && backend.labels) || {}; }
  var host = {};              // ponte com o site: getGame, getShots, getShot, paintDots
  var games = {};             // gid -> estado do carregamento/associação
  var links = {};             // sid -> {status, clip, reason, gid}
  var tracked = {};           // dotsId -> shots   (mapas desenhados)
  var panels = {};            // elId  -> fn() => shots
  var lastError = '';
  var running = 0, waiting = [], MAXPAR = 3;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function init(h) {
    host = h || {};
    injectStyle();
    if (backend && backend.init) Promise.resolve(backend.init(cfg)).then(refresh, function () {});
  }

  function enabled() { return !!(backend && backend.configured && backend.configured()); }
  function signedIn() { return !!(backend && backend.signedIn && backend.signedIn()); }
  function statusOf(sid) { return links[sid] ? links[sid].status : null; }

  /* ───────────── carregamento por partida ───────────── */
  function schedule(fn) { waiting.push(fn); pump(); }
  function pump() {
    while (running < MAXPAR && waiting.length) {
      running++;
      waiting.shift()().then(done, done);
    }
    function done() { running--; pump(); }
  }

  function gameNames(g) {
    var out = [g.name, g.usp && g.adv ? g.usp + ' x ' + g.adv : '', g.usp && g.adv ? g.usp + ' vs ' + g.adv : ''];
    return out.filter(Boolean);
  }

  function setLinks(gid, res, driveId) {
    Object.keys(res.links).forEach(function (sid) {
      var l = res.links[sid]; l.gid = gid; l.driveId = driveId; links[sid] = l;
    });
  }

  function markAll(gid, shots, status, reason) {
    shots.forEach(function (s) { links[s.sid] = { status: status, clip: null, reason: reason, gid: gid }; });
  }

  function loadGame(gid) {
    var g = host.getGame(gid) || { id: gid };
    var shots = (host.getShots(gid) || []).map(function (s) {
      return { sid: s.sid, Atleta: s.Atleta, Quarto: s.Quarto, Tempo: s.Tempo, Convertido: s.Convertido };
    });
    var st = games[gid] = { state: 'loading', game: g, names: gameNames(g), issues: [], stats: null, folderName: '', n: shots.length };
    schedule(function () {
      return backend.findGameFolder(st.names, M.gameKey).then(function (f) {
        if (f.status === 'none') {
          st.state = 'nofolder'; st.available = (f.available || []).slice(0, 12);
          markAll(gid, shots, M.STATUS.NO_FOLDER, 'Pasta da partida não encontrada na pasta de vídeos. Nome esperado: "' + (st.names[0] || '?') + '".');
          return;
        }
        if (f.status === 'ambiguous') {
          st.state = 'ambiguous'; st.available = f.folders.map(function (x) { return x.name; });
          markAll(gid, shots, M.STATUS.NO_FOLDER, 'Mais de uma pasta corresponde a esta partida (' + st.available.join(' | ') + ') — nada foi vinculado.');
          return;
        }
        st.folderName = f.folder.name;
        return backend.listGameFiles(f.driveId, f.folder.id, M.isVideoFile).then(function (found) {
          var csvP = found.csv ? backend.readText(f.driveId, found.csv.id).then(M.parseCsv).catch(function (e) {
            st.issues.push({ level: 'warn', type: 'csv-unreadable', message: 'Não foi possível ler dados_eventos.csv (' + e.message + '). A associação usou só os nomes dos arquivos.' });
            return null;
          }) : Promise.resolve(null);
          return csvP.then(function (rows) {
            if (!found.csv) st.issues.push({ level: 'warn', type: 'csv-absent', message: 'Pasta sem Relatorio/dados_eventos.csv — o log dos clipes não pôde ser conferido.' });
            if (found.zips && found.zips.length) st.issues.push({ level: found.files.length ? 'warn' : 'error', type: 'zip-not-extracted', message: 'A pasta tem arquivo(s) .zip (' + found.zips.join(', ') + '). O site não lê vídeos de dentro de zip: extraia os clipes na pasta da partida.' });
            var clipSet = M.buildClipSet(found.files, rows);
            var res = M.matchGame(shots, clipSet, { aliases: cfg.athleteAliases, quarterSeconds: cfg.quarterSeconds });
            st.issues = st.issues.concat(res.issues); st.stats = res.stats; st.state = 'ready'; st.nClips = clipSet.clips.length;
            setLinks(gid, res, f.driveId);
          });
        });
      }).catch(function (e) {
        st.state = 'error'; st.error = e.message || String(e);
      }).then(function () { refresh(); });
    });
  }

  function ensureForShots(shots) {
    if (!enabled() || !signedIn()) return;
    var seen = {};
    shots.forEach(function (s) { seen[s.jogo_id] = true; });
    Object.keys(seen).forEach(function (k) {
      var gid = isNaN(+k) ? k : +k;
      if (!games[gid]) loadGame(gid);
    });
  }

  function retry() {
    Object.keys(games).forEach(function (k) { if (games[k].state === 'error') delete games[k]; });
    refresh();
  }

  /* ───────────── integração com o desenho dos mapas ───────────── */
  function track(dotsId, shots) { tracked[dotsId] = shots; ensureForShots(shots); }

  function refresh() {
    Object.keys(tracked).forEach(function (id) {
      if (!document.getElementById(id)) { delete tracked[id]; return; }
      if (host.paintDots) host.paintDots(tracked[id], id);
    });
    Object.keys(panels).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) { delete panels[id]; return; }
      renderPanel(el, panels[id]());
    });
  }

  function mountPanel(elId, getShots) {
    panels[elId] = getShots;
    var el = document.getElementById(elId);
    if (el) renderPanel(el, getShots());
  }

  /* ───────────── painel de status (aba do atleta) ───────────── */
  function renderPanel(el, shots) {
    var h = '<div class="wfv-panel">', lb = L();
    if (!enabled()) {
      el.innerHTML = '<div class="wfv-panel wfv-muted">' + esc(lb.unavailable || 'Vídeos dos arremessos: indisponível neste navegador.') + '</div>';
      return;
    }
    if (!signedIn()) {
      var re = backend.needsReconnect && backend.needsReconnect();
      h += '<div><b>Vídeos dos arremessos</b><div class="wfv-muted">' + esc(re ? lb.reconnectHint : lb.hint) + '</div>' +
        (lastError ? '<div class="wfv-err">' + esc(lastError) + '</div>' : '') + '</div>' +
        '<button class="wfv-btn" onclick="WFVideo.connect()">' + esc(re ? lb.reconnect : lb.connect) + '</button>';
      el.innerHTML = h + '</div>'; return;
    }
    var gids = {}, loading = 0, errs = [], tot = shots.length, ok = 0, chk = 0, bad = 0;
    shots.forEach(function (s) {
      gids[s.jogo_id] = true;
      var st = statusOf(s.sid);
      if (st === 'ok') ok++; else if (st === 'check') chk++; else if (st) bad++;
    });
    Object.keys(gids).forEach(function (g) {
      var gs = games[g]; if (!gs || gs.state === 'loading') loading++; else if (gs.state === 'error') errs.push(gs.error);
    });
    h += '<div><b>Vídeos dos arremessos</b><div class="wfv-muted">';
    if (loading) h += 'Buscando pastas e clipes… ';
    h += '<span class="wfv-ok">▶ ' + (ok + chk) + '</span> de ' + tot + ' arremesso' + (tot === 1 ? '' : 's') + ' com vídeo' +
      (chk ? ' · <span class="wfv-warn">' + chk + ' para conferir</span>' : '') +
      (bad && !loading ? ' · <span class="wfv-err2">' + bad + ' sem vínculo</span>' : '') + '</div>' +
      '<div class="wfv-muted wfv-legend"><i class="wfv-ring"></i> contorno branco = vídeo disponível (clique no ponto) · <i class="wfv-ring wfv-ring-w"></i> tracejado = conferir</div>' +
      (errs.length ? '<div class="wfv-err">' + esc(errs[0]) + ' <a href="#" onclick="WFVideo.retry();return false;">tentar de novo</a></div>' : '') + '</div>' +
      '<div class="wfv-actions"><button class="wfv-btn wfv-btn2" onclick="WFVideo.showReport()">Relatório de vínculos</button>' +
      '<button class="wfv-btn wfv-btn2" onclick="WFVideo.disconnect()">' + esc(lb.disconnect || 'Desconectar') + '</button></div>';
    el.innerHTML = h + '</div>';
  }

  function connect() {
    lastError = '';
    return backend.signIn().then(function () { refresh(); }).catch(function (e) {
      lastError = (e && e.message) || 'Não foi possível acessar a pasta de vídeos.'; refresh();
    });
  }
  function disconnect() {
    games = {}; links = {};
    return Promise.resolve(backend.signOut()).then(refresh);
  }

  /* ───────────── pop-up de vídeo ───────────── */
  var modal, lastFocus;
  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'wfv-ov'; modal.hidden = true;
    modal.innerHTML = '<div class="wfv-box" role="dialog" aria-modal="true" aria-labelledby="wfv-title">' +
      '<div class="wfv-head"><div class="wfv-ht"><div id="wfv-title" class="wfv-title"></div><div id="wfv-sub" class="wfv-sub"></div></div>' +
      '<button class="wfv-x" id="wfv-close" aria-label="Fechar">✕</button></div><div class="wfv-body" id="wfv-body"></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('mousedown', function (e) { if (e.target === modal) close(); });
    modal.querySelector('#wfv-close').addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (!modal.hidden && e.key === 'Escape') close(); });
    return modal;
  }

  function open(title, sub, bodyHtml) {
    ensureModal();
    lastFocus = document.activeElement;
    document.getElementById('wfv-title').textContent = title;
    document.getElementById('wfv-sub').textContent = sub || '';
    document.getElementById('wfv-body').innerHTML = bodyHtml;
    modal.hidden = false;
    document.getElementById('wfv-close').focus();
  }

  function close() {
    if (!modal || modal.hidden) return;
    var v = modal.querySelector('video');
    if (v) { try { v.pause(); } catch (e) {} v.removeAttribute('src'); v.load(); }
    modal.hidden = true;
    document.getElementById('wfv-body').innerHTML = '';
    if (modal._clip) { backend.forgetUrl(modal._clip[0], modal._clip[1]); modal._clip = null; }
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }

  function shotCaption(s) {
    var conv = s.Convertido === 'Sim';
    return {
      title: s.Atleta + ' · ' + (conv ? 'Arremesso convertido' : 'Arremesso errado'),
      sub: 'J' + s.jogo_id + ' vs ' + s.adv + ' · ' + s.Quarto + (s.Tempo ? ' ' + s.Tempo : '') + ' · ' + s.Tipo
    };
  }

  function openShot(sid) {
    var s = host.getShot ? host.getShot(sid) : null;
    if (!s || !enabled()) return;
    var cap = shotCaption(s);
    if (!signedIn()) {
      var re2 = backend.needsReconnect && backend.needsReconnect();
      open(cap.title, cap.sub, '<div class="wfv-msg">' + esc(re2 ? L().reconnectHint : L().hint) + '<br><button class="wfv-btn" onclick="WFVideo.connect().then(function(){WFVideo.openShot(\'' + esc(sid) + '\')})">' + esc(re2 ? L().reconnect : L().connect) + '</button></div>');
      return;
    }
    var l = links[sid], gs = games[s.jogo_id];
    if (!l) {
      open(cap.title, cap.sub, '<div class="wfv-msg">' + (gs && gs.state === 'error' ? esc(gs.error) : 'Ainda localizando os vídeos desta partida…') + '</div>');
      if (!gs) ensureForShots([s]);
      return;
    }
    if (l.status !== 'ok' && l.status !== 'check') {
      open(cap.title, cap.sub, '<div class="wfv-msg"><b>' + esc(M.STATUS_LABEL[l.status] || l.status) + '</b><br>' + esc(l.reason) + '</div>');
      return;
    }
    var clipTxt = 'Clipe: ' + l.clip.fileName;
    open(cap.title, cap.sub + ' · ' + l.clip.q + ' ' + l.clip.clock, '<div class="wfv-vwrap"><div class="wfv-msg" id="wfv-load">Carregando vídeo…</div></div>' +
      (l.status === 'check' ? '<div class="wfv-note">⚠ ' + esc(l.reason) + '</div>' : '') +
      '<div class="wfv-file">' + esc(clipTxt) + '</div>');
    var token = modal._tok = {};
    modal._clip = [l.driveId, l.clip.file.id];
    backend.downloadUrlOf(l.driveId, l.clip.file.id).then(function (url) {
      if (modal._tok !== token || modal.hidden) return;
      var wrap = modal.querySelector('.wfv-vwrap');
      wrap.innerHTML = '<video controls autoplay playsinline preload="auto" controlslist="nodownload"></video>';
      var v = wrap.firstChild, retried = false;
      v.addEventListener('error', function () {
        if (retried) { wrap.innerHTML = '<div class="wfv-msg">Não foi possível reproduzir este vídeo.</div>'; return; }
        retried = true; backend.forgetUrl(l.driveId, l.clip.file.id);
        backend.downloadUrlOf(l.driveId, l.clip.file.id).then(function (u2) { v.src = u2; v.play().catch(function () {}); });
      });
      v.src = url;
      v.play().catch(function () {});
    }).catch(function (e) {
      if (modal._tok !== token) return;
      modal.querySelector('.wfv-vwrap').innerHTML = '<div class="wfv-msg">' + esc(e.message || 'Falha ao abrir o vídeo.') + '</div>';
    });
  }

  /* ───────────── relatório de vínculos ───────────── */
  var STATE_LABEL = { loading: 'carregando…', ready: 'analisada', nofolder: 'pasta não encontrada', ambiguous: 'pasta ambígua', error: 'erro' };
  function showReport() {
    var ids = Object.keys(games).sort(function (a, b) { return a - b; });
    var h = '';
    if (!ids.length) h = '<div class="wfv-msg">Nenhuma partida carregada ainda.</div>';
    ids.forEach(function (id) {
      var g = games[id], gm = g.game || {};
      h += '<div class="wfv-rg"><div class="wfv-rh"><b>J' + esc(id) + ' vs ' + esc(gm.adv || '') + '</b> <span class="wfv-chip wfv-' + esc(g.state) + '">' + esc(STATE_LABEL[g.state] || g.state) + '</span></div>';
      h += '<div class="wfv-muted">Nome esperado da pasta: ' + esc(g.names[0] || '—') + (g.folderName ? ' · pasta encontrada: <b>' + esc(g.folderName) + '</b>' : '') + '</div>';
      if (g.stats) {
        var by = g.stats.by || {}, parts = [];
        Object.keys(by).forEach(function (k) { parts.push(by[k] + ' × ' + (M.STATUS_LABEL[k] || k).toLowerCase()); });
        h += '<div class="wfv-muted">' + g.stats.total + ' arremessos no log · ' + (g.nClips || 0) + ' clipes na pasta · ' + parts.join(' · ') + '</div>';
      }
      if (g.state === 'error') h += '<div class="wfv-err">' + esc(g.error) + '</div>';
      if (g.available && g.available.length) h += '<div class="wfv-muted">Pastas existentes: ' + g.available.map(esc).join(' · ') + '</div>';
      if (g.issues.length) {
        h += '<ul class="wfv-issues">';
        g.issues.slice().sort(function (a, b) { return lvl(a.level) - lvl(b.level); }).forEach(function (i) {
          h += '<li class="wfv-i-' + esc(i.level) + '">' + esc(i.message) + '</li>';
        });
        h += '</ul>';
        if (g.issues.some(function (i) { return i.type === 'unresolved-athlete'; })) {
          h += '<div class="wfv-muted">Para vincular esses atletas, preencha <code>athleteAliases</code> em <code>video-config.js</code> (ex.: <code>{ \'Leozão\': \'Nome no site\' }</code>).</div>';
        }
      } else if (g.state === 'ready') h += '<div class="wfv-ok">Nenhuma divergência.</div>';
      h += '</div>';
    });
    open('Relatório de vínculos vídeo × log', 'Divergências são sinalizadas e nunca vinculadas automaticamente.', '<div class="wfv-report">' + h + '</div>');
  }
  function lvl(l) { return l === 'error' ? 0 : l === 'warn' ? 1 : 2; }

  /* ───────────── estilo ───────────── */
  function injectStyle() {
    if (document.getElementById('wfv-style')) return;
    var st = document.createElement('style'); st.id = 'wfv-style';
    st.textContent =
      '.wfv-ov{position:fixed;inset:0;background:rgba(10,12,16,.78);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px}.wfv-ov[hidden]{display:none}' +
      '.wfv-box{background:#121214;color:#e8eaf0;border:1px solid #2a2a30;border-radius:10px;width:min(920px,100%);max-height:92vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.5);font-family:Barlow,system-ui,sans-serif}' +
      '.wfv-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:14px 16px;border-bottom:2px solid var(--usp,#DE2027)}' +
      '.wfv-title{font-size:17px;font-weight:700}.wfv-sub{font-size:12.5px;color:#9ca3af;margin-top:2px}' +
      '.wfv-x{background:transparent;border:1px solid #3a3a42;color:#e8eaf0;border-radius:6px;width:34px;height:34px;font-size:15px;cursor:pointer}.wfv-x:hover,.wfv-x:focus-visible{border-color:var(--usp,#DE2027);color:#fff;outline:none}' +
      '.wfv-body{padding:14px 16px;overflow:auto}.wfv-vwrap{background:#000;border-radius:8px;overflow:hidden;min-height:200px;display:flex;align-items:center;justify-content:center}' +
      '.wfv-vwrap video{width:100%;max-height:68vh;display:block;background:#000}' +
      '.wfv-msg{padding:22px 12px;text-align:center;line-height:1.5;color:#d1d5db}.wfv-msg .wfv-btn{margin-top:12px}' +
      '.wfv-note{margin-top:10px;font-size:13px;color:#f59e0b}.wfv-file{margin-top:8px;font-size:11.5px;color:#6b7280;word-break:break-all}' +
      '.wfv-panel{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;background:#F7F7F6;border:1px solid #DADAD9;border-radius:8px;padding:10px 12px;margin-bottom:10px;font-size:13px;color:#26262A}' +
      '.wfv-muted{font-size:12px;color:#6E6E70;margin-top:2px}.wfv-legend{margin-top:4px}.wfv-ok{color:#16a34a;font-weight:700}.wfv-warn{color:#b45309;font-weight:600}.wfv-err2{color:#DE2027;font-weight:600}' +
      '.wfv-err{font-size:12px;color:#DE2027;margin-top:4px}.wfv-actions{display:flex;gap:6px;flex-wrap:wrap}' +
      '.wfv-btn{background:var(--usp,#DE2027);color:#fff;border:0;border-radius:5px;padding:8px 14px;font:600 13px Barlow,system-ui,sans-serif;cursor:pointer}.wfv-btn:hover{filter:brightness(1.08)}' +
      '.wfv-btn2{background:#fff;color:#26262A;border:1px solid #DADAD9;padding:6px 11px;font-weight:500;font-size:12px}' +
      '.wfv-ring{display:inline-block;width:10px;height:10px;border-radius:50%;background:#121214;border:2px solid #fff;box-shadow:0 0 0 1px #9ca3af;vertical-align:-2px;margin-right:3px}.wfv-ring-w{border:2px dashed #f59e0b;box-shadow:none}' +
      '.wfv-report .wfv-rg{border:1px solid #2a2a30;border-radius:8px;padding:10px 12px;margin-bottom:10px;background:#16161a}.wfv-rh{font-size:14px;margin-bottom:4px}' +
      '.wfv-chip{font-size:11px;border-radius:10px;padding:1px 8px;margin-left:6px;background:#2a2a30;color:#d1d5db}.wfv-ready{background:#14532d;color:#bbf7d0}.wfv-nofolder,.wfv-ambiguous,.wfv-error{background:#7f1d1d;color:#fecaca}' +
      '.wfv-report .wfv-muted{color:#9ca3af}.wfv-report .wfv-ok{color:#4ade80}.wfv-report .wfv-err{color:#f87171}.wfv-report code{background:#222228;padding:1px 4px;border-radius:3px}' +
      '.wfv-issues{margin:8px 0 4px 18px;padding:0;font-size:12.5px;line-height:1.45}.wfv-i-error{color:#fca5a5}.wfv-i-warn{color:#fcd34d}.wfv-i-info{color:#9ca3af}';
    document.head.appendChild(st);
  }

  root.WFVideo = {
    init: init, enabled: enabled, signedIn: signedIn, statusOf: statusOf,
    track: track, mountPanel: mountPanel, refresh: refresh, ensureForShots: ensureForShots,
    openShot: openShot, close: close, showReport: showReport, connect: connect, disconnect: disconnect, retry: retry,
    setBackend: function (b) { backend = b; if (b && b.init) b.init(cfg); },
    _state: function () { return { games: games, links: links }; }
  };
})(window);
