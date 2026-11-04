// Wspólne: przeglądarka (systemowy Edge), urządzenia, podstawiony Supabase i API.
// Żadne prawdziwe konto ani produkcja nie biorą udziału — sesja jest testowa.
const { chromium } = require("playwright");

const ANALYTICS = /(_vercel\/(insights|speed-insights)|va\.vercel-scripts|vitals\.vercel|googletagmanager|google-analytics|posthog|i\.posthog|\/ingest\/)/i;
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "*" };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: CORS, body: JSON.stringify(body) });

const DEVICES = {
  phone: { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36" },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};

const USER = "00000000-0000-0000-0000-000000000000";
function session() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER, exp, role: "authenticated" })}.test`,
    token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "test",
    user: { id: USER, aud: "authenticated", role: "authenticated", email: "test@example.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
  };
}

// Wpisy „z chmury” dla zalogowanego: dziś bez wpisu, kilka poprzednich dni.
function remoteEntries() {
  const day = (d, h = 21) => { const t = new Date(); t.setDate(t.getDate() - d); t.setHours(h, 10, 0, 0); return t.toISOString(); };
  return [
    { id: "r1", title: "Domknięte zaległości", content: "<p>Przeterminowana praca, ale zrobiłem, co mogłem. Jutro będzie spokojniej.</p><p>Wieczorem trochę czytania i wcześniejsze pójście spać.</p>", mood: 3, sleep: 2, energy: 3, productivity: 4, stress: 4, createdAt: day(1) },
    { id: "r2", title: "Spokojny wieczór", content: "<p>Cichy dzień bez niespodzianek. W końcu nadrobiłem zaległe maile.</p>", mood: 4, sleep: 4, energy: 4, productivity: 3, stress: 2, createdAt: day(2) },
    { id: "r3", title: "Spacer rozjaśnił głowę", content: "<p>Długi spacer po pracy zrobił swoje. Najlepsze decyzje przychodzą w ruchu.</p>", mood: 5, sleep: 4, energy: 4, productivity: 3, stress: 1, createdAt: day(3) },
  ];
}

let browser;
async function getBrowser() {
  if (!browser) browser = await chromium.launch({ channel: "msedge" });
  return browser;
}

/**
 * o.device: "phone" | "desktop"; o.dark: boolean; o.login: boolean (sesja testowa w localStorage
 * przez stub tokenu); o.delays: { entries } ms; o.noEntries; o.entriesFail.
 */
async function open(o = {}) {
  const b = await getBrowser();
  const device = { ...DEVICES[o.device || "phone"], ...(o.dpr ? { deviceScaleFactor: o.dpr } : {}) };
  const ctx = await b.newContext({ ...device, locale: "pl-PL", timezoneId: "Europe/Warsaw", colorScheme: o.dark ? "dark" : "light", reducedMotion: o.reducedMotion ? "reduce" : "no-preference" });
  // Tylko zewnętrzne hosty: w trybie deweloperskim lokalne pliki JS mają w nazwie
  // „posthog” i ich zablokowanie psuje hydratację całej strony.
  await ctx.route((url) => url.hostname !== "localhost" && ANALYTICS.test(url.href), (r) => r.abort());
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`  [pageerror] ${String(e.message || e).slice(0, 200)}`));
  await page.addInitScript(() => {
    try {
      localStorage.setItem("prolog.soundEnabled", "0");
      localStorage.setItem("prolog.therapist.consent", "1");
      localStorage.setItem("prolog.therapist.enabled", "1");
    } catch {}
  });
  const d = o.delays || {};
  await page.route("https://placeholder.supabase.co/**", async (route) => {
    const req = route.request();
    const url = req.url();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (url.includes("/auth/v1/token")) return json(route, session());
    if (url.includes("/auth/v1/user")) return json(route, session().user);
    if (url.includes("/auth/v1/logout")) { if (d.logout) await wait(d.logout); return route.fulfill({ status: 204, headers: CORS }); }
    if (url.includes("therapist_conversations")) {
      const single = (req.headers().accept || "").includes("vnd.pgrst.object");
      return json(route, single ? { id: "c1" } : [{ id: "c1" }]);
    }
    if (url.includes("/rest/v1/therapist")) return json(route, [{ id: "m1", role: "user", content: "Jak mi poszedł tydzień?", created_at: "2026-11-01T10:00:00Z" }, { id: "m2", role: "assistant", content: "Tydzień był spokojniejszy niż poprzedni. Najlepiej spałeś po spacerach.", created_at: "2026-11-01T10:00:05Z" }]);
    return json(route, []);
  });
  await page.route(/\/api\/cms\/entries/, async (route) => {
    if (route.request().method() !== "GET") return json(route, {});
    if (o.entriesFail) return json(route, { error: "test" }, 500);
    if (d.entries) await wait(d.entries);
    return json(route, { entries: o.noEntries ? [] : remoteEntries() });
  });
  await page.route(/\/api\/plan/, (route) => json(route, { tier: o.tier || "free", status: "active", hasStripeCustomer: false, currentPeriodEnd: null, cancelAtPeriodEnd: false, allowedPersonaIds: ["freud"] }));
  await page.route(/\/api\/limits/, (route) => json(route, {}));
  await page.route(/\/api\/admin\/usage/, (route) => json(route, { summary: [] }));
  await page.route(/\/api\/therapist/, (route) => route.fulfill({ status: 200, contentType: "text/plain", body: "Odpowiedź testowa." }));
  await page.route(/\/api\/search/, (route) => json(route, { hits: [] }));
  return { ctx, page };
}

// Czeka, aż React podepnie się pod przycisk (po hydratacji), żeby klik nie
// wysłał formularza „natywnie”.
async function hydrated(page, selector = "button") {
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      return Boolean(el && Object.keys(el).some((k) => k.startsWith("__reactProps")));
    },
    selector,
    { timeout: 30000 }
  );
}

async function login(page, base) {
  await page.goto(`${base}/welcome`, { waitUntil: "load" });
  await hydrated(page, 'button[type="submit"]');
  await page.getByLabel("E-mail").fill("test@example.com");
  await page.getByLabel("Hasło").fill("test-haslo");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/entries/, { timeout: 15000 });
}

async function settle(page, ms = 700) {
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await wait(ms);
}

async function close() {
  if (browser) await browser.close();
  browser = undefined;
}

module.exports = { open, login, settle, close, wait, hydrated, DEVICES };
