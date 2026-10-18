// Record the autoplaying quest-330 mock animations as video clips, cropped to the mock element.
// usage: node tools/clips-from-html.mjs <seconds> <name>=<page-auto.html> [...]  -> film/assets/screens/<name>.webm
import puppeteer from 'puppeteer';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const secs = Number(process.argv[2]);
const pairs = process.argv.slice(3).map(a => { const [n, p] = a.split('='); return { n, p }; });
const browser = await puppeteer.launch({ headless: true });
for (const { n, p } of pairs) {
  const page = await browser.newPage();
  const Z = 2.5;  // screencast records CSS pixels at 1x, so zoom the page instead of deviceScaleFactor
  await page.setViewport({ width: 1920 * Z, height: 1200 * Z, deviceScaleFactor: 1 });
  const zoom = () => page.evaluate(z => { document.documentElement.style.zoom = z; }, Z);
  await page.goto(pathToFileURL(path.resolve(p)).href, { waitUntil: 'networkidle0' });
  await zoom();
  const box = await page.evaluate(() => {
    let best = null;
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.left < 900 * 2.5 || r.width < 350 * 2.5 || r.height < 250 * 2.5 || r.width > 1000 * 2.5) continue;
      const a = r.width * r.height; if (!best || a > best.a) best = { a, x: r.left, y: r.top, w: r.width, h: r.height };
    }
    return best;
  });
  const pad = 24 * Z, even = v => Math.round(v / 2) * 2;
  // reload so the recording starts at t=0 of the animation
  const out = path.resolve('film/assets/screens', `${n}.webm`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await zoom();
  const rec = await page.screencast({ path: out, crop: { x: Math.round(box.x - pad), y: Math.round(box.y - pad), width: even(box.w + 2 * pad), height: even(box.h + 2 * pad) } });
  await new Promise(r => setTimeout(r, secs * 1000));
  await rec.stop();
  console.log(`${n}: ${secs}s -> ${out}`);
  await page.close();
}
await browser.close();
