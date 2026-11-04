// Zrzuty „jest / ma być” dla punktów 1–4. Serwer jest spowolniony i podstawiony, sesja
// i dane są testowe, żadne prawdziwe konto nie bierze w tym udziału.
// LABEL=jest albo LABEL=ma-byc; ONLY=photo,sync,plan,paid
const { makeContext } = require("./lib");
const path = require("path");
const fs = require("fs");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const BASE = "http://localhost:3102";
const LABEL = process.env.LABEL || "jest";
const OUT = path.join(__dirname, "..", "tap", "ba", LABEL);
fs.mkdirSync(OUT, { recursive: true });
const PHOTO = fs.readFileSync(path.join(__dirname, "test-photo.png"));
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "*" };
const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: CORS, body: JSON.stringify(body) });
const note = (msg) => console.log(`  ${msg}`);
// Pusty dzisiejszy dzień (zaproszenie do pisania) — tekst od redesignu „Monolit”.
const EMPTY_DAY = "Jak minął dzień?";
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
  await page.emulateMedia({ colorScheme: o.dark ? "dark" : "light" });
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
    const req = route.request();
    const url = req.url();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (url.includes("/auth/v1/token")) { if (d.token) await wait(d.token); return json(route, session()); }
    if (url.includes("/auth/v1/user")) return json(route, session().user);
    if (url.includes("/auth/v1/logout")) { if (d.logout) await wait(d.logout); return route.fulfill({ status: 204, headers: CORS }); }
    if (url.includes("/rest/v1/therapist")) {
      if (d.history) await wait(d.history);
      if (url.includes("therapist_conversations")) {
        const single = (req.headers().accept || "").includes("vnd.pgrst.object");
        return json(route, single ? { id: "c1" } : [{ id: "c1" }]);
      }
      return json(route, [{ id: "m1", role: "user", content: "Jak mi poszedł tydzień?", created_at: "2026-11-01T10:00:00Z" }, { id: "m2", role: "assistant", content: "Tydzień był spokojniejszy niż poprzedni.", created_at: "2026-11-01T10:00:05Z" }]);
    }
    if (url.includes("/storage/v1/object/sign/")) {
      if (req.method() === "POST") {
        const paths = JSON.parse(req.postData() || "{}").paths || [];
        return json(route, paths.map((p) => ({ path: p, signedURL: `/object/sign/entry-photos/${p}?token=t`, error: null })));
      }
      return route.fulfill({ status: 200, contentType: "image/png", headers: CORS, body: PHOTO });
    }
    if (url.includes("/storage/v1/object/")) {
      if (d.upload) await wait(d.upload);
      return json(route, { Key: "x", Id: "x" });
    }
    return json(route, []);
  });
  await page.route(/\/api\/cms\/entries/, async (route) => {
    if (route.request().method() !== "GET") return o.flags && o.flags.pushFail ? json(route, { error: "test" }, 500) : json(route, {});
    if (o.flags && o.flags.pullFail) return json(route, { error: "test" }, 500);
    if (o.entriesFail) return json(route, { error: "test" }, 500);
    if (d.entries) await wait(d.entries);
    return json(route, { entries: o.noEntries ? [] : ENTRIES() });
  });
  let planCalls = 0;
  await page.route(/\/api\/plan/, async (route) => {
    planCalls += 1;
    if (o.planFail) return json(route, { error: "test" }, 500);
    if (d.plan) await wait(d.plan);
    return json(route, PLAN(o.tierAfter && planCalls > (o.tierAfterCalls ?? 2) ? o.tierAfter : o.tier || "pro"));
  });
  await page.route(/\/api\/limits/, (route) => json(route, {}));
  await page.route(/\/api\/admin\/usage/, (route) => json(route, { summary: [] }));
  await page.route(/\/api\/reports/, async (route) => {
    if (d.reports) await wait(d.reports);
    return json(route, { period: "week", entryCount: 3, summary: "Tydzień spokojny, sen poprawia nastrój." });
  });
  await page.route(/\/api\/transcribe/, async (route) => { if (d.transcribe) await wait(d.transcribe); return json(route, { text: "Tekst z dyktowania." }); });
  await page.route(/\/api\/therapist/, async (route) => { if (d.therapist) await wait(d.therapist); return route.fulfill({ status: 200, contentType: "text/plain", body: "Odpowiedź testowa." }); });
  await page.route(/\/api\/search/, async (route) => { if (d.search) await wait(d.search); return json(route, { hits: [{ entry: ENTRIES()[0], source: "search" }] }); });
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
// Panel planu jest niżej: przewijamy wprost i sprawdzamy, że nagłówek jest na ekranie.
async function toPlan(page) {
  const h = page.getByRole("heading", { name: "Plan i płatności" });
  await h.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
  await wait(300);
  const box = await h.boundingBox();
  const vh = page.viewportSize().height;
  note(`nagłówek planu na ekranie: ${box && box.y >= 0 && box.y < vh} (y=${box && Math.round(box.y)})`);
}
const shot = (page, f) => page.screenshot({ path: path.join(OUT, f) });
const count = (page, t) => page.getByText(t).count();

