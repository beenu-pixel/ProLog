// Arkusz porównawczy: renderuje HTML z obrazami (siatka z podpisami) i zapisuje PNG.
// Użycie: node sheet.js out.png "Tytuł" kolumny=2 szer=360 plik1 "podpis1" plik2 "podpis2" ...
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

(async () => {
  const [, , outFile, title, colsArg, widthArg, ...rest] = process.argv;
  const cols = Number(colsArg) || 2;
  const width = Number(widthArg) || 360;
  const items = [];
  for (let i = 0; i < rest.length; i += 2) items.push({ file: rest[i], caption: rest[i + 1] || "" });
  const toData = (f) => `data:image/png;base64,${fs.readFileSync(f).toString("base64")}`;
  const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><style>
    body { margin: 0; padding: 24px; background: #e9eaec; font: 14px/1.4 "Segoe UI", system-ui, sans-serif; color: #16171a; }
    h1 { margin: 0 0 16px; font-size: 18px; font-weight: 600; }
    .g { display: grid; grid-template-columns: repeat(${cols}, ${width}px); gap: 20px 16px; align-items: start; }
    figure { margin: 0; }
    figcaption { margin: 0 0 6px; font-size: 13px; font-weight: 600; }
    img { display: block; width: ${width}px; height: auto; border-radius: 10px; box-shadow: 0 1px 2px rgba(0,0,0,.12), 0 6px 18px -8px rgba(0,0,0,.25); }
  </style></head><body>${title ? `<h1>${title}</h1>` : ""}<div class="g">${items
    .map((it) => `<figure><figcaption>${it.caption}</figcaption><img src="${toData(it.file)}"></figure>`)
    .join("")}</div></body></html>`;
  const browser = await chromium.launch({ channel: "msedge" });
  const page = await browser.newPage({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  const size = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }));
  await page.setViewportSize({ width: size.w, height: Math.min(size.h, 16000) });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  await page.screenshot({ path: outFile, fullPage: true });
  await browser.close();
  console.log(`ok ${outFile} (${size.w}x${size.h})`);
})();
