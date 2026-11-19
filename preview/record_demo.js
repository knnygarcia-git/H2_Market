// Records the dashboard walkthrough (title card, chapters, spotlighted charts, captions) as a 1080p MP4; run `node preview/server.js` first.
// Usage: node preview/record_demo.js [output.mp4]
const { chromium } = require('playwright');
const fs = require('fs');
const { spawn, execFileSync } = require('child_process');

const R = JSON.parse(fs.readFileSync(__dirname + '/captions.json', 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.argv[2] || __dirname + '/../docs/demo.mp4';

// where the page should sit when each chapter curtain lifts
const AFTER_CHAPTER = { ch1: ['#headline', 90], ch2: ['#world .worldgrid', 16], ch3: ['#funnel', 16], ch4: ['#cost', 16], ch5: ['#brazil', 16] };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
  const page = await ctx.newPage();
  // Stream Chrome's screencast frames into ffmpeg at a constant 30 fps, repeating the last frame while the page is still.
  const FPS = 30;
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-vf', 'scale=1920:1080:flags=lanczos', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', '-pix_fmt', 'yuv420p', OUT + '.tmp.mp4']);
  let last = null, written = 0, f0 = null;
  const fill = (sec) => { const target = Math.floor(sec * FPS); while (last && written < target) { ff.stdin.write(last); written++; } };
  const cdp = await ctx.newCDPSession(page);
  cdp.on('Page.screencastFrame', async (f) => {
    const now = Date.now() / 1000; if (f0 === null) f0 = now;
    fill(now - f0); last = Buffer.from(f.data, 'base64');
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch (e) {}
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  await page.goto('http://localhost:8767/?demo');
  await page.waitForTimeout(1500);

  const ev = (fn, arg) => page.evaluate(fn, arg);
  const cap = (r) => ev((r) => { document.getElementById('cap').innerHTML = r.cap ? (r.ch ? `<span class="ch">${r.ch}</span>` : '') + `<span>${r.cap}</span>` : ''; }, r);
  const show = (id, on) => ev(([id, on]) => document.getElementById(id).classList.toggle('off', !on), [id, on]);
  const scrollTo = (sel, off = 24, ms = 1300) => ev(([sel, off, ms]) => new Promise((done) => {
    const el = sel ? document.querySelector(sel) : null;
    const to = el ? el.getBoundingClientRect().top + window.scrollY - off : 0, from = window.scrollY, t0 = performance.now();
    if (!ms) { window.scrollTo(0, to); return done(); }
    const step = (t) => { const k = Math.min(1, (t - t0) / ms), e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; window.scrollTo(0, from + (to - from) * e); k < 1 ? requestAnimationFrame(step) : done(); };
    requestAnimationFrame(step);
  }), [sel, off, ms]);
  const spot = (sel, pad = 10) => ev(([sel, pad]) => { const s = document.getElementById('vspot');
    if (!sel) { s.classList.remove('on'); return; }
    const r = document.querySelector(sel).getBoundingClientRect();
    Object.assign(s.style, { top: (r.top - pad) + 'px', left: (r.left - pad) + 'px', width: (r.width + 2 * pad) + 'px', height: (r.height + 2 * pad) + 'px' });
    s.classList.add('on'); }, [sel, pad]);
  const box = (sel) => ev((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }, sel);
  const center = async (sel) => { const b = await box(sel); return [b[0] + b[2] / 2, b[1] + b[3] / 2]; };
  const move = async ([x, y], steps = 25) => { await page.mouse.move(x, y, { steps }); };
  const cCenter = (name) => ev((name) => {
    const p = [...document.querySelectorAll('[data-draw="worldmap"] path.c')].find((n) => n.__data__ && n.__data__.country === name);
    const b = p.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2];
  }, name);
  const hoverCountries = async (names, pause) => { for (const n of names) { await move(await cCenter(n), 22); await sleep(pause); } };
  const click = async (sel) => { await move(await center(sel), 20); await sleep(200); await page.click(sel); };
  const sweep = async (sel, xs, ys, pause) => { const b = await box(sel); for (let i = 0; i < xs.length; i++) { await move([b[0] + b[2] * xs[i], b[1] + b[3] * ys[i]], 18); await sleep(pause); } };

  const chapter = async (r) => {
    await spot(null); await page.mouse.move(640, -10);
    await ev(([n, k, h]) => { const c = document.getElementById('chap'); c.querySelector('.n').textContent = n; c.querySelector('.k').textContent = k; c.querySelector('h2').textContent = h; }, r.chap);
    await show('chap', true);
    await sleep(r.dur * 1000 - 700);
    const [sel, off] = AFTER_CHAPTER[r.id]; await scrollTo(sel, off, 0);
    await show('chap', false);
  };

  const actions = {
    title: async (r) => { await sleep(r.dur * 1000 - 800); },
    kpis: async () => { await show('card', false); await show('badge', true); await spot('#headline');
      const k = await page.$$eval('.kpi', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }));
      for (const c of k) { await move(c, 28); await sleep(1700); } },
    trend: async () => { await spot(null); await scrollTo('#trend', 20, 1000); await spot('#trend > section.card');
      await sweep('[data-draw="trendarea"]', [.4], [.5], 1200); await click('[data-trend="supply"]'); await sleep(1200); await sweep('[data-draw="trendarea"]', [.5, .85], [.4, .5], 1700); },
    growth: async () => { await spot('#growth'); await sweep('[data-draw="arrows"]', [.5, .5, .5], [.2, .45, .7], 2000); },
    map_urea: async () => { await spot('#world .worldgrid'); await hoverCountries(['Brazil', 'Australia', 'South Africa', 'Brazil'], 2200); },
    map_search: async () => { await spot(null); await scrollTo('#world', 12, 900); await click('[data-lens="ammonia"]'); await sleep(700);
      await spot('#world .worldgrid'); await hoverCountries(['Morocco', 'South Korea'], 1600); await spot(null);
      await scrollTo(null, 0, 900); await click('#country-search'); await page.keyboard.type('moro', { delay: 150 }); await sleep(400); await page.keyboard.press('Enter'); await sleep(1500);
      await spot('#world .worldgrid'); },
    funnel: async () => { await spot('#funnel .funnel'); await sweep('[data-draw="funnelchart"]', [.5, .5, .5, .5], [.15, .4, .65, .88], 1800); },
    clock: async () => { await spot(null); await scrollTo('#funnel .insight', 380, 800); await spot('#funnel .insight', 8); await move(await center('#funnel .insight p'), 25); await sleep(1500); await move(await center('#funnel .insight a'), 25); },
    race: async () => { await spot(null); await scrollTo('#race', 16); await spot('#race .grid2 > .card:first-child');
      await sweep('[data-draw="race"]', [.4, .3], [.2, .45], 1300); await click('[data-year="2026"]'); await spot('#race .grid2 > .card:first-child'); await sleep(1300); await sweep('[data-draw="race"]', [.4, .3], [.2, .45], 1400); },
    factories: async () => { await spot('#race .grid2 > .card:nth-child(2)'); await sweep('[data-draw="factories"]', [.25, .55, .85], [.5, .45, .4], 1900); },
    cost: async () => { await spot('#cost .card'); await sweep('[data-draw="costarrows"]', [.4, .4, .5], [.1, .5, .85], 2300); },
    brazil: async () => { await spot('#brazil .bfacts'); await sweep('#brazil .bfacts', [.12, .37, .62, .87, .12], [.25, .25, .25, .25, .8], 1900); },
    cta: async (r) => { await spot(null); await page.mouse.move(640, -10); await show('badge', false); await show('cta', true); await sleep(r.dur * 1000 - 500); },
    outro: async () => { await show('outro', true); await sleep(600); await show('cta', false); },
  };

  const v0 = Date.now();
  for (const r of R) {
    const t0 = Date.now();
    await cap(r);
    if (r.chap) await chapter(r); else await actions[r.id](r);
    const left = t0 + r.dur * 1000 + (r.chap ? 0 : 500) - Date.now();
    if (left > 0) await sleep(left);
  }
  await sleep(1500);
  const total = (Date.now() - v0) / 1000;
  await cdp.send('Page.stopScreencast');
  fill(Date.now() / 1000 - f0);
  await ctx.close(); await browser.close();
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  // final pass: drop the page-load second and encode for sharing
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '1.6', '-i', OUT + '.tmp.mp4', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-tune', 'stillimage',
    '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT]);
  fs.unlinkSync(OUT + '.tmp.mp4');
  console.log(OUT, total.toFixed(1), written);
})();
