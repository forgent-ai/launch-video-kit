// Frame-exact recording of an autoplaying mock page: a virtual clock replaces setTimeout / setInterval /
// requestAnimationFrame / performance.now / Date.now, and every CSS transition, CSS animation and WAAPI
// animation is paused and seeked to the virtual time before each screenshot. Every frame lands exactly
// 1/fps apart, unlike page.screencast, which captures on paint and drops frames (Tom 2026-10-23: the
// screencast Finden clip "doesn't move cleanly or smoothly").
// usage: node tools/clips-det.mjs <seconds> <fps> <name>=<page.html> [...]  -> film/assets/screens/<name>.frames/%04d.png
// FULL=1: a full-frame 1920x1080 scene page (no zoom, no crop) -> film/assets/scenes/<name>.frames/
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const secs = Number(process.argv[2]), fps = Number(process.argv[3]);
const pairs = process.argv.slice(4).map(a => { const [n, p] = a.split('='); return { n, p }; });

const CLOCK = () => {
  let now = 0, seq = 1;
  const timers = new Map(), rafs = new Map(), starts = new WeakMap();
  window.setTimeout = (fn, ms = 0, ...a) => { const i = seq++; timers.set(i, { t: now + Math.max(0, +ms || 0), fn, a, o: i }); return i; };
  window.clearTimeout = i => timers.delete(i);
  window.setInterval = (fn, ms = 0, ...a) => { const i = seq++; timers.set(i, { t: now + Math.max(1, +ms || 0), fn, a, every: Math.max(1, +ms || 0), o: i }); return i; };
  window.clearInterval = i => timers.delete(i);
  window.requestAnimationFrame = fn => { const i = seq++; rafs.set(i, fn); return i; };
  window.cancelAnimationFrame = i => rafs.delete(i);
  performance.now = () => now;
  const D0 = Date.now(); Date.now = () => D0 + now;
  const stamp = t => { for (const an of document.getAnimations()) if (!starts.has(an)) starts.set(an, t); };
  window.__clock = {
    now: () => now,
    advance(dt) {
      const end = now + dt;
      for (;;) {   // fire due timers in time order, stamping the animations each one starts at its own time
        let best = null, key = null;
        for (const [k, tm] of timers) if (tm.t <= end && (!best || tm.t < best.t || (tm.t === best.t && tm.o < best.o))) { best = tm; key = k; }
        if (!best) break;
        now = best.t;
        if (best.every) best.t += best.every; else timers.delete(key);
        try { typeof best.fn === 'function' ? best.fn(...best.a) : 0; } catch (e) { console.error(e); }
        stamp(now);
      }
      now = end;
      const r = [...rafs.values()]; rafs.clear(); r.forEach(fn => { try { fn(now); } catch (e) { console.error(e); } });
      stamp(now);
      for (const an of document.getAnimations()) {
        const s = starts.get(an);
        an.pause();
        an.currentTime = Math.max(0, now - s);
      }
    },
  };
};

const browser = await puppeteer.launch({ headless: true });
for (const { n, p } of pairs) {
  const page = await browser.newPage();
  const FULL = !!process.env.FULL, Z = FULL ? 1 : 2.5;   // same framing as clips-from-html.mjs: zoom the page, 1x device pixels
  await page.setViewport(FULL ? { width: 1920, height: 1080, deviceScaleFactor: 1 } : { width: 1920 * Z, height: 1200 * Z, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(CLOCK);
  if (!FULL) await page.evaluateOnNewDocument(z => { document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.zoom = z; }); }, Z);
  await page.goto(pathToFileURL(path.resolve(p)).href, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 800));   // real time: lets the IntersectionObserver start the timeline at virtual t=0
  const box = FULL ? null : await page.evaluate(() => {
    let best = null;
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.left < 900 * 2.5 || r.width < 350 * 2.5 || r.height < 250 * 2.5 || r.width > 1000 * 2.5) continue;
      const a = r.width * r.height; if (!best || a > best.a) best = { a, x: r.left, y: r.top, w: r.width, h: r.height };
    }
    return best;
  });
  const pad = 24 * Z, even = v => Math.round(v / 2) * 2;
  const clip = FULL ? { x: 0, y: 0, width: 1920, height: 1080 } : { x: Math.round(box.x - pad), y: Math.round(box.y - pad), width: even(box.w + 2 * pad), height: Math.min(even(box.h + 2 * pad), 1200 * Z - Math.round(box.y - pad)) };
  const dir = path.resolve(FULL ? 'film/assets/scenes' : 'film/assets/screens', `${n}.frames`);
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const N = Math.round(secs * fps);
  for (let i = 0; i < N; i++) {
    await page.evaluate(dt => window.__clock.advance(dt), i === 0 ? 0 : 1000 / fps);
    await page.screenshot({ path: path.join(dir, String(i).padStart(4, '0') + '.png'), clip });
  }
  console.log(`${n}: ${N} frames at ${fps} fps, ${clip.width}x${clip.height} -> ${dir}`);
  await page.close();
}
await browser.close();
