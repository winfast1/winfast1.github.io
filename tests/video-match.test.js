// Executar: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../video-match.js');
const fx = require('./fixtures/MedUsp_vs_ZumbidosPalmares_1_e_2_quarto.json');
const fxQ1 = require('./fixtures/MedUsp_vs_ZumbidosPalmares_1quarto.json');

const S = M.STATUS;
const csvRows = () => M.parseCsv(fx.csv);
const fileList = (names) => names.map((p, i) => ({ id: 'f' + i, name: p.split('/').pop(), folder: p.split('/')[0] }));
const allFiles = () => fileList(fx.files);

// Cria os arremessos "do log do site" a partir do CSV real. Tempo = relógio restante do quarto,
// monotônico com o relógio do vídeo. A ordem do log é embaralhada de forma determinística.
function shotsFromCsv(rows, { clockMode = 'remaining', rosterName = (a) => a } = {}) {
  const shots = rows.map((r, i) => {
    const vid = M.parseClipName(r.clipe.split('/').pop());
    const elapsed = Math.round(vid.clockSec * (600 / 900));
    const t = clockMode === 'remaining' ? 600 - elapsed : elapsed;
    const mm = String(Math.floor(t / 60)).padStart(2, '0'), ss = String(t % 60).padStart(2, '0');
    return {
      sid: '1|' + rosterName(r.atleta) + '|' + i, Atleta: rosterName(r.atleta),
      Quarto: r.periodo.replace(/Q(\d)/, '$1Q'), Tempo: mm + ':' + ss,
      Convertido: /Convertido/.test(r.categoria) ? 'Sim' : 'Não',
      _src: r.clipe.split('/').pop(), _e: elapsed, _q: r.periodo
    };
  });
  // ordem cronológica do log: por quarto e tempo decorrido (como o site registra)
  shots.sort((a, b) => a._q.localeCompare(b._q) || a._e - b._e);
  return shots;
}

test('nomes de partida: pasta e cadastro do site são equivalentes', () => {
  assert.equal(M.gameKey('MED USP_VS_ZUMBI DOS PALMARES'), M.gameKey('Med Usp x Zumbi dos Palmares'));
  assert.equal(M.gameKey('Med Usp vs Zumbí dos Palmáres'), M.gameKey('MED USP_VS_ZUMBI DOS PALMARES'));
  assert.notEqual(M.gameKey('Med Usp x EEFE'), M.gameKey('Med Usp x FEA'));
});

test('parseClipName lê tipo, número, quarto, relógio e atleta', () => {
  const p = M.parseClipName('Arremesso Convertido #02 - Q2 08m17s - Mogi.mp4');
  assert.deepEqual({ ...p }, { made: true, num: 2, q: 'Q2', clockSec: 497, clock: '08m17s', athlete: 'Mogi' });
  assert.equal(M.parseClipName('Arremesso Errado #10 - Q1 14m53s - Henricão.mp4').athlete, 'Henricão');
  assert.equal(M.parseClipName('video qualquer.mp4'), null);
});

test('parseCsv: aspas, BOM, ponto e vírgula e aspas escapadas', () => {
  const rows = M.parseCsv('﻿a;b\r\n"x;y";"he said ""hi"""\r\n');
  assert.deepEqual(rows, [{ a: 'x;y', b: 'he said "hi"' }]);
  assert.equal(csvRows().length, 29);
});

