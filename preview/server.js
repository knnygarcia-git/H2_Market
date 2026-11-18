// Serves a local copy of the panel with a stand-in for the dashboard runtime (dash.data, dash.calc, dash.draw), for previewing and recording the demo.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f));
const datasets = Object.fromEntries(fs.readdirSync(path.join(ROOT, 'data')).filter((f) => f.endsWith('.json')).map((f) => [f.replace('.json', ''), ((d) => (Array.isArray(d) ? d : d.rows))(JSON.parse(read('data/' + f)))]));

const mock = `
<script>
(function () {
  const DATA = ${JSON.stringify(datasets)};
  const calcs = {}, cache = {}, draws = {};
  const get = (id) => {
    if (id in DATA) return DATA[id];
    if (id in cache) return cache[id];
    const c = calcs[id]; if (!c) return null;
    const ins = c.inputs.map(get);
    if (ins.some((x) => x == null)) return null;
    return (cache[id] = c.fn(...ins));
  };
  const run = (name) => document.querySelectorAll('[data-draw="' + name + '"]').forEach((el) => { if (!el.closest('[hidden]')) draws[name](el); });
  window.dash = {
    colors: [],
    calc: (id, def) => { calcs[id] = def; },
    loader: () => {},
    data: (id) => { const d = get(id); return d ? { status: 'ok', data: d, columns: Object.keys(d[0] || {}), meta: [] } : { status: 'loading', data: [] }; },
    onData: (fn) => { setTimeout(fn, 0); },
    draw: (name, fn) => { if (fn) draws[name] = fn; else if (draws[name]) run(name); },
    params: () => ({}), setParams: () => {}, resetParams: () => {}, setLink: () => {}, refresh: () => {},
  };
  const all = () => Object.keys(draws).forEach(run);
  window.addEventListener('load', () => setTimeout(all, 0));
  let t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(all, 100); });
})();
</script>`;

const extra = fs.existsSync(path.join(__dirname, 'overlay.html')) ? fs.readFileSync(path.join(__dirname, 'overlay.html'), 'utf8') : '';

const harness = () => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Global Hydrogen Market 2026</title>
<style>html, body { margin: 0; background: #fff; } body { font: 14px/1.5 system-ui, sans-serif; }</style>
<script src="/d3.js"></script>${mock}
</head><body>
<div id="dash-root">${fs.readFileSync(path.join(ROOT, 'dashboard/index.html'), 'utf8')}</div>
${extra}
</body></html>`;

const files = {
  '/d3.js': [path.join(ROOT, 'node_modules/d3/dist/d3.min.js'), 'text/javascript'],
  '/fonts.css': [path.join(ROOT, 'dashboard/fonts.css'), 'text/css'],
  '/me.jpg': [path.join(ROOT, 'assets/me.jpg'), 'image/jpeg'],
  '/_blob/3c13140c1875dee6d016c3a0d630744c': [path.join(ROOT, 'assets/me.jpg'), 'image/jpeg'],
};

http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(harness()); }
  const f = files[u];
  if (!f || !fs.existsSync(f[0])) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': f[1] }); res.end(fs.readFileSync(f[0]));
}).listen(8767, () => console.log('http://localhost:8767'));
