// Executar: node --test tests/video-match.test.js tests/video-local.test.js
// Testa video-local.js contra um File System Access API simulado (nenhum disco real é lido).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const M = require('../video-match.js');

class FileH {
  constructor(name, content = '') { this.kind = 'file'; this.name = name; this.content = content; this.denied = false; }
  async getFile() {
    if (this.denied) { const e = new Error('denied'); e.name = 'NotAllowedError'; throw e; }
    return { name: this.name, text: async () => this.content, _blobOf: this.name };
  }
}
class DirH {
  constructor(name, kids = []) { this.kind = 'directory'; this.name = name; this.kids = kids; this.perm = 'granted'; this.asked = 0; }
  async *entries() { for (const k of this.kids) yield [k.name, k]; }
  async queryPermission() { return this.perm; }
  async requestPermission() { this.asked++; this.perm = 'granted'; return 'granted'; }
}
const D = (n, k) => new DirH(n, k), F = (n, c) => new FileH(n, c);

function fakeIDB() {
  const store = {};
  return {
    _store: store,
    open() {
      const req = {};
      setTimeout(() => {
        const tick = (tx) => setTimeout(() => tx.oncomplete && tx.oncomplete());
        req.result = {
          createObjectStore() {}, close() {},
          transaction() {
            const tx = {};
            tx.objectStore = () => ({
              put(v, k) { store[k] = v; tick(tx); return {}; },
              get(k) { tick(tx); return { result: store[k] }; },
              delete(k) { delete store[k]; tick(tx); return {}; }
            });
            return tx;
          }
        };
        req.onupgradeneeded && req.onupgradeneeded();
        req.onsuccess && req.onsuccess();
      });
      return req;
    }
  };
}

function load({ picker, idb, noApi } = {}) {
  const urls = [], revoked = [];
  const win = {
    showDirectoryPicker: noApi ? undefined : picker, indexedDB: noApi ? undefined : (idb || fakeIDB()),
    URL: { createObjectURL: (f) => { urls.push(f.name); return 'blob:test/' + urls.length; }, revokeObjectURL: (u) => revoked.push(u) }
  };
  const src = fs.readFileSync(path.join(__dirname, '..', 'video-local.js'), 'utf8');
  new Function('window', src)(win);
  return { L: win.WFVideoLocal, win, urls, revoked };
}

const clip = (n) => F(n);
function basquete() {
  return D('BASQUETE', [
    D('MEDUSP', [
      D('MED USP_VS_ZUMBI DOS PALMARES', [
        D('Arremesso Errado', [clip('Arremesso Errado #01 - Q1 00m45s - Leozão.mp4'), clip('Arremesso Errado #02 - Q1 02m50s - Mogi.mp4'), F('capa.jpg')]),
        D('Arremesso Convertido', [clip('Arremesso Convertido #01 - Q2 02m19s - Mogi.mp4')]),
        D('Relatorio', [F('dados_eventos.csv', 'categoria;numero\n"Arremesso Errado";"1"'), F('relatorio.html')])
      ]),
      D('Med Usp x EEFE', [F('MedUsp_vs_EEFE.zip')]),
      D('Med Usp x FEA', [])
    ]),
    D('OUTRO TIME', [D('Med Usp x FEA', [])]),
    F('leia-me.txt')
  ]);
}

test('navegador sem File System Access API: integração indisponível', () => {
  const { L } = load({ noApi: true });
  assert.equal(L.configured(), false);
  assert.equal(L.signedIn(), false);
});

test('selecionar pasta: abre o seletor em modo leitura, guarda o handle e passa a estar conectado', async () => {
  const root = basquete(); let opts;
  const idb = fakeIDB();
  const { L } = load({ idb, picker: async (o) => { opts = o; return root; } });
  await L.init();
  assert.equal(L.signedIn(), false);
  await L.signIn();
  assert.equal(opts.mode, 'read');
  assert.equal(L.signedIn(), true);
  assert.equal(L.folderName(), 'BASQUETE');
  assert.equal(idb._store.root, root);
});

test('nova sessão: pasta lembrada exige um clique de permissão, sem abrir o seletor de novo', async () => {
  const root = basquete(); const idb = fakeIDB(); idb._store.root = root; root.perm = 'prompt';
  let pickerCalls = 0;
  const { L } = load({ idb, picker: async () => { pickerCalls++; return root; } });
  await L.init();
  assert.equal(L.signedIn(), false);
  assert.equal(L.needsReconnect(), true);
  await L.signIn();
  assert.equal(root.asked, 1);
  assert.equal(pickerCalls, 0);
  assert.equal(L.signedIn(), true);
});

