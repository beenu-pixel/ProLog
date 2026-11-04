// GIF-y animacji. Animacje CSS są zwalniane przez DevTools (Animation.setPlaybackRate),
// klatki zbierane zrzutami, a opóźnienia klatek przeliczane na czas animacji — GIF
// odtwarza się w prawdziwym tempie. BASE, OUT, ONLY=menu,day,progress, LABEL=jest|ma-byc
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");
const { GIFEncoder, quantize, applyPalette } = require("gifenc");
const { open, close, hydrated, wait } = require("./harness");

const BASE = process.env.BASE || "http://localhost:3102";
const OUT = process.env.OUT || path.join(__dirname, "out", "gif");
const LABEL = process.env.LABEL || "ma-byc";
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
const RATE = 0.4;
fs.mkdirSync(OUT, { recursive: true });

const daysAgoLabel = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toLocaleDateString("pl-PL", { day: "numeric", month: "long" }); };

async function record(page, action, { after = 900, before = 250, clip, rate = RATE, interval = 0 }) {
  const client = await page.context().newCDPSession(page);
  await client.send("Animation.enable");
  await client.send("Animation.setPlaybackRate", { playbackRate: rate });
  const frames = [];
  let running = true;
  const loop = (async () => {
    while (running) {
      const t = Date.now();
      frames.push({ t, buf: await page.screenshot({ clip }) });
      if (interval) await wait(Math.max(0, interval - (Date.now() - t)));
    }
  })();
  await wait(before);
  await action();
  await wait(after);
  running = false;
  await loop;
  return frames.map((f, i) => {
    const next = frames[i + 1] ? frames[i + 1].t : f.t + 600 / rate;
    return { buf: f.buf, delay: Math.max(20, Math.round((next - f.t) * rate)) };
  });
}

function writeGif(file, frames) {
  const gif = GIFEncoder();
  for (const f of frames) {
    const { data, width, height } = PNG.sync.read(f.buf);
    const palette = quantize(data, 64);
    gif.writeFrame(applyPalette(data, palette), width, height, { palette, delay: f.delay });
  }
  gif.finish();
  fs.writeFileSync(file, gif.bytes());
  console.log(`ok   ${path.basename(file)} (${frames.length} klatek, ${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
}

const SCENES = {
  // Menu „Więcej”: skąd przychodzi i jak szybko.
  async menu(dark) {
    const { ctx, page } = await open({ device: "phone", dark, dpr: 1 });
    await page.goto(`${BASE}/entries`); await hydrated(page); await wait(600);
    const frames = await record(page, () => page.getByRole("button", { name: "Więcej" }).click(), { clip: { x: 0, y: 372, width: 375, height: 440 }, after: 900 });
    writeGif(path.join(OUT, `menu-wiecej__${LABEL}__${dark ? "dark" : "light"}.gif`), frames);
    await ctx.close();
  },
  // Zmiana dnia w pasku: krótkie pojawienie się treści.
  async day(dark) {
    const { ctx, page } = await open({ device: "phone", dark, dpr: 1 });
    await page.goto(`${BASE}/entries`); await hydrated(page); await wait(600);
    const frames = await record(page, () => page.getByRole("button", { name: new RegExp(daysAgoLabel(1)) }).first().click(), { clip: { x: 0, y: 0, width: 375, height: 520 }, after: 700 });
    writeGif(path.join(OUT, `zmiana-dnia__${LABEL}__${dark ? "dark" : "light"}.gif`), frames);
    await ctx.close();
  },
  // Pasek ładowania przy przejściu z kodu (notatka z pola → nowy wpis). Odpowiedź
  // serwera dla /new (także prefetch) jest celowo spowolniona, żeby było widać,
  // co się dzieje, zanim strona przyjdzie.
  async progress(dark) {
    const { ctx, page } = await open({ device: "phone", dark, dpr: 1 });
    await page.route(/\/new(\?|$)/, async (route) => { await wait(2500); await route.continue(); });
    await page.goto(`${BASE}/entries`); await hydrated(page); await wait(600);
    const field = page.getByRole("textbox", { name: "Notatka do nowego wpisu" });
    await field.click();
    await field.fill("Krótki spacer po pracy.");
    await wait(300);
    // Czy pasek faktycznie się pokazał (pomiar, nie tylko obraz).
    const seen = page.waitForSelector('[role="progressbar"][aria-label="Ładowanie strony"]', { timeout: 2000 }).then(() => true, () => false);
    const frames = await record(page, () => field.press("Enter"), { clip: { x: 0, y: 0, width: 375, height: 812 }, after: 2200, rate: 1, interval: 90 });
    console.log(`  pasek ładowania po Enter (${LABEL}, ${dark ? "ciemny" : "jasny"}): ${(await seen) ? "widoczny" : "brak"}`);
    writeGif(path.join(OUT, `pasek-ladowania__${LABEL}__${dark ? "dark" : "light"}.gif`), frames);
    await ctx.close();
  },
};

(async () => {
  for (const [name, fn] of Object.entries(SCENES)) {
    if (ONLY && !ONLY.includes(name)) continue;
    for (const dark of [true, false]) {
      try { await fn(dark); } catch (e) { console.log(`FAIL ${name} ${dark ? "dark" : "light"}: ${String(e.message || e).split("\n")[0]}`); }
    }
  }
  await close();
})();
