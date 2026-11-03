// Przegląd: co użytkownik widzi, gdy czeka na aplikację. Serwer jest spowolniony i
// podstawiony, sesja i dane są testowe, żadne prawdziwe konto nie bierze w tym udziału.
const { makeContext } = require("./lib");
const path = require("path");
const fs = require("fs");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = "http://localhost:3102";
const OUT = path.join(__dirname, "..", "tap", "audit");
if (!process.env.ONLY) fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "*" };
const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: CORS, body: JSON.stringify(body) });
const note = (msg) => console.log(`  ${msg}`);
const USER = "00000000-0000-0000-0000-000000000000";

const session = () => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER, exp, role: "authenticated" })}.test`,
    token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "test",
    user: { id: USER, aud: "authenticated", role: "authenticated", email: "test@example.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
  };
};
const ENTRIES = () => [0, 1, 2].map((d) => ({
  id: `e${d}`, title: `Wpis testowy ${d + 1}`, content: "<p>Spokojny wieczór z książką.</p>", mood: 4, sleep: 4, energy: 3, productivity: 3, stress: 2,
  createdAt: new Date(Date.now() - d * 864e5).toISOString(),
}));
const PLAN = (tier) => ({ tier, status: "active", hasStripeCustomer: tier !== "free", currentPeriodEnd: null, cancelAtPeriodEnd: false, allowedPersonaIds: ["freud"] });

async function open(cache, o = {}) {
  const ctx = await makeContext(cache, o.desktop ? { engine: "chromium", viewport: { width: 1440, height: 900 } } : { engine: "chromium", device: "Pixel 7" });
  const page = await ctx.newPage();
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => {
    try {
      localStorage.setItem("prolog.soundEnabled", "0");
      localStorage.setItem("prolog.therapist.consent", "1");
      localStorage.setItem("prolog.therapist.enabled", "1");
    } catch {}
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => new AudioContext().createMediaStreamDestination().stream;
  });
  const d = o.delays || {};
  await page.route("https://placeholder.supabase.co/**", async (route) => {
    const url = route.request().url();
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (url.includes("/auth/v1/token")) return json(route, session());
    if (url.includes("/auth/v1/user")) return json(route, session().user);
    if (url.includes("/storage/v1/object/entry-photos") || url.includes("/storage/v1/object/")) {
      if (d.upload) await wait(d.upload);
      return json(route, { Key: "x", Id: "x" });
    }
    if (url.includes("/rest/v1/therapist")) {
      if (d.history) await wait(d.history);
      if (url.includes("therapist_conversations")) {
        const single = (route.request().headers().accept || "").includes("vnd.pgrst.object");
        return json(route, single ? { id: "c1" } : [{ id: "c1" }]);
      }
      return json(route, [{ id: "m1", role: "user", content: "Jak mi poszedł tydzień?", created_at: "2026-11-01T10:00:00Z" }, { id: "m2", role: "assistant", content: "Tydzień był spokojniejszy niż poprzedni.", created_at: "2026-11-01T10:00:05Z" }]);
    }
    if (url.includes("/rest/v1/api_tokens")) {
      if (d.tokens) await wait(d.tokens);
      return json(route, route.request().method() === "GET" ? [] : [{ id: "t1", name: "x", token_prefix: "plog_x", created_at: "2026-11-01T10:00:00Z", last_used_at: null }]);
    }
    return json(route, []);
  });
  await page.route(/\/api\/cms\/entries/, async (route) => {
    if (route.request().method() !== "GET") return json(route, {});
    if (d.entries) await wait(d.entries);
    return json(route, { entries: ENTRIES() });
  });
  await page.route(/\/api\/plan/, async (route) => { if (d.plan) await wait(d.plan); return json(route, PLAN(o.tier || "pro")); });
  await page.route(/\/api\/limits/, (route) => json(route, {}));
  await page.route(/\/api\/admin\/usage/, async (route) => { if (d.usage) await wait(d.usage); return json(route, { summary: [] }); });
  await page.route(/\/api\/reports/, async (route) => { if (d.reports) await wait(d.reports); return json(route, { error: "test" }, 500); });
  await page.route(/\/api\/transcribe/, async (route) => { if (d.transcribe) await wait(d.transcribe); return json(route, { text: "Tekst z dyktowania." }); });
  await page.route(/\/api\/therapist/, async (route) => { if (d.therapist) await wait(d.therapist); return route.fulfill({ status: 200, contentType: "text/plain", body: "Odpowiedź testowa." }); });
  await page.route(/\/api\/search/, async (route) => { if (d.search) await wait(d.search); return json(route, { hits: [{ entry: ENTRIES()[0], source: "semantic" }] }); });
  return { ctx, page };
}

async function login(page) {
  await page.goto(`${BASE}/welcome`, { waitUntil: "load" });
  await wait(400);
  await page.getByLabel("E-mail").fill("test@example.com");
  await page.getByLabel("Hasło").fill("test-haslo");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/entries/, { timeout: 8000 });
}
const shot = (page, f) => page.screenshot({ path: path.join(OUT, f) });
const has = (page, t) => page.getByText(t).count();

const scenarios = {
  async sync(cache) {
    console.log("=== Wpisy z chmury po zalogowaniu");
    const { ctx, page } = await open(cache, { delays: { entries: 4000 } });
    await login(page);
    await wait(700);
    note(`„Brak wpisu na ten dzień” w trakcie pobierania: ${await has(page, "Brak wpisu na ten dzień")}`);
    await shot(page, "a1-pobieranie-wpisow.png");
    await wait(4200);
    note(`po pobraniu „Brak wpisu”: ${await has(page, "Brak wpisu na ten dzień")}`);
    await shot(page, "a2-po-pobraniu.png");
    await ctx.close();
  },
  async stats(cache) {
    console.log("=== Statystyki i wpis z linku w trakcie pobierania");
    const { ctx, page } = await open(cache, { delays: { entries: 6000 } });
    await login(page);
    await page.goto(`${BASE}/stats`, { waitUntil: "load" });
    await wait(800);
    await shot(page, "a3-statystyki.png");
    await ctx.close();
    const b = await open(cache, { delays: { entries: 6000 } });
    await login(b.page);
    await b.page.goto(`${BASE}/entries/e0`, { waitUntil: "load" });
    await wait(800);
    note(`„Nie znaleziono wpisu” w trakcie pobierania: ${await has(b.page, "Nie znaleziono wpisu")}`);
    await shot(b.page, "a4-wpis-z-linku.png");
    await b.ctx.close();
  },
  async chat(cache) {
    console.log("=== Rozmowa z personą");
    const { ctx, page } = await open(cache, { delays: { history: 3500, therapist: 5000 } });
    await login(page);
    await page.goto(`${BASE}/chat`, { waitUntil: "load" });
    await wait(900);
    note(`historia w trakcie wczytywania: ${await has(page, "Jak mi poszedł tydzień?")} (0 = jeszcze jej nie widać)`);
    await shot(page, "b1-historia-czatu.png");
    await page.getByText("Jak mi poszedł tydzień?").waitFor({ timeout: 12000 }).catch(() => {});
    note(`historia po wczytaniu: ${await has(page, "Jak mi poszedł tydzień?")}`);
    await shot(page, "b1b-historia-wczytana.png");
    const box = page.getByRole("textbox").first();
    await box.fill("Co u mnie?");
    await page.getByRole("button", { name: /Wyślij do/ }).tap();
    await wait(900);
    await shot(page, "b2-czat-kropki.png");
    await ctx.close();
  },
  async reports(cache) {
    console.log("=== Raporty AI");
    const { ctx, page } = await open(cache, { delays: { reports: 7000 } });
    await login(page);
    await page.goto(`${BASE}/stats`, { waitUntil: "load" });
    await wait(1200);
    const b = page.getByRole("button", { name: /Raport tygodniowy/ });
    await b.scrollIntoViewIfNeeded();
    await b.tap();
    await wait(1500);
    await shot(page, "c1-raport.png");
    await wait(4000);
    await shot(page, "c2-raport-5s.png");
    await ctx.close();
    const x = await open(cache, { delays: { plan: 4000 } });
    await login(x.page);
    await x.page.goto(`${BASE}/stats`, { waitUntil: "load" });
    await wait(600);
    const b2 = x.page.getByRole("button", { name: /Raport tygodniowy/ });
    await b2.scrollIntoViewIfNeeded();
    await shot(x.page, "c3-raport-przed-planem.png");
    await b2.tap();
    await wait(1500);
    note(`stuknięcie zanim plan się wczyta prowadzi na: ${new URL(x.page.url()).pathname}`);
    await x.ctx.close();
  },
  async voice(cache) {
    console.log("=== Dyktowanie");
    const { ctx, page } = await open(cache, { delays: { transcribe: 5000 } });
    await login(page);
    await wait(800);
    const mic = page.getByRole("button", { name: "Nagraj głos" });
    if (!(await mic.count())) { note("brak przycisku mikrofonu"); await ctx.close(); return; }
    const micBox = await mic.boundingBox();
    await mic.tap();
    await wait(900);
    await shot(page, "d1-nagrywanie.png");
    await page.touchscreen.tap(micBox.x + micBox.width / 2, micBox.y + micBox.height / 2);
    await wait(700);
    await shot(page, "d2-transkrypcja.png");
    await ctx.close();
  },
  async photo(cache) {
    console.log("=== Zdjęcie w nowym wpisie");
    const { ctx, page } = await open(cache, { delays: { upload: 6000 } });
    await login(page);
    await page.goto(`${BASE}/new`, { waitUntil: "load" });
    await wait(700);
    for (let i = 0; i < 5; i++) { await page.getByRole("button", { name: "Pomiń" }).tap(); await wait(250); }
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==", "base64");
    await page.locator('input[type="file"]').first().setInputFiles({ name: "test.png", mimeType: "image/png", buffer: png });
    await wait(900);
    await shot(page, "e1-zdjecie-wgrywanie.png");
    await page.getByLabel(/Tytuł/).first().fill("Wpis ze zdjęciem").catch(() => {});
    const save = page.getByRole("button", { name: "Zapisz" });
    note(`„Zapisz” zablokowane w trakcie wgrywania: ${await save.isDisabled()}`);
    await save.tap();
    await wait(7000);
    const photos = await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) {
        try {
          const v = JSON.parse(localStorage.getItem(k));
          if (Array.isArray(v)) { const e = v.find((x) => x && x.title === "Wpis ze zdjęciem"); if (e) return (e.photos || []).length; }
        } catch {}
      }
      return "wpisu nie znaleziono";
    });
    note(`zdjęcia w zapisanym wpisie po skończonym wgrywaniu: ${photos}`);
    await ctx.close();
  },
  async settings(cache) {
    console.log("=== Ustawienia");
    const { ctx, page } = await open(cache, { delays: { plan: 8000, usage: 8000, tokens: 8000 } });
    await login(page);
    await page.goto(`${BASE}/settings`, { waitUntil: "load" });
    await wait(800);
    const heading = page.getByRole("heading", { name: "Plan i płatności" });
    await heading.scrollIntoViewIfNeeded();
    note(`konto PRO, plan w trakcie wczytywania pokazuje „Plan Free”: ${await has(page, "Plan Free")}`);
    await shot(page, "f1-plan-wczytywanie.png");
    await page.getByRole("heading", { name: /Klucze API/ }).scrollIntoViewIfNeeded().catch(() => {});
    await wait(150);
    await shot(page, "f2-tokeny-wczytywanie.png");
    await ctx.close();
    const t = await open(cache, { delays: { tokens: 300 } });
    await login(t.page);
    await t.page.goto(`${BASE}/settings`, { waitUntil: "load" });
    await wait(1000);
    await t.page.getByRole("heading", { name: /Klucze API/ }).scrollIntoViewIfNeeded().catch(() => {});
    await t.page.getByPlaceholder(/Nazwa tokenu/).fill("test").catch(() => {});
    await t.ctx.close();
    const p = await open(cache, { tier: "free" });
    await login(p.page);
    await p.page.goto(`${BASE}/settings?upgraded=1`, { waitUntil: "load" });
    await wait(1200);
    await shot(p.page, "h1-po-platnosci.png");
    note(`po powrocie z płatności jest komunikat: ${(await has(p.page, /płatno|dziękuj|aktywn|Pro jest/i)) > 1}`);
    await p.ctx.close();
  },
  async search(cache) {
    console.log("=== Inteligentne wyszukiwanie (komputer)");
    const { ctx, page } = await open(cache, { desktop: true, delays: { search: 3000 } });
    await login(page);
    await wait(1200);
    await page.getByRole("button", { name: "Inteligentne wyszukiwanie" }).click();
    await page.getByLabel("Szukaj wpisów").fill("odpoczynek");
    await wait(1200);
    note(`pierwsze szukanie, „Szukam…”: ${await has(page, "Szukam…")}`);
    await shot(page, "g1-szukam.png");
    await wait(3000);
    await page.getByLabel("Szukaj wpisów").fill("odpoczynek w tygodniu");
    await wait(1200);
    note(`drugie szukanie, „Szukam…”: ${await has(page, "Szukam…")} (0 = widać stare wyniki bez sygnału)`);
    await shot(page, "g2-kolejne-szukanie.png");
    await ctx.close();
  },
  async boot(cache) {
    console.log("=== Odświeżenie u zalogowanego");
    const { ctx, page } = await open(cache);
    await login(page);
    await wait(800);
    await page.addInitScript(() => {
      window.__seen = {};
      const t = setInterval(() => {
        const s = document.body ? document.body.innerText : "";
        for (const k of ["Zaloguj się, aby synchronizować", "Zalogowano"]) if (s.includes(k) && !window.__seen[k]) window.__seen[k] = Math.round(performance.now());
        if (window.__seen["Zalogowano"]) clearInterval(t);
      }, 8);
    });
    await page.goto(`${BASE}/settings`, { waitUntil: "load" });
    await wait(1000);
    note(`mignięcie widoku gościa: ${JSON.stringify(await page.evaluate(() => window.__seen))}`);
    await ctx.close();
  },
};

(async () => {
  const cache = {};
  const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
  for (const [name, fn] of Object.entries(scenarios)) {
    if (only && !only.includes(name)) continue;
    try { await fn(cache); } catch (e) { console.log(`  BŁĄD w ${name}:`, e.message.split("\n").slice(0, 3).join(" ").slice(0, 300)); }
  }
  for (const b of Object.values(cache)) await b.close();
  console.log("gotowe");
})();