test('cancelar o seletor não conecta e devolve mensagem clara', async () => {
  const { L } = load({ picker: async () => { const e = new Error('x'); e.name = 'AbortError'; throw e; } });
  await assert.rejects(L.signIn(), /Nenhuma pasta selecionada/);
  assert.equal(L.signedIn(), false);
});

test('acha a pasta da partida em BASQUETE/MEDUSP/ com nome tolerante', async () => {
  const { L } = load({ picker: async () => basquete() });
  await L.signIn();
  const r = await L.findGameFolder(['Med Usp x Zumbi dos Palmares'], M.gameKey);
  assert.equal(r.status, 'found');
  assert.equal(r.folder.name, 'MED USP_VS_ZUMBI DOS PALMARES');
  assert.equal(r.folder.id, 'MEDUSP/MED USP_VS_ZUMBI DOS PALMARES');
});

test('partida sem pasta → "none" com as pastas existentes; pasta repetida em dois lugares → "ambiguous"', async () => {
  const { L } = load({ picker: async () => basquete() });
  await L.signIn();
  const none = await L.findGameFolder(['Med Usp x Outro'], M.gameKey);
  assert.equal(none.status, 'none');
  assert.ok(none.available.includes('Med Usp x EEFE'));
  const amb = await L.findGameFolder(['Med Usp x FEA'], M.gameKey);
  assert.equal(amb.status, 'ambiguous');
  assert.deepEqual(amb.folders.map(f => f.name).sort(), ['MEDUSP/Med Usp x FEA', 'OUTRO TIME/Med Usp x FEA']);
});

test('lista vídeos nas subpastas, o dados_eventos.csv e ignora outros arquivos', async () => {
  const { L } = load({ picker: async () => basquete() });
  await L.signIn();
  const f = await L.findGameFolder(['MED USP_VS_ZUMBI DOS PALMARES'], M.gameKey);
  const r = await L.listGameFiles('', f.folder.id, M.isVideoFile);
  assert.deepEqual(r.files.map(x => x.name).sort(), [
    'Arremesso Convertido #01 - Q2 02m19s - Mogi.mp4',
    'Arremesso Errado #01 - Q1 00m45s - Leozão.mp4',
    'Arremesso Errado #02 - Q1 02m50s - Mogi.mp4']);
  assert.equal(r.files.find(x => /Convertido/.test(x.name)).folder, 'Arremesso Convertido');
  assert.equal(r.csv.name, 'dados_eventos.csv');
  assert.deepEqual(r.zips, []);
  const csv = await L.readText('', r.csv.id);
  assert.match(csv, /categoria/);
});

test('pasta com apenas .zip: sem vídeos e os zips são reportados', async () => {
  const { L } = load({ picker: async () => basquete() });
  await L.signIn();
  const f = await L.findGameFolder(['Med Usp x EEFE'], M.gameKey);
  const r = await L.listGameFiles('', f.folder.id, M.isVideoFile);
  assert.equal(r.files.length, 0);
  assert.deepEqual(r.zips, ['MedUsp_vs_EEFE.zip']);
});

test('reprodução: blob: URL local, cacheada, revogada ao esquecer', async () => {
  const { L, urls, revoked } = load({ picker: async () => basquete() });
  await L.signIn();
  const f = await L.findGameFolder(['MED USP_VS_ZUMBI DOS PALMARES'], M.gameKey);
  const r = await L.listGameFiles('', f.folder.id, M.isVideoFile);
  const id = r.files[0].id;
  const u1 = await L.downloadUrlOf('', id), u2 = await L.downloadUrlOf('', id);
  assert.match(u1, /^blob:/); assert.equal(u1, u2); assert.equal(urls.length, 1);
  L.forgetUrl('', id);
  assert.deepEqual(revoked, [u1]);
  const u3 = await L.downloadUrlOf('', id);
  assert.notEqual(u1, u3);
});

test('permissão revogada no meio da sessão: mensagem clara e volta a pedir reconexão', async () => {
  const root = basquete();
  const { L } = load({ picker: async () => root });
  await L.signIn();
  const f = await L.findGameFolder(['MED USP_VS_ZUMBI DOS PALMARES'], M.gameKey);
  const r = await L.listGameFiles('', f.folder.id, M.isVideoFile);
  root.kids[0].kids[0].kids[0].kids.forEach(k => { k.denied = true; });
  await assert.rejects(L.downloadUrlOf('', r.files.find(x => /Errado #01/.test(x.name)).id), /revogou o acesso/);
  assert.equal(L.signedIn(), false);
  assert.equal(L.needsReconnect(), true);
});

test('trocar pasta (signOut) esquece a pasta guardada', async () => {
  const idb = fakeIDB();
  const { L } = load({ idb, picker: async () => basquete() });
  await L.signIn();
  assert.ok(idb._store.root);
  await L.signOut();
  assert.equal(L.signedIn(), false);
  assert.equal(idb._store.root, undefined);
});