async function savedPhotos(page, title) {
  return page.evaluate((t) => {
    for (const k of Object.keys(localStorage)) {
      try {
        const v = JSON.parse(localStorage.getItem(k));
        if (Array.isArray(v)) { const e = v.find((x) => x && x.title === t); if (e) return (e.photos || []).length; }
      } catch {}
    }
    return "wpisu nie znaleziono";
  }, title);
}

const scenarios = {
  async photo(cache) {
    console.log("=== 1. Zdjęcie w nowym wpisie");
    const { ctx, page } = await open(cache, { delays: { upload: 6000 } });
    await login(page);
    await page.goto(`${BASE}/new`, { waitUntil: "load" });
    await wait(700);
    for (let i = 0; i < 5; i++) { await page.getByRole("button", { name: "Pomiń" }).tap(); await wait(250); }
    await page.locator('input[type="file"]').first().setInputFiles({ name: "test.png", mimeType: "image/png", buffer: PHOTO });
    await page.getByLabel(/Tytuł/).first().fill("Wpis ze zdjęciem");
    await page.locator("h1").first().tap().catch(() => {});
    await wait(800);
    const save = page.getByRole("button", { name: /Zapisz|Wgrywam/ });
    await save.scrollIntoViewIfNeeded();
    await wait(200);
    await shot(page, "1a-zapisz-w-trakcie.png");
    const disabled = await save.isDisabled();
    note(`przycisk w trakcie wgrywania: „${(await save.innerText()).trim()}”, zablokowany: ${disabled}, krycie: ${await save.evaluate((b) => getComputedStyle(b).opacity)}`);
    if (disabled) {
      await page.getByRole("button", { name: "Zapisz", exact: true }).waitFor({ timeout: 10000 });
      await wait(400);
      await save.scrollIntoViewIfNeeded();
      await shot(page, "1b-po-wgraniu.png");
      await page.getByRole("button", { name: "Zapisz", exact: true }).tap();
    } else {
      await save.tap();
    }
    await page.waitForURL(/\/entries\//, { timeout: 8000 });
    await wait(disabled ? 1200 : 700);
    await shot(page, "1c-zapisany-wpis.png");
    await wait(disabled ? 0 : 6500);
    note(`zdjęcia w zapisanym wpisie: ${await savedPhotos(page, "Wpis ze zdjęciem")}`);
    await ctx.close();
  },
  async photoTwice(cache) {
    console.log("=== 1. Dwa wybory plików w trakcie wgrywania");
    const { ctx, page } = await open(cache, { delays: { upload: 2500 } });
    await login(page);
    await page.goto(`${BASE}/new`, { waitUntil: "load" });
    await wait(700);
    for (let i = 0; i < 5; i++) { await page.getByRole("button", { name: "Pomiń" }).tap(); await wait(250); }
    await page.locator('input[type="file"]').first().setInputFiles({ name: "a.png", mimeType: "image/png", buffer: PHOTO });
    await wait(600);
    await page.locator('input[type="file"]').first().setInputFiles({ name: "b.png", mimeType: "image/png", buffer: PHOTO });
    await wait(4000);
    await page.getByLabel(/Tytuł/).first().fill("Dwa zdjęcia");
    await page.getByRole("button", { name: "Zapisz", exact: true }).tap();
    await page.waitForURL(/\/entries\//, { timeout: 8000 });
    await wait(500);
    note(`zdjęcia w zapisanym wpisie (powinny być 2): ${await savedPhotos(page, "Dwa zdjęcia")}`);
    await ctx.close();
  },
  async sync(cache) {
    console.log("=== 2. Pobieranie wpisów po zalogowaniu");
    const a = await open(cache, { delays: { entries: 4000 } });
    await login(a.page);
    await wait(700);
    // Pusty dzień od redesignu (Monolit) to zaproszenie „Jak minął dzień?”.
    note(`dziennik, pusty stan: ${await count(a.page, EMPTY_DAY)}, „Wczytuję”: ${await count(a.page, /Wczytuję wpisy/)}`);
    await shot(a.page, "2a-dziennik.png");
    await wait(4200);
    note(`po pobraniu pusty stan: ${await count(a.page, EMPTY_DAY)}, „Wczytuję”: ${await count(a.page, /Wczytuję wpisy/)}`);
    await shot(a.page, "2a2-dziennik-po.png");
    await a.ctx.close();

    const b = await open(cache, { delays: { entries: 6000 } });
    await login(b.page);
    await b.page.goto(`${BASE}/stats`, { waitUntil: "load" });
    await wait(800);
    await shot(b.page, "2b-statystyki.png");
    await b.ctx.close();

    const c = await open(cache, { delays: { entries: 6000 } });
    await login(c.page);
    await c.page.goto(`${BASE}/entries/e0`, { waitUntil: "load" });
    await wait(800);
    note(`wpis z linku, „Nie znaleziono”: ${await count(c.page, "Nie znaleziono wpisu")}`);
    await shot(c.page, "2c-wpis-z-linku.png");
    await wait(6000);
    note(`po pobraniu widać wpis: ${await count(c.page, "Wpis testowy 1")}`);
    await c.ctx.close();

    // Czy fałszywy komunikat miga choćby na moment przy wejściu z linku.
    const m = await open(cache, { delays: { entries: 2500 } });
    await login(m.page);
    await m.page.addInitScript(() => {
      window.__seen = {};
      setInterval(() => {
        const s = document.body ? document.body.innerText : "";
        for (const k of ["Nie znaleziono wpisu", "Wczytuję wpis"]) if (s.includes(k) && !window.__seen[k]) window.__seen[k] = Math.round(performance.now());
      }, 4);
    });
    await m.page.goto(`${BASE}/entries/e0`, { waitUntil: "load" });
    await wait(4000);
    note(`mignięcia przy wejściu z linku: ${JSON.stringify(await m.page.evaluate(() => window.__seen))}`);
    await m.ctx.close();

    const e = await open(cache, { delays: { entries: 6000 } });
    await login(e.page);
    await e.page.goto(`${BASE}/entries/e0/edit`, { waitUntil: "load" });
    await wait(800);
    note(`edycja z linku, „Nie znaleziono”: ${await count(e.page, "Nie znaleziono wpisu")}`);
    await shot(e.page, "2d-edycja-z-linku.png");
    await e.ctx.close();

    const f = await open(cache, { desktop: true, delays: { entries: 5000 } });
    await login(f.page);
    await wait(900);
    note(`komputer, pusta lista: ${await count(f.page, "Tu pojawią się Twoje wpisy.")}`);
    await shot(f.page, "2e-komputer.png");
    await f.ctx.close();

    // Puste konto: po pobraniu ma zostać uczciwy pusty stan.
    const g = await open(cache, { noEntries: true, delays: { entries: 1000 } });
    await login(g.page);
    await wait(2000);
    note(`puste konto po pobraniu, pusty stan: ${await count(g.page, EMPTY_DAY)}, „Wczytuję”: ${await count(g.page, /Wczytuję wpisy/)}`);
    await g.ctx.close();
  },
  async plan(cache) {
    console.log("=== 3. Plan w ustawieniach (konto Pro)");
    const { ctx, page } = await open(cache, { delays: { plan: 5000 } });
    await login(page);
    await page.goto(`${BASE}/settings`, { waitUntil: "load" });
    await wait(800);
    await toPlan(page);
    note(`w trakcie, „Plan Free”: ${await count(page, "Plan Free")}, „Przejdź na Pro”: ${await count(page, "Przejdź na Pro")}, „Wczytuję plan”: ${await count(page, /Wczytuję plan/)}`);
    await shot(page, "3a-plan-wczytywanie.png");
    await wait(5000);
    await toPlan(page);
    note(`po wczytaniu, „Plan Pro”: ${await count(page, "Plan Pro")}, „Plan Free”: ${await count(page, "Plan Free")}`);
    await shot(page, "3b-plan-po.png");
    await ctx.close();

    const x = await open(cache, { planFail: true });
    await login(x.page);
    await x.page.goto(`${BASE}/settings`, { waitUntil: "load" });
    await wait(1000);
    await toPlan(x.page);
    note(`błąd serwera, „Plan Free”: ${await count(x.page, "Plan Free")}, „Nie udało się”: ${await count(x.page, /Nie udało się wczytać planu/)}`);
    await shot(x.page, "3c-plan-blad.png");
    await x.ctx.close();
  },
  async dark(cache) {
    console.log("=== Motyw ciemny: przycisk w trakcie logowania");
    const { ctx, page } = await open(cache, { dark: true, delays: { token: 5000 } });
    await page.goto(`${BASE}/welcome`, { waitUntil: "load" });
    await wait(700);
    await page.getByLabel("E-mail").fill("test@example.com");
    await page.getByLabel("Hasło").fill("test-haslo");
    await page.getByRole("button", { name: "Zaloguj się", exact: true }).tap();
    await wait(400);
    const btn = page.locator('button[type="submit"]');
    note(`przycisk: „${(await btn.innerText()).trim()}”, krycie: ${await btn.evaluate((el) => getComputedStyle(el).opacity)}`);
    await shot(page, "12-logowanie-ciemny.png");
    await ctx.close();
  },
  async report(cache) {
    console.log("=== 5. Raport AI");
    const { ctx, page } = await open(cache, { delays: { reports: 10000 } });
    await login(page);
    await wait(500);
    await page.goto(`${BASE}/stats`, { waitUntil: "load" });
    await wait(1200);
    const b = page.getByRole("button", { name: /Raport tygodniowy/ });
    await b.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
    await wait(200);
    await b.tap();
    await wait(1200);
    await shot(page, "5a-raport.png");
    await wait(6000);
    await shot(page, "5b-raport-dluzej.png");
    note(`po 7 s, informacja o dłuższym czekaniu: ${await count(page, /chwilę potrwać/)}`);
    await page.getByText("Tydzień spokojny").waitFor({ timeout: 8000 }).then(() => note("raport się pokazał")).catch(() => note("raport się nie pokazał"));
    await ctx.close();
  },
  async reportPlan(cache) {
    console.log("=== 6. Raport, zanim plan się wczyta");
    const { ctx, page } = await open(cache, { delays: { plan: 4000 } });
    await login(page);
    await wait(500);
    await page.goto(`${BASE}/stats`, { waitUntil: "load" });
    await wait(800);
    const b = page.getByRole("button", { name: /Raport tygodniowy/ });
    await b.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
    await wait(200);
    await shot(page, "6a-raport-przed-planem.png");
    const locked = await b.isDisabled();
    note(`przycisk zablokowany w trakcie wczytywania planu: ${locked}`);
    if (!locked) await b.tap();
    await wait(800);
    note(`po stuknięciu adres: ${new URL(page.url()).pathname}`);
    await ctx.close();

    const x = await open(cache, { planFail: true });
    await login(x.page);
    await wait(500);
    await x.page.goto(`${BASE}/stats`, { waitUntil: "load" });
    await wait(1000);
    const c = x.page.getByRole("button", { name: /Raport tygodniowy/ });
    await c.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
    await c.tap();
    await wait(1200);
    note(`plan niedostępny, po stuknięciu adres: ${new URL(x.page.url()).pathname}`);
    await x.ctx.close();

    const g = await open(cache);
    await g.page.goto(`${BASE}/stats`, { waitUntil: "load" });
    await wait(1000);
    const e = g.page.getByRole("button", { name: /Raport tygodniowy/ });
    if (await e.count()) {
      await e.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
      await e.tap();
      await wait(1200);
      note(`gość, po stuknięciu adres: ${new URL(g.page.url()).pathname}`);
    } else note("gość nie widzi raportów");
    await g.ctx.close();
  },
  async voice(cache) {
    console.log("=== 7. Dyktowanie");
    const { ctx, page } = await open(cache, { delays: { transcribe: 5000 } });
    await login(page);
    await wait(800);
    const mic = page.getByRole("button", { name: "Nagraj głos" });
    const box = await mic.boundingBox();
    await mic.tap();
    await wait(900);
    await shot(page, "7a-nagrywanie.png");
    const field = page.getByRole("textbox").first();
    note(`podpowiedź w polu w trakcie nagrywania: „${await field.getAttribute("placeholder")}”`);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await wait(700);
    await shot(page, "7b-przepisywanie.png");
    note(`podpowiedź w polu w trakcie przepisywania: „${await field.getAttribute("placeholder")}”`);
    await wait(5000);
    note(`po przepisaniu w polu: „${await field.inputValue()}”`);
    await ctx.close();
  },
  async chat(cache) {
    console.log("=== 8. Historia czatu");
    const { ctx, page } = await open(cache, { delays: { history: 3500 } });
    await login(page);
    await wait(500);
    await page.goto(`${BASE}/chat`, { waitUntil: "load" });
    await wait(900);
    await shot(page, "8a-historia-czatu.png");
    note(`w trakcie, „Wczytuję rozmowę”: ${await count(page, /Wczytuję rozmowę/)}, historia: ${await count(page, "Jak mi poszedł tydzień?")}`);
    await page.getByText("Jak mi poszedł tydzień?").waitFor({ timeout: 12000 }).catch(() => {});
    await wait(200);
    note(`po wczytaniu, „Wczytuję rozmowę”: ${await count(page, /Wczytuję rozmowę/)}, historia: ${await count(page, "Jak mi poszedł tydzień?")}`);
    await ctx.close();

    // Od redesignu (Monolit) rozmowa na komputerze to ekran z paska bocznego, a nie
    // pływający panel nad polem.
    const k = await open(cache, { desktop: true, delays: { history: 3500 } });
    await login(k.page);
    await wait(1200);
    await k.page.getByRole("link", { name: "Rozmowa" }).click();
    await wait(900);
    note(`rozmowa na komputerze, „Wczytuję rozmowę”: ${await count(k.page, /Wczytuję rozmowę/)}`);
    await k.page.screenshot({ path: path.join(OUT, "8b-rozmowa-komputer.png"), clip: { x: 224, y: 0, width: 1216, height: 600 } });
    await k.ctx.close();
  },
  async search(cache) {
    console.log("=== 9. Kolejne wyszukiwanie (komputer)");
    const { ctx, page } = await open(cache, { desktop: true, delays: { search: 3000 } });
    await login(page);
    await wait(1200);
    await page.getByRole("button", { name: "Inteligentne wyszukiwanie" }).click();
    await page.getByLabel("Szukaj wpisów").fill("odpoczynek");
    await wait(1200);
    await page.screenshot({ path: path.join(OUT, "9a-pierwsze-szukanie.png"), clip: { x: 0, y: 0, width: 640, height: 500 } });
    await wait(3000);
    await page.getByLabel("Szukaj wpisów").fill("odpoczynek w tygodniu");
    await wait(1200);
    note(`drugie szukanie, „Szukam”: ${await count(page, /Szukam/)}`);
    await page.screenshot({ path: path.join(OUT, "9b-kolejne-szukanie.png"), clip: { x: 0, y: 0, width: 640, height: 500 } });
    await ctx.close();
  },
  async syncFail(cache) {
    console.log("=== 10. Nie udało się pobrać wpisów");
    const flags = { pullFail: true };
    const { ctx, page } = await open(cache, { flags });
    await login(page);
    await wait(900);
    await shot(page, "10a-blad-pobierania.png");
    note(`pusty stan: ${await count(page, EMPTY_DAY)}, komunikat: ${await count(page, /Nie udało się pobrać/)}`);
    const retry = page.getByRole("button", { name: "Spróbuj ponownie" });
    if (await retry.count()) {
      flags.pullFail = false;
      await retry.tap();
      await wait(1000);
      note(`po ponowieniu komunikat: ${await count(page, /Nie udało się pobrać/)}, wpis: ${await count(page, "Wpis testowy 1")}`);
    }
    await ctx.close();
  },
  async pushFail(cache) {
    console.log("=== 10. Wpis nie dotarł do chmury");
    const flags = { pushFail: true };
    const { ctx, page } = await open(cache, { flags });
    await login(page);
    await wait(500);
    await page.goto(`${BASE}/new`, { waitUntil: "load" });
    await wait(700);
    for (let i = 0; i < 5; i++) { await page.getByRole("button", { name: "Pomiń" }).tap(); await wait(250); }
    await page.getByLabel(/Tytuł/).first().fill("Wpis bez sieci");
    await page.getByRole("button", { name: "Zapisz", exact: true }).tap();
    await page.waitForURL(/\/entries\//, { timeout: 8000 });
    await wait(900);
    await shot(page, "10b-wpis-poza-chmura.png");
    note(`komunikat: ${await count(page, /nie dotarł do chmury/)}`);
    const retry = page.getByRole("button", { name: "Spróbuj ponownie" });
    if (await retry.count()) {
      flags.pushFail = false;
      await retry.tap();
      await wait(1000);
      note(`po ponowieniu komunikat: ${await count(page, /nie dotarł do chmury/)}`);
    }
    await ctx.close();
  },
  async signout(cache) {
    // Od redesignu (Monolit) konto i wylogowanie są na dole paska bocznego, bez menu.
    console.log("=== 11. Wylogowanie z paska bocznego (komputer)");
    const { ctx, page } = await open(cache, { desktop: true, delays: { logout: 4000 } });
    await login(page);
    await wait(1000);
    await page.getByRole("button", { name: "Wyloguj się" }).click();
    await wait(500);
    await page.screenshot({ path: path.join(OUT, "11a-wylogowanie.png"), clip: { x: 0, y: 600, width: 480, height: 300 } });
    note(`w trakcie, „Wylogowuję”: ${await count(page, /Wylogowuję/)}`);
    await page.mouse.move(100, 500);
    await wait(300);
    note(`po odjechaniu myszą, „Wylogowuję”: ${await count(page, /Wylogowuję/)}`);
    await wait(4000);
    note(`po wylogowaniu, „Wylogowuję”: ${await count(page, /Wylogowuję/)}`);
    await ctx.close();
  },
  async paid(cache) {
    console.log("=== 4. Powrót po zapłacie");
    const { ctx, page } = await open(cache, { tier: "free", tierAfter: "pro", tierAfterCalls: 3 });
    await login(page);
    await page.goto(`${BASE}/settings?upgraded=1`, { waitUntil: "load" });
    await wait(1200);
    note(`zaraz po powrocie, „Płatność przyjęta”: ${await count(page, /Płatność przyjęta/)}, adres: ${new URL(page.url()).search || "(bez parametrów)"}`);
    await shot(page, "4a-po-platnosci.png");
    await page.getByText(/masz plan Pro/).waitFor({ timeout: 15000 }).then(() => note("plan się aktywował, komunikat „masz plan Pro” widoczny")).catch(() => note("brak komunikatu o aktywacji"));
    await wait(200);
    await shot(page, "4b-plan-aktywny.png");
    note(`adres po powrocie: ${new URL(page.url()).search || "(bez parametrów)"}`);
    await page.reload({ waitUntil: "load" });
    await wait(1000);
    note(`po odświeżeniu, „masz plan”: ${await count(page, /masz plan/)}, „Płatność przyjęta”: ${await count(page, /Płatność przyjęta/)}`);
    await ctx.close();

    // Pro → Max: sam fakt płatnego planu nie wystarcza, czekamy na Max.
    const u = await open(cache, { tier: "pro", tierAfter: "max", tierAfterCalls: 3 });
    await login(u.page);
    await u.page.goto(`${BASE}/settings?upgraded=max`, { waitUntil: "load" });
    await wait(1200);
    note(`Pro → Max zaraz po powrocie, „Aktywuję”: ${await count(u.page, /Aktywuję plan/)}, „masz plan”: ${await count(u.page, /masz plan/)}`);
    await u.page.getByText(/masz plan Max/).waitFor({ timeout: 15000 }).then(() => note("Pro → Max: „masz plan Max” widoczne")).catch(() => note("Pro → Max: brak komunikatu"));
    await u.ctx.close();

    const s = await open(cache, { tier: "free" });
    await login(s.page);
    await s.page.goto(`${BASE}/settings?upgraded=1`, { waitUntil: "load" });
    await s.page.getByText(/dłużej niż zwykle/).waitFor({ timeout: 45000 }).then(() => note("webhook się spóźnia: komunikat o dłuższej aktywacji widoczny")).catch(() => note("brak komunikatu o dłuższej aktywacji"));
    await wait(200);
    await shot(s.page, "4c-aktywacja-dluzej.png");
    await s.ctx.close();
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
