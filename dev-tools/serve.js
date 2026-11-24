// Servidor de teste: / -> repo do site ; /assets/ -> clipes de teste (com suporte a Range)
const http = require('http'), fs = require('fs'), path = require('path');
const SITE = path.resolve(process.argv[2]), ASSETS = path.resolve(process.argv[3]), PORT = +process.argv[4] || 8765;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.mp4': 'video/mp4', '.css': 'text/css', '.md': 'text/plain; charset=utf-8' };
http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  let base = SITE;
  if (u.startsWith('/assets/')) { base = ASSETS; u = u.slice(7); }
  const f = path.join(base, u === '/' ? 'index.html' : u);
  if (!f.startsWith(base) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
  const size = fs.statSync(f).size, t = types[path.extname(f)] || 'application/octet-stream';
  const m = (req.headers.range || '').match(/bytes=(\d*)-(\d*)/);
  if (m) {
    const s = m[1] ? +m[1] : 0, e = m[2] ? +m[2] : size - 1;
    res.writeHead(206, { 'Content-Type': t, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${s}-${e}/${size}`, 'Content-Length': e - s + 1 });
    fs.createReadStream(f, { start: s, end: e }).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': t, 'Accept-Ranges': 'bytes', 'Content-Length': size });
    fs.createReadStream(f).pipe(res);
  }
}).listen(PORT, () => console.log('listening', PORT));
