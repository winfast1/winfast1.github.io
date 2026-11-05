/* WinFast · acesso aos vídeos pela pasta do OneDrive sincronizada no computador
 *
 * Usa a File System Access API (Chrome/Edge no desktop): o usuário escolhe UMA vez a pasta raiz
 * (ex.: ...\Área de Trabalho\BASQUETE) e o site lê as subpastas das partidas em modo somente leitura.
 *
 * - Sem login, sem app no Azure, sem token, sem link público: quem tem a pasta sincronizada no
 *   PC (ou seja, quem tem acesso no OneDrive) consegue ver os vídeos; os outros não.
 * - Nenhum arquivo é enviado a lugar algum: o vídeo toca via blob: URL local.
 * - A pasta escolhida fica guardada só no navegador (IndexedDB); a cada nova sessão o Chrome pede
 *   um clique de permissão ("Reconectar pasta").
 * Interface idêntica à usada por video-ui.js (configured/signedIn/signIn/findGameFolder/...).
 */
(function (root) {
  'use strict';
  var MAX_DEPTH = 3;           // procura a pasta da partida até 3 níveis abaixo da raiz (BASQUETE/MEDUSP/<partida>)
  var rootHandle = null, granted = false, dirIndex = null, fileMap = {}, urlCache = {};

  var labels = {
    connect: 'Selecionar pasta de vídeos',
    reconnect: 'Reconectar pasta de vídeos',
    hint: 'Escolha a pasta do OneDrive sincronizada neste computador (ex.: BASQUETE). A leitura é local e somente leitura.',
    reconnectHint: 'Clique para liberar novamente o acesso à pasta de vídeos nesta sessão.',
    disconnect: 'Trocar pasta',
    unavailable: 'Vídeos dos arremessos: este navegador não permite ler a pasta de vídeos. Use Chrome ou Edge no computador.'
  };

  function supported() { return !!(root.showDirectoryPicker && root.indexedDB); }
  function configured() { return supported(); }
  function signedIn() { return !!(rootHandle && granted); }
  function needsReconnect() { return !!(rootHandle && !granted); }
  function folderName() { return rootHandle ? rootHandle.name : ''; }

  /* ── persistência do handle da pasta (IndexedDB) ── */
  function idb(mode, fn) {
    return new Promise(function (resolve) {
      try {
        var open = root.indexedDB.open('winfast-video', 1);
        open.onupgradeneeded = function () { open.result.createObjectStore('h'); };
        open.onerror = function () { resolve(null); };
        open.onsuccess = function () {
          var tx, req;
          try { tx = open.result.transaction('h', mode); req = fn(tx.objectStore('h')); }
          catch (e) { try { open.result.close(); } catch (e2) {} resolve(null); return; }
          tx.oncomplete = function () { open.result.close(); resolve(req && req.result !== undefined ? req.result : null); };
          tx.onerror = tx.onabort = function () { resolve(null); };
        };
      } catch (e) { resolve(null); }
    });
  }
  function saveRoot(h) { return idb('readwrite', function (s) { return s.put(h, 'root'); }); }
  function loadRoot() { return idb('readonly', function (s) { return s.get('root'); }); }
  function clearRoot() { return idb('readwrite', function (s) { return s.delete('root'); }); }

  function perm(h, ask) {
    var o = { mode: 'read' };
    var p = ask ? h.requestPermission(o) : h.queryPermission(o);
    return Promise.resolve(p).then(function (r) { return r === 'granted'; }, function () { return false; });
  }

  function reset() { dirIndex = null; fileMap = {}; urlCache = {}; }

  function init() {
    if (!supported()) return Promise.resolve();
    return loadRoot().then(function (h) {
      if (!h) return;
      rootHandle = h;
      return perm(h, false).then(function (ok) { granted = ok; });
    });
  }

  function signIn() {
    if (!supported()) return Promise.reject(new Error(labels.unavailable));
    var step = rootHandle && !granted ? perm(rootHandle, true) : Promise.resolve(false);
    return step.then(function (ok) {
      if (ok) { granted = true; reset(); return; }
      return root.showDirectoryPicker({ id: 'winfast-video', mode: 'read' }).then(function (h) {
        rootHandle = h; granted = true; reset();
        return saveRoot(h);
      }).catch(function (e) {
        if (e && e.name === 'AbortError') throw new Error('Nenhuma pasta selecionada.');
        throw e;
      });
    });
  }

  function signOut() {
    rootHandle = null; granted = false; reset();
    return clearRoot();
  }

  function guard(p) {
    return Promise.resolve(p).catch(function (e) {
      if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) {
        granted = false;
        throw new Error('O navegador revogou o acesso à pasta de vídeos — clique em "' + labels.reconnect + '".');
      }
      if (e && e.name === 'NotFoundError') throw new Error('Arquivo ou pasta não encontrados (foi movido ou apagado?).');
      throw e;
    });
  }

  function listEntries(dir) {
    var out = [];
    return (async function () {
      for await (var e of dir.entries()) out.push({ name: e[0], handle: e[1] });
      return out;
    })();
  }

  // Índice das subpastas (até MAX_DEPTH) — uma vez por sessão.
  function buildIndex() {
    if (dirIndex) return Promise.resolve(dirIndex);
    var list = [];
    function walk(dir, path, depth) {
      if (depth > MAX_DEPTH) return Promise.resolve();
      return listEntries(dir).then(function (kids) {
        var subs = kids.filter(function (k) { return k.handle.kind === 'directory'; });
        subs.forEach(function (k) { list.push({ id: path + k.name, name: k.name, handle: k.handle, depth: depth }); });
        return Promise.all(subs.map(function (k) { return walk(k.handle, path + k.name + '/', depth + 1); }));
      });
    }
    return guard(walk(rootHandle, '', 1)).then(function () { dirIndex = list; return list; });
  }

  // Procura a pasta da partida em qualquer nível (BASQUETE/MEDUSP/<partida>), por nome tolerante.
  function findGameFolder(candidateNames, keyFn) {
    if (!signedIn()) return Promise.reject(new Error('Pasta de vídeos não conectada.'));
    return buildIndex().then(function (dirs) {
      var keys = candidateNames.filter(Boolean).map(keyFn);
      var hits = dirs.filter(function (d) { return keys.indexOf(keyFn(d.name)) >= 0; });
      if (hits.length === 1) return { status: 'found', folder: { id: hits[0].id, name: hits[0].name }, driveId: '' };
      if (hits.length > 1) return { status: 'ambiguous', folders: hits.map(function (h) { return { id: h.id, name: h.id }; }) };
      var av = dirs.filter(function (d) { return d.depth >= 2; });
      return { status: 'none', available: (av.length ? av : dirs).map(function (d) { return d.name; }) };
    });
  }

  function handleOfDir(id) {
    return dirIndex.filter(function (d) { return d.id === id; })[0];
  }

  // Vídeos (até 3 níveis abaixo da pasta da partida), dados_eventos.csv e .zip encontrados.
  function listGameFiles(driveId, folderId, isVideo) {
    var d = handleOfDir(folderId);
    if (!d) return Promise.reject(new Error('Pasta da partida não indexada.'));
    var files = [], csv = null, zips = [];
    function walk(dir, path, folderName, depth) {
      return listEntries(dir).then(function (kids) {
        var subs = [];
        kids.forEach(function (k) {
          var id = path + k.name;
          if (k.handle.kind === 'directory') { if (depth < 3) subs.push(k); return; }
          if (isVideo(k.name)) { fileMap[id] = k.handle; files.push({ id: id, name: k.name, folder: folderName }); }
          else if (/^dados_eventos\.csv$/i.test(k.name)) { fileMap[id] = k.handle; csv = { id: id, name: k.name }; }
          else if (/\.zip$/i.test(k.name)) zips.push(k.name);
        });
        return Promise.all(subs.map(function (s) { return walk(s.handle, path + s.name + '/', s.name, depth + 1); }));
      });
    }
    return guard(walk(d.handle, folderId + '/', '', 0)).then(function () { return { files: files, csv: csv, zips: zips }; });
  }

  function fileOf(id) {
    var h = fileMap[id];
    if (!h) return Promise.reject(new Error('Arquivo não indexado.'));
    return guard(h.getFile());
  }

  function readText(driveId, id) { return fileOf(id).then(function (f) { return f.text(); }); }

  // blob: URL local; o arquivo não é copiado para a memória inteiro (o navegador lê sob demanda).
  function downloadUrlOf(driveId, id) {
    if (urlCache[id]) return Promise.resolve(urlCache[id]);
    return fileOf(id).then(function (f) { return (urlCache[id] = root.URL.createObjectURL(f)); });
  }

  function forgetUrl(driveId, id) {
    if (urlCache[id]) { try { root.URL.revokeObjectURL(urlCache[id]); } catch (e) {} delete urlCache[id]; }
  }

  root.WFVideoLocal = {
    labels: labels, init: init, configured: configured, signedIn: signedIn, needsReconnect: needsReconnect,
    folderName: folderName, signIn: signIn, signOut: signOut,
    findGameFolder: findGameFolder, listGameFiles: listGameFiles, readText: readText,
    downloadUrlOf: downloadUrlOf, forgetUrl: forgetUrl,
    _setRoot: function (h) { rootHandle = h; granted = !!h; reset(); }
  };
})(window);
