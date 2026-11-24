// Uso: node shot.js <largura> <saidaDir> <acao1> <acao2> ...
// ações: login | selector | tab:<id> | jogador:<nome> | game:<n> | eval:<js> | wait:<ms> | save:<arquivo>
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const W = +process.argv[2], OUT = process.argv[3], acts = process.argv.slice(4);
const PORT = 9333 + Math.floor(Math.random() * 300);
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--remote-debugging-port=' + PORT, '--no-first-run', '--disable-gpu', '--hide-scrollbars',
  '--user-data-dir=' + path.join(OUT, 'profile-' + PORT), `--window-size=${W},900`, 'about:blank'
], { stdio: 'ignore' });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  let targets;
  for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (targets.length) break; } catch (e) {} await sleep(250); }
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  let id = 0; const pending = {};
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && pending[d.id]) { pending[d.id](d); delete pending[d.id]; } });
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJs = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) console.log('EXC', JSON.stringify(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description || r.result.exceptionDetails).slice(0, 300)); return r.result.result && r.result.result.value; };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: 900, deviceScaleFactor: 1, mobile: W < 700 });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "window.__errs=[];window.addEventListener('error',e=>window.__errs.push(e.message+' @'+e.lineno+':'+e.colno));" });
  await send('Page.navigate', { url: 'http://localhost:8767/index.html' });
  await sleep(1500);
  const save = async (name) => {
    const h = await evalJs('Math.max(document.documentElement.scrollHeight,document.body.scrollHeight,innerHeight)');
    const full = Math.min(h || 900, 3600);
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: full, deviceScaleFactor: 1, mobile: W < 700 });
    await sleep(250);
    const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, 'base64'));
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: 900, deviceScaleFactor: 1, mobile: W < 700 });
    console.log('saved', name, 'h=' + full);
  };
  for (const a of acts) {
    const [k, ...rest] = a.split(':'); const v = rest.join(':');
    if (k === 'login') { }
    else if (k === 'selector') { await evalJs("(async()=>{await new Promise((res,rej)=>{const s=document.createElement('script');s.src='/assets/fake-data.js';s.onload=res;s.onerror=rej;document.head.appendChild(s)});__enter();})()"); await sleep(500); }
    else if (k === 'generate') { await evalJs("document.getElementById('gs-gen-btn').click()"); await sleep(900); }
    else if (k === 'tab') { await evalJs(`showTab('${v}')`); await sleep(1400); }
    else if (k === 'jogador') { await evalJs(`SEL.plr='${v}';showTab('jogador')`); await sleep(1400); }
    else if (k === 'game') { await evalJs(`selectGame(${v})`); await sleep(1400); }
    else if (k === 'eval') { const r = await evalJs(v); if (r !== undefined) console.log('eval →', JSON.stringify(r).slice(0, 400)); await sleep(500); }
    else if (k === 'audit') { await evalJs("new Promise((res,rej)=>{const s=document.createElement('script');s.src='/assets/audit.js';s.onload=res;s.onerror=rej;document.head.appendChild(s)})"); const r = await evalJs("JSON.stringify(__audit())"); console.log('AUDIT '+v+' →', r); }
    else if (k === 'tab_key') { for (let i = 0; i < +v; i++) { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }); } const r = await evalJs("(()=>{const e=document.activeElement;const c=getComputedStyle(e);return JSON.stringify({tag:e.tagName,cls:e.className,txt:(e.textContent||'').trim().slice(0,20),focusVisible:e.matches(':focus-visible'),outline:c.outlineStyle+' '+c.outlineWidth+' '+c.outlineColor})})()"); console.log('FOCUS', r); }
    else if (k === 'wait') await sleep(+v);
    else if (k === 'save') await save(v);
    else if (k === 'view') { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, v), Buffer.from(r.result.data, 'base64')); console.log('view', v); }
  }
  const errs = await evalJs('JSON.stringify(window.__errs)'); console.log('errors:', errs);
  ws.close(); chrome.kill();
  setTimeout(() => process.exit(0), 300);
})().catch(e => { console.log('FAIL', e); chrome.kill(); process.exit(1); });
