// ProLog na produkcji po scaleniu. Wyłącznie tryb gościa: bez logowania i bez wpisywania
// danych w formularz. Analityka jest blokowana w lib.js.
const { makeContext, attachLogs } = require("./lib");
const path = require("path");
const fs = require("fs");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = "https://prologapp.vercel.app";
const OUT = path.join(__dirname, "..", "tap", "prod");
fs.mkdirSync(OUT, { recursive: true });
let failed = 0;
const check = (ok, label, extra = "") => {
  if (!ok) failed += 1;
  console.log(`  ${ok ? "OK  " : "FAIL"} ${label}${extra ? ` | ${extra}` : ""}`);
};

(async () => {
  const cache = {};
  const log = { console: [], pageErrors: [], http: [], failed: [] };

  console.log("=== Telefon (Pixel 7), gość");
  const ctx = await makeContext(cache, { engine: "chromium", device: "Pixel 7" });
  const page = await ctx.newPage();
  attachLogs(page, log);

  await page.goto(`${BASE}/welcome`, { waitUntil: "load" });
  await wait(1200);
  const submit = page.getByRole("button", { name: "Zaloguj się", exact: true });
  const box = await submit.boundingBox();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
  await wait(150);
  check((await page.locator("[data-pressed]").count()) === 1, "palec na przycisku daje reakcję");
  await page.screenshot({ path: path.join(OUT, "1-wcisniety.png") });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  await wait(150);
  check((await page.locator("[data-pressed]").count()) === 0, "cofnięcie palca gasi reakcję, formularz nie wysłany", new URL(page.url()).pathname);

  await page.getByRole("link", { name: "Wejdź bez konta" }).tap();
  await page.waitForURL(/\/entries/, { timeout: 10000 });
  await wait(1200);
  check((await page.getByRole("status").filter({ hasText: "Wczytuję" }).count()) === 0, "gość nie zostaje na „Wczytuję”");
  await page.screenshot({ path: path.join(OUT, "2-dziennik-gosc.png") });

  await page.goto(`${BASE}/entries/nie-ma-takiego-wpisu`, { waitUntil: "load" });
  await wait(1500);
  const missing = page.getByText("Nie znaleziono wpisu.");
  check((await missing.count()) === 1, "nieistniejący wpis: uczciwy komunikat, bez wiecznego ładowania");
  const y = (await missing.boundingBox())?.y ?? 0;
  check(y > 200, "komunikat stoi na środku wolnego miejsca", `y=${Math.round(y)}`);
  await page.screenshot({ path: path.join(OUT, "3-brak-wpisu.png") });

  await page.goto(`${BASE}/settings?upgraded=pro`, { waitUntil: "load" });
  await wait(1200);
  check((await page.getByText(/Płatność przyjęta|masz plan/).count()) === 0, "gość nie widzi potwierdzenia płatności");
  check((await page.getByRole("heading", { name: "Plan i płatności" }).count()) === 0, "gość nie widzi panelu planu");
  check((await page.getByRole("link", { name: "Zaloguj się" }).count()) >= 1, "gość widzi „Zaloguj się”");

  await page.goto(`${BASE}/stats`, { waitUntil: "load" });
  await wait(1200);
  check((await page.getByText(/Wczytuję wpisy/).count()) === 0, "statystyki gościa bez „Wczytuję wpisy”");
  const report = page.getByRole("button", { name: /Raport tygodniowy/ });
  check(await report.isEnabled(), "gość: przycisk raportu działa");
  await report.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
  await report.tap();
  await page.waitForURL(/\/pricing/, { timeout: 10000 }).catch(() => {});
  check(new URL(page.url()).pathname === "/pricing", "gość: raport prowadzi do cennika", new URL(page.url()).pathname);
  await ctx.close();

  console.log("=== Komputer, gość");
  const desk = await makeContext(cache, { engine: "chromium", viewport: { width: 1440, height: 900 } });
  const d = await desk.newPage();
  attachLogs(d, log);
  await d.goto(`${BASE}/entries`, { waitUntil: "load" });
  await wait(1200);
  check((await d.getByRole("status").filter({ hasText: "Wczytuję" }).count()) === 0, "dziennik gościa bez „Wczytuję”");
  await d.getByRole("button", { name: "Konto" }).hover();
  await wait(250);
  check((await d.getByText("Nie jesteś zalogowany.").count()) === 1, "menu Konto działa");
  await d.screenshot({ path: path.join(OUT, "4-komputer.png") });
  await desk.close();

  console.log("=== Błędy");
  check(log.pageErrors.length === 0, "brak błędów strony", log.pageErrors.join(" ; ").slice(0, 300));
  console.log(`  konsola: ${log.console.length ? log.console.join(" ; ").slice(0, 400) : "czysto"}`);
  console.log(`  http>=400: ${log.http.length ? log.http.join(" ; ").slice(0, 400) : "brak"}`);

  for (const b of Object.values(cache)) await b.close();
  console.log(failed ? `\nWYNIK: ${failed} FAIL` : "\nWYNIK: wszystko OK");
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.log("BŁĄD:", e.message.split("\n").slice(0, 3).join(" ")); process.exit(1); });
