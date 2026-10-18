// Capture the product-mock element from local quest-330 demo pages into film/assets/screens/<name>.png
// usage: node tools/screens-from-html.mjs <name>=<path.html> [...]
// Picks the largest element in the right half of a 1920x1200 viewport (the mock), clips it with 24px padding at 4x.
import puppeteer from 'puppeteer';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const pairs = process.argv.slice(2).map(a => { const [n, p] = a.split('='); return { n, p }; });
const browser = await puppeteer.launch({ headless: true });
for (const { n, p } of pairs) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1200, deviceScaleFactor: 4 });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.goto(pathToFileURL(path.resolve(p)).href, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 2500));
  const box = await page.evaluate(() => {
    let best = null;
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.left < 900 || r.width < 350 || r.height < 250 || r.width > 1000) continue;
      const a = r.width * r.height;
      if (!best || a > best.a) best = { a, x: r.left, y: r.top, w: r.width, h: r.height };
    }
    return best;
  });
  if (!box) { console.log(`${n}: no mock element found`); continue; }
  const pad = 24;
  const out = path.resolve('film/assets/screens', `${n}.png`);
  await page.screenshot({ path: out, clip: { x: box.x - pad, y: box.y - pad, width: box.w + 2 * pad, height: box.h + 2 * pad } });
  console.log(`${n}: ${Math.round(box.w)}x${Math.round(box.h)} css px -> ${out}`);
  await page.close();
}
await browser.close();
