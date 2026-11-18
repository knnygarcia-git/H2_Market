// Records the panel walkthrough with on-screen captions as a 1080p MP4; run `node preview/server.js` first.
// Usage: node preview/record_demo.js [output.mp4]
const { chromium } = require('playwright');
const fs = require('fs');
const { spawn, execFileSync } = require('child_process');

const R = JSON.parse(fs.readFileSync(__dirname + '/captions.json', 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.argv[2] || __dirname + '/../docs/demo.mp4';

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
  await page.goto('http://localhost:8767/');
  await page.waitForTimeout(1500);

  const cap = (t) => page.evaluate((t) => { document.getElementById('cap').textContent = t; }, t);
  const scrollTo = (sel, off = 24, ms = 1400) => page.evaluate(([sel, off, ms]) => new Promise((done) => {
    const el = sel ? document.querySelector(sel) : null;
    const to = el ? el.getBoundingClientRect().top + window.scrollY - off : 0, from = window.scrollY, t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / ms), e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; window.scrollTo(0, from + (to - from) * e); k < 1 ? requestAnimationFrame(step) : done(); };
    requestAnimationFrame(step);
  }), [sel, off, ms]);
  const box = (sel) => page.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }, sel);
  const center = async (sel) => { const b = await box(sel); return [b[0] + b[2] / 2, b[1] + b[3] / 2]; };
  const move = async ([x, y], steps = 25) => { await page.mouse.move(x, y, { steps }); };
  const cCenter = (name) => page.evaluate((name) => {
    const p = [...document.querySelectorAll('[data-draw="worldmap"] path.c')].find((n) => n.__data__ && n.__data__.country === name);
    const b = p.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2];
  }, name);
  const hoverCountries = async (names, pause) => { for (const n of names) { await move(await cCenter(n), 22); await sleep(pause); } };
  const click = async (sel) => { await move(await center(sel), 20); await sleep(200); await page.click(sel); };
  const sweep = async (sel, xs, ys, pause) => { const b = await box(sel); for (let i = 0; i < xs.length; i++) { await move([b[0] + b[2] * xs[i], b[1] + b[3] * ys[i]], 18); await sleep(pause); } };

  const actions = {
    intro: async () => { await sleep(R[0].dur * 1000 - 900); await page.evaluate(() => { document.getElementById('card').classList.add('off'); document.getElementById('badge').classList.remove('off'); }); },
    kpis: async () => { const k = await page.$$eval('.kpi', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }));
      for (const c of k) { await move(c, 28); await sleep(1900); } },
    trend: async () => { await scrollTo('#trend', 20, 1000); await sweep('[data-draw="trendarea"]', [.3, .7], [.5, .5], 1600); await click('[data-trend="supply"]'); await sleep(1200); await sweep('[data-draw="trendarea"]', [.5, .85], [.4, .5], 1600); },
    growth: async () => { await sweep('[data-draw="arrows"]', [.5, .5, .5], [.2, .45, .7], 2200); },
    gauges: async () => { await scrollTo('#gauges', 20); await sweep('#gauges .gl', [.12, .37, .62, .88], [.4, .4, .4, .4], 1700); },
    map_urea: async () => { await scrollTo('#world', 16); await hoverCountries(['Brazil', 'India', 'Australia', 'South Africa'], 2200); },
    map_search: async () => { await click('[data-lens="ammonia"]'); await sleep(900); await hoverCountries(['Morocco', 'South Korea'], 1800);
      await scrollTo(null, 0, 900); await click('#country-search'); await page.keyboard.type('moro', { delay: 160 }); await sleep(500); await page.keyboard.press('Enter'); await sleep(1800); },
    map_targets: async () => { await click('[data-lens="targets"]'); await sleep(900); await hoverCountries(['Germany', 'Japan', 'Chile'], 2000); },
    funnel: async () => { await scrollTo('#funnel', 20); await sweep('[data-draw="funnelchart"]', [.5, .5, .5, .5], [.15, .4, .65, .88], 1900); },
    race: async () => { await scrollTo('#race', 20); await sweep('[data-draw="race"]', [.4, .3], [.2, .45], 1500); await click('[data-year="2026"]'); await sleep(1300); await sweep('[data-draw="race"]', [.4, .3], [.2, .45], 1500); },
    factories: async () => { await sweep('[data-draw="factories"]', [.25, .55, .85], [.5, .45, .4], 2000); },
    regions: async () => { await scrollTo('#regions', 20); await sweep('[data-draw="bubbles"]', [.45, .7, .5], [.45, .45, .7], 1800); await sweep('#region-table tbody', [.5, .5], [.06, .3], 1500); },
    cost: async () => { await scrollTo('#cost', 20); await sweep('[data-draw="costarrows"]', [.4, .4, .5], [.1, .5, .85], 2400); },
    money: async () => { await sweep('[data-draw="investarea"]', [.4, .7, .9], [.6, .5, .4], 2000); },
    brazil: async () => { await scrollTo('#brazil', 20); await sweep('#brazil', [.12, .37, .62, .87], [.62, .62, .62, .62], 2000); },
    outro: async () => { await page.mouse.move(1, 1); await page.evaluate(() => {
      const c = document.getElementById('card');
      document.getElementById('badge').classList.add('off');
      c.innerHTML = `<div class="prof"><span class="k">Built by</span><img src="/me.jpg" alt="Kenny Yusimy Garcia Angarita">
        <span class="nm">Kenny Yusimy Garcia Angarita</span>
        <span class="hl">Data Analyst · SQL · Python · Power BI · Azure · CRM, Retail & Predictive Analytics · Turning data into business decisions</span>
        <span class="url"><span class="li">in</span>linkedin.com/in/kennyyusimygarciaangarita</span></div>
        <p class="src">Source: IEA (2026), Global Hydrogen Review 2026, CC BY 4.0 · Chart values read from the report's figures</p>`;
      c.classList.remove('off');
    }); },
  };

  const v0 = Date.now();
  for (const r of R) {
    const t0 = Date.now();
    await cap(r.cap);
    await actions[r.id]();
    const left = t0 + r.dur * 1000 + 700 - Date.now();
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