test('dados reais: duplicidade de número e lacuna são sinalizadas, mas nada é bloqueado', () => {
  const cs = M.buildClipSet(allFiles(), csvRows());
  assert.equal(cs.clips.length, 29);
  assert.ok(cs.issues.some(i => i.type === 'duplicate-number' && /#09/.test(i.message)));
  assert.ok(cs.issues.some(i => i.type === 'numbering-gap' && /#07/.test(i.message)));
  assert.ok(!cs.issues.some(i => i.level === 'error'));
  assert.ok(cs.clips.every(c => !c.flag));
});

test('associação completa: cada arremesso recebe exatamente o clipe do mesmo atleta/quarto/resultado', () => {
  const shots = shotsFromCsv(csvRows());
  const res = M.matchGame(shots, M.buildClipSet(allFiles(), csvRows()), {});
  assert.equal(res.stats.total, 29);
  assert.equal(res.stats.ok, 29, JSON.stringify(res.stats));
  shots.forEach(s => {
    const l = res.links[s.sid];
    assert.equal(l.status, S.OK);
    // mesma chave de grupo
    const p = M.parseClipName(l.clip.fileName);
    assert.equal(p.athlete, s.Atleta);
    assert.equal(p.q, s._q);
    assert.equal(p.made, s.Convertido === 'Sim');
  });
  // sequência: dentro de cada atleta/quarto/resultado a ordem do log == ordem do vídeo
  shots.forEach(s => assert.equal(res.links[s.sid].clip.fileName, s._src));
});

test('funciona com relógio crescente (decorrido) ou decrescente (restante)', () => {
  ['remaining', 'elapsed'].forEach(clockMode => {
    const shots = shotsFromCsv(csvRows(), { clockMode });
    const res = M.matchGame(shots, M.buildClipSet(allFiles(), csvRows()), {});
    assert.equal(res.stats.ok, 29, clockMode);
    assert.ok(!res.issues.some(i => i.type === 'order-mismatch'), clockMode);
    shots.forEach(s => assert.equal(res.links[s.sid].clip.fileName, s._src));
  });
});

test('mesmo com o log em ordem embaralhada entre atletas, os pares seguem corretos', () => {
  const shots = shotsFromCsv(csvRows());
  // reverte a ordem de registro dentro de cada grupo seria incorreto; embaralha apenas entre grupos
  const rev = shots.slice().sort((a, b) => a.Atleta.localeCompare(b.Atleta) || a._e - b._e);
  const res = M.matchGame(rev, M.buildClipSet(allFiles(), csvRows()), {});
  rev.forEach(s => assert.equal(res.links[s.sid].clip.fileName, s._src));
});

test('clipe ausente: o grupo inteiro é marcado como divergente e nada é vinculado a esmo', () => {
  const rows = csvRows();
  const shots = shotsFromCsv(rows);
  const lost = 'Arremesso Errado #18 - Q2 06m47s - Mogi.mp4';
  const files = allFiles().filter(f => f.name !== lost);
  const res = M.matchGame(shots, M.buildClipSet(files, rows), {});
  const mogiQ2Err = shots.filter(s => s.Atleta === 'Mogi' && s._q === 'Q2' && s.Convertido === 'Não');
  assert.ok(mogiQ2Err.length > 1);
  mogiQ2Err.forEach(s => assert.equal(res.links[s.sid].status, S.MISMATCH));
  // outros grupos continuam corretos
  const others = shots.filter(s => !mogiQ2Err.includes(s));
  others.forEach(s => assert.equal(res.links[s.sid].status, S.OK));
  assert.ok(res.issues.some(i => i.type === 'count-mismatch'));
  assert.ok(res.issues.some(i => i.type === 'csv-missing-file' && /Mogi/.test(i.message)));
});

test('clipe a mais (sem arremesso no log) também é divergência', () => {
  const rows = csvRows();
  const shots = shotsFromCsv(rows).filter(s => s._src !== 'Arremesso Errado #13 - Q2 05m11s - Kuroba.mp4');
  const res = M.matchGame(shots, M.buildClipSet(allFiles(), rows), {});
  shots.filter(s => s.Atleta === 'Kuroba' && s._q === 'Q2' && s.Convertido === 'Não')
    .forEach(s => assert.equal(res.links[s.sid].status, S.MISMATCH));
});

test('atleta sem nenhum clipe no quarto = ausente; quarto sem clipes = sem vídeo', () => {
  const rows = csvRows();
  const shots = shotsFromCsv(rows);
  shots.push({ sid: 'x1', Atleta: 'Fulano', Quarto: '2Q', Tempo: '05:00', Convertido: 'Não' });
  shots.push({ sid: 'x2', Atleta: 'Mogi', Quarto: '3Q', Tempo: '05:00', Convertido: 'Sim' });
  const res = M.matchGame(shots, M.buildClipSet(allFiles(), rows), {});
  assert.equal(res.links.x1.status, S.MISSING);
  assert.equal(res.links.x2.status, S.NO_CLIPS);
  const none = M.matchGame(shots, M.buildClipSet([], null), {});
  assert.equal(none.links.x1.status, S.NO_CLIPS);
});

test('atleta do clipe desconhecido: não vincula, aponta o apelido e aceita alias', () => {
  const rows = csvRows();
  const rename = (a) => a === 'Leozão' ? 'Leonardo S.' : a;
  const shots = shotsFromCsv(rows, { rosterName: rename });
  const cs = () => M.buildClipSet(allFiles(), rows);
  const res = M.matchGame(shots, cs(), {});
  const leo = shots.filter(s => s.Atleta === 'Leonardo S.');
  assert.ok(leo.length > 0);
  leo.forEach(s => assert.equal(res.links[s.sid].status, S.UNRESOLVED));
  assert.ok(res.issues.some(i => i.type === 'unresolved-athlete' && i.athlete === 'Leozão'));
  shots.filter(s => s.Atleta !== 'Leonardo S.').forEach(s => assert.equal(res.links[s.sid].status, S.OK));
  const withAlias = M.matchGame(shots, cs(), { aliases: { 'leozao': 'Leonardo S.' } });
  assert.equal(withAlias.stats.ok, 29);
});

test('primeiro nome único resolve; primeiro nome ambíguo não', () => {
  const r1 = M.makeAthleteResolver(['Mogi Silva', 'Kuroba'], {});
  assert.equal(r1('Mogi').name, 'Mogi Silva');
  const r2 = M.makeAthleteResolver(['Arthur C.', 'Arthur M.'], {});
  assert.equal(r2('Arthur').name, null);
  assert.equal(r2('Arthur').how, 'ambiguous');
  assert.equal(r2('Arthur C.').name, 'Arthur C.');
});

test('clipe duplicado (mesmo atleta, quarto, tempo, resultado) bloqueia o grupo', () => {
  const rows = csvRows();
  const shots = shotsFromCsv(rows);
  const extra = { id: 'dup', name: 'Arremesso Errado #99 - Q2 06m47s - Mogi.mp4' };
  const res = M.matchGame(shots, M.buildClipSet(allFiles().concat([extra]), rows), {});
  shots.filter(s => s.Atleta === 'Mogi' && s._q === 'Q2' && s.Convertido === 'Não')
    .forEach(s => assert.equal(res.links[s.sid].status, S.DUPLICATE));
  assert.ok(res.issues.some(i => i.type === 'duplicate-clip'));
});

test('ordem dos vídeos incoerente com o log: vincula, mas marca "conferir"', () => {
  const rows = csvRows();
  // Troca os relógios de vídeo de dois clipes distantes (Bortoleto/Melão errados Q2) → sequência invertida
  const swap = { 'Arremesso Errado #12 - Q2 04m15s - Melão.mp4': 'Arremesso Errado #12 - Q2 12m40s - Melão.mp4' };
  const files = allFiles().map(f => swap[f.name] ? { ...f, name: swap[f.name] } : f);
  const rows2 = rows.map(r => /04m15s/.test(r.clipe) ? { ...r, relogio_jogo: '12m40s', clipe: r.clipe.replace('04m15s', '12m40s') } : r);
  const shots = shotsFromCsv(rows); // log original
  const res = M.matchGame(shots, M.buildClipSet(files, rows2), {});
  assert.ok(res.issues.some(i => i.type === 'order-mismatch'));
  assert.ok(Object.values(res.links).some(l => l.status === S.CHECK));
  // o arremesso invertido deixa de ser "ok" silencioso
  const melao = shots.find(s => s.Atleta === 'Melão' && s._src.includes('#12'));
  assert.equal(res.links[melao.sid].status, S.CHECK);
});

test('log e arquivos discordam (CSV × nome do arquivo): bloqueia o clipe', () => {
  const rows = csvRows().map(r => /#02 - Q1/.test(r.clipe) ? { ...r, atleta: 'Outro' } : r);
  const cs = M.buildClipSet(allFiles(), rows);
  assert.ok(cs.issues.some(i => i.type === 'csv-mismatch'));
  const bad = cs.clips.find(c => /#02 - Q1/.test(c.fileName));
  assert.equal(bad.flag, S.CONFLICT);
});

test('clipe não finalizado (status != READY) não é vinculado', () => {
  const rows = csvRows().map(r => /#14 - Q2/.test(r.clipe) ? { ...r, status: 'PENDING' } : r);
  const shots = shotsFromCsv(csvRows());
  const res = M.matchGame(shots, M.buildClipSet(allFiles(), rows), {});
  const leoQ2 = shots.filter(s => s.Atleta === 'Leozão' && s._q === 'Q2' && s.Convertido === 'Não');
  leoQ2.forEach(s => assert.equal(res.links[s.sid].status, S.CONFLICT));
});

test('exportação só do 1º quarto: Q1 vincula, demais quartos ficam "sem vídeo"', () => {
  const rows = M.parseCsv(fxQ1.csv);
  const files = fileList(fxQ1.files);
  const q1 = shotsFromCsv(rows);
  const q2 = [{ sid: 'q2a', Atleta: 'Mogi', Quarto: '2Q', Tempo: '04:00', Convertido: 'Não' }];
  const res = M.matchGame(q1.concat(q2), M.buildClipSet(files, rows), {});
  assert.equal(res.stats.ok, q1.length);
  assert.equal(res.links.q2a.status, S.NO_CLIPS);
  assert.ok(res.issues.some(i => i.type === 'numbering-gap'));
});

test('arquivos fora do padrão e não-vídeo', () => {
  const cs = M.buildClipSet([{ name: 'foto.jpg' }, { name: 'clip qualquer.mp4' }, ...allFiles()], null);
  assert.equal(cs.clips.length, 29);
  assert.ok(cs.issues.some(i => i.type === 'unparsed-file'));
});
