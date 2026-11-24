// Auditoria no navegador: roda por aba e imprime problemas de contraste, alvo clicável, foco e overflow
window.__audit = function () {
  const lum = (r, g, b) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const bgOf = (el) => { let e = el; while (e && e !== document.documentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0.5) return c; e = e.parentElement; } return { r: 244, g: 245, b: 242, a: 1 }; };
  const ratio = (a, b) => { const x = lum(a.r, a.g, a.b), y = lum(b.r, b.g, b.b); const [h, l] = x > y ? [x, y] : [y, x]; return (h + .05) / (l + .05); };
  const out = { contrast: [], small: [], noname: [], hscroll: document.documentElement.scrollWidth > innerWidth };
  const seen = new Set();
  document.querySelectorAll('#app-container *, #game-selector *, #login-overlay *').forEach(el => {
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || !el.offsetParent && cs.position !== 'fixed') return;
    const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) return;
    // texto direto
    const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (hasText) {
      const fg = parse(cs.color), bg = bgOf(el); if (fg && bg) {
        const cr = ratio(fg, bg), size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700;
        const large = size >= 24 || (size >= 18.66 && bold);
        if (cr < (large ? 3 : 4.5)) { const k = el.tagName + '|' + cs.color + '|' + (bg.r + ',' + bg.g + ',' + bg.b); if (!seen.has(k)) { seen.add(k); out.contrast.push(cr.toFixed(2) + ' ' + (el.textContent || '').trim().slice(0, 30) + ' [' + el.tagName + '.' + (el.className.baseVal === undefined ? el.className : '') + '] ' + cs.color + ' on rgb(' + bg.r + ',' + bg.g + ',' + bg.b + ') ' + size + 'px'); } }
      }
    }
    // alvos clicáveis
    if (/^(BUTTON|A|SELECT|INPUT)$/.test(el.tagName) || el.getAttribute('onclick')) {
      if ((r.height < 43.5 || r.width < 43.5) && !(el.tagName === 'INPUT' && el.type === 'hidden')) out.small.push(el.tagName + '.' + el.className + ' "' + (el.textContent || '').trim().slice(0, 20) + '" ' + Math.round(r.width) + 'x' + Math.round(r.height));
      if (el.tagName === 'BUTTON' && !(el.textContent || '').trim() && !el.getAttribute('aria-label')) out.noname.push(el.className);
    }
  });
  out.contrast = out.contrast.slice(0, 25); out.small = out.small.slice(0, 25);
  return out;
};
