const fs = require("fs");
const path = require("path");
const { chromium, webkit, firefox, devices } = require("playwright");

const ENGINES = { chromium, webkit, firefox };
const OUT = path.join(__dirname, "out");
fs.mkdirSync(OUT, { recursive: true });

// Testy nie mogą zaśmiecać statystyk właściciela — analityka jest blokowana.
const ANALYTICS = /(_vercel\/(insights|speed-insights)|va\.vercel-scripts|vitals\.vercel|googletagmanager|google-analytics|posthog|i\.posthog|\/ingest\/)/i;

async function makeContext(browserCache, cfg) {
  if (!browserCache[cfg.engine]) browserCache[cfg.engine] = await ENGINES[cfg.engine].launch();
  const base = cfg.device ? { ...devices[cfg.device] } : {};
  if (cfg.viewport) base.viewport = cfg.viewport;
  if (cfg.engine === "firefox") delete base.isMobile;
  const ctx = await browserCache[cfg.engine].newContext({ ...base, locale: cfg.locale || "pl-PL", timezoneId: "Europe/Warsaw" });
  await ctx.route(ANALYTICS, (r) => r.abort());
  return ctx;
}

function attachLogs(page, log) {
  page.on("console", (m) => {
    if (m.type() === "error" && !ANALYTICS.test(m.text()) && !ANALYTICS.test(m.location().url || "")) {
      log.console.push(m.text().slice(0, 300));
    }
  });
  page.on("pageerror", (e) => log.pageErrors.push(String(e.message || e).slice(0, 300)));
  page.on("response", (r) => {
    if (r.status() >= 400 && !ANALYTICS.test(r.url())) log.http.push(`${r.status()} ${r.url().slice(0, 160)}`);
  });
  page.on("requestfailed", (r) => {
    const why = r.failure()?.errorText || "";
    if (ANALYTICS.test(r.url()) || /aborted|cancel/i.test(why)) return;
    log.failed.push(`${why} ${r.url().slice(0, 160)}`);
  });
}

// Pomiar stanu strony: poziomy overflow, elementy poza ekranem, ucięty tekst, zepsute obrazy.
async function audit(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const de = document.documentElement;
    const desc = (el) => {
      const t = (el.innerText || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 40);
      const c = typeof el.className === "string" ? el.className.split(/\s+/).slice(0, 3).join(".") : "";
      return `${el.tagName.toLowerCase()}${c ? "." + c : ""}${t ? ` "${t}"` : ""}`;
    };
    const visible = (el) => {
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden" || +s.opacity === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const inScroller = (el) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (/(auto|scroll|hidden|clip)/.test(s.overflowX) && p !== document.body && p !== de) return true;
      }
      return false;
    };
    const off = [];
    const clipped = [];
    const small = [];
    for (const el of document.querySelectorAll("body *")) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if ((r.right > vw + 1 || r.left < -1) && !inScroller(el) && r.top < vh && r.bottom > 0) off.push(desc(el));
      const s = getComputedStyle(el);
      if (
        (s.overflowX === "hidden" || s.overflowX === "clip") &&
        el.scrollWidth > el.clientWidth + 2 &&
        el.children.length === 0 &&
        (el.innerText || "").trim().length > 0
      ) clipped.push(desc(el));
      if (el.matches("button, a[href], [role=tab]") && (r.width < 24 || r.height < 24) && r.top < vh && r.bottom > 0) small.push(`${desc(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    // Wewnętrzne kontenery przewijane w poziomie, które nie powinny się przewijać.
    const hScroll = [...document.querySelectorAll("body *")]
      .filter((el) => {
        if (!visible(el)) return false;
        const s = getComputedStyle(el);
        return /(auto|scroll)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 2 && !el.matches("[role=tablist]");
      })
      .map((el) => `${desc(el)} (${el.scrollWidth}>${el.clientWidth})`);
    const broken = [...document.images].filter((i) => visible(i) && i.complete && i.naturalWidth === 0 && i.getAttribute("loading") !== "lazy").map((i) => i.src.slice(0, 120));
    return {
      vw,
      vh,
      docScrollW: de.scrollWidth,
      pageOverflowX: de.scrollWidth > vw + 1,
      off: [...new Set(off)].slice(0, 8),
      clipped: [...new Set(clipped)].slice(0, 8),
      hScroll: [...new Set(hScroll)].slice(0, 8),
      small: [...new Set(small)].slice(0, 12),
      broken: [...new Set(broken)],
    };
  });
}

function newLog(name) {
  return { name, steps: [], console: [], pageErrors: [], http: [], failed: [], audits: {} };
}

async function step(log, label, fn) {
  try {
    const r = await fn();
    log.steps.push({ label, ok: true, note: r === undefined ? "" : r });
  } catch (e) {
    log.steps.push({ label, ok: false, note: String(e.message || e).split("\n")[0].slice(0, 220) });
  }
}

function shotPath(cfgName, label) {
  return path.join(OUT, `${cfgName}__${label}.png`);
}

function summarize(logs) {
  for (const l of logs) {
    const bad = l.steps.filter((s) => !s.ok);
    console.log(`\n=== ${l.name}: ${l.steps.length - bad.length}/${l.steps.length} kroków OK`);
    for (const s of bad) console.log(`  FAIL ${s.label}: ${s.note}`);
    for (const s of l.steps) if (s.ok && s.note && typeof s.note === "string" && s.note.startsWith("!")) console.log(`  UWAGA ${s.label}: ${s.note}`);
    for (const [k, a] of Object.entries(l.audits)) {
      const items = [];
      if (a.pageOverflowX) items.push(`overflow-x strony ${a.docScrollW}>${a.vw}`);
      if (a.off.length) items.push(`poza ekranem: ${a.off.join(" | ")}`);
      if (a.clipped.length) items.push(`ucięty tekst: ${a.clipped.join(" | ")}`);
      if (a.hScroll.length) items.push(`poziomy scroll: ${a.hScroll.join(" | ")}`);
      if (a.broken.length) items.push(`zepsute obrazy: ${a.broken.join(" | ")}`);
      if (items.length) console.log(`  [${k}] ${items.join("\n      ")}`);
    }
    const uniq = (x) => [...new Set(x)];
    if (l.pageErrors.length) console.log("  pageerror:", uniq(l.pageErrors).join(" || "));
    if (l.console.length) console.log("  console:", uniq(l.console).slice(0, 6).join(" || "));
    if (l.http.length) console.log("  http>=400:", uniq(l.http).slice(0, 10).join(" || "));
    if (l.failed.length) console.log("  failed:", uniq(l.failed).slice(0, 10).join(" || "));
  }
}

module.exports = { makeContext, attachLogs, audit, newLog, step, shotPath, summarize, OUT };
