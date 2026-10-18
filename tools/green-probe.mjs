import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ headless: true }); const p = await b.newPage();
await p.setViewport({ width: 1920, height: 1200 });
await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
for (const f of ['forgent-step-finden/finden.html', 'forgent-step-qualifizieren/qualifizieren.html']) {
  await p.goto('file:///Users/tom/Downloads/' + f, { waitUntil: 'networkidle0' }); await new Promise(r => setTimeout(r, 2000));
  const r = await p.evaluate(() => {
    const c = document.createElement('canvas').getContext('2d'); const out = {};
    for (const el of document.querySelectorAll('*')) {
      const t = el.textContent.trim(); if (!/^(100 ?%|Empfehlung: Bid)$/.test(t)) continue;
      const cs = getComputedStyle(el); if (cs.backgroundColor === 'rgba(0, 0, 0, 0)') continue;
      c.clearRect(0,0,1,1); c.fillStyle = cs.backgroundColor; c.fillRect(0,0,1,1); const d = c.getImageData(0,0,1,1).data;
      out[t + ' | ' + el.className.toString().slice(0,60)] = cs.backgroundColor + ' -> #' + [d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
    }
    return out;
  });
  console.log(f, JSON.stringify(r, null, 1));
}
await b.close();
