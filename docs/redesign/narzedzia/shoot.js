// Zrzuty ekranów jednej wersji aplikacji. BASE=http://localhost:3000 OUT=katalog
// ONLY=scena1,scena2 (opcjonalnie) THEMES=dark,light DEVICES=phone,desktop
const fs = require("fs");
const path = require("path");
const { open, login, settle, close, wait, hydrated } = require("./harness");

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = process.env.OUT || path.join(__dirname, "out");
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
const THEMES = (process.env.THEMES || "dark,light").split(",");
const DEVS = (process.env.DEVICES || "phone,desktop").split(",");
fs.mkdirSync(OUT, { recursive: true });

const daysAgoLabel = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "long" });
};

const SCENES = [
  { name: "dziennik-dzis", devices: ["phone", "desktop"], run: async (p) => { await p.goto(`${BASE}/entries`); await hydrated(p); } },
  {
    name: "dziennik-wpis", devices: ["phone"], run: async (p) => {
      await p.goto(`${BASE}/entries`); await hydrated(p);
      await settle(p, 400);
      await p.getByRole("button", { name: new RegExp(daysAgoLabel(2)) }).first().click();
    },
  },
  {
    name: "dziennik-wybrany", devices: ["desktop"], run: async (p) => {
      await p.goto(`${BASE}/entries`); await hydrated(p);
      await settle(p, 400);
      await p.locator('aside a[href^="/entries/"]').first().click();
      await p.waitForURL(/\/entries\/.+/);
    },
  },
  {
    name: "dziennik-pisanie", devices: ["phone"], run: async (p) => {
      await p.goto(`${BASE}/entries`); await hydrated(p);
      await settle(p, 400);
      const field = p.getByRole("textbox", { name: "Notatka do nowego wpisu" });
      await field.click();
      await field.fill("Spokojny dzień, krótki spacer po pracy.");
    },
  },
  {
    name: "wiecej", devices: ["phone"], run: async (p) => {
      await p.goto(`${BASE}/entries`); await hydrated(p);
      await settle(p, 400);
      await p.getByRole("button", { name: "Więcej" }).click();
      await wait(450);
    },
  },
  {
    name: "wczytywanie", devices: ["phone", "desktop"], login: true, delays: { entries: 8000 }, run: async (p) => {
      await login(p, BASE);
      await wait(600);
    },
  },
  { name: "zalogowany", devices: ["phone", "desktop"], login: true, run: async (p) => { await login(p, BASE); await wait(800); } },
  { name: "ustawienia", devices: ["phone", "desktop"], run: async (p) => { await p.goto(`${BASE}/settings`); await hydrated(p); } },
  { name: "statystyki", devices: ["phone", "desktop"], run: async (p) => { await p.goto(`${BASE}/stats`); await hydrated(p); } },
  { name: "rozmowa", devices: ["phone", "desktop"], login: true, run: async (p) => { await login(p, BASE); await p.goto(`${BASE}/chat`); await hydrated(p); } },
  { name: "nowy-wpis", devices: ["phone", "desktop"], run: async (p) => { await p.goto(`${BASE}/new`); await hydrated(p); } },
  { name: "dokumentacja", devices: ["phone", "desktop"], run: async (p) => { await p.goto(`${BASE}/docs`); await hydrated(p); } },
  { name: "cennik", devices: ["phone", "desktop"], run: async (p) => { await p.goto(`${BASE}/pricing`); await hydrated(p); } },
  { name: "logowanie", devices: ["phone", "desktop"], run: async (p) => { await p.goto(`${BASE}/welcome`); await hydrated(p); } },
  { name: "landing", devices: ["phone", "desktop"], settle: 2500, run: async (p) => { await p.goto(`${BASE}/`); await hydrated(p); } },
];

(async () => {
  for (const scene of SCENES) {
    if (ONLY && !ONLY.includes(scene.name)) continue;
    for (const device of scene.devices) {
      if (!DEVS.includes(device)) continue;
      for (const theme of THEMES) {
        const file = path.join(OUT, `${scene.name}__${device}__${theme}.png`);
        const { ctx, page } = await open({ device, dark: theme === "dark", delays: scene.delays });
        try {
          await scene.run(page);
          await settle(page, scene.settle ?? 700);
          await page.screenshot({ path: file });
          console.log(`ok   ${path.basename(file)}`);
        } catch (e) {
          console.log(`FAIL ${path.basename(file)}: ${String(e.message || e).split("\n")[0]}`);
        } finally {
          await ctx.close();
        }
      }
    }
  }
  await close();
})();
