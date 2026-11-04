// Audyt pomiarowy ekranów: 12 szerokości × 2 motywy. Mierzy: poziome przepełnienie
// strony, elementy poza ekranem, ucięty tekst, cele dotyku, liczbę rozmiarów
// czcionki w kadrze i kontrast każdego tekstu (WCAG 2.2 AA) względem jego tła.
// BASE=http://localhost:3000 ONLY=scena WIDTHS=320,375 THEMES=dark
const { chromium } = require("playwright");
const { open, login, close, hydrated, wait } = require("./harness");

const BASE = process.env.BASE || "http://localhost:3000";
const WIDTHS = (process.env.WIDTHS || "320,360,375,393,430,768,834,1024,1280,1366,1440,1920").split(",").map(Number);
const THEMES = (process.env.THEMES || "dark,light").split(",");
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;

const daysAgoLabel = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toLocaleDateString("pl-PL", { day: "numeric", month: "long" }); };

const SCENES = [
  { name: "dziennik-dzis", run: async (p) => { await p.goto(`${BASE}/entries`); await hydrated(p); } },
  {
    name: "dziennik-wpis", run: async (p, w) => {
      await p.goto(`${BASE}/entries`); await hydrated(p); await wait(300);
      if (w < 1024) await p.getByRole("button", { name: new RegExp(daysAgoLabel(1)) }).first().click();
      else { await p.locator('aside a[href^="/entries/"]').first().click(); await p.waitForURL(/\/entries\/.+/); }
    },
  },
  { name: "dziennik-zalogowany", run: async (p) => { await login(p, BASE); } },
  {
    name: "wiecej", maxWidth: 1023, run: async (p) => {
      await p.goto(`${BASE}/entries`); await hydrated(p); await wait(300);
      await p.getByRole("button", { name: "Więcej" }).click(); await wait(400);
    },
  },
  { name: "ustawienia", run: async (p) => { await p.goto(`${BASE}/settings`); await hydrated(p); } },
];

async function measure(page, phone) {
  return page.evaluate((phone) => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const de = document.documentElement;
    const cv = document.createElement("canvas"); cv.width = cv.height = 1;
    const cx = cv.getContext("2d", { willReadFrequently: true });
    const rgba = (css) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = "#000"; cx.fillStyle = css; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
    const parseAlpha = (css) => { const m = css.match(/\/\s*([\d.]+%?)\s*\)$/) || css.match(/rgba\([^)]*,\s*([\d.]+)\)$/); if (!m) return css === "transparent" || css === "rgba(0, 0, 0, 0)" ? 0 : 1; return m[1].endsWith("%") ? parseFloat(m[1]) / 100 : parseFloat(m[1]); };
    const colorOf = (css) => { const a = parseAlpha(css); const [r, g, b] = rgba(css); return [r, g, b, a]; };
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const blend = (top, under) => { const a = top[3]; return [top[0] * a + under[0] * (1 - a), top[1] * a + under[1] * (1 - a), top[2] * a + under[2] * (1 - a), 1]; };
    const bgOf = (el) => {
      const layers = [];
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        const c = colorOf(getComputedStyle(n).backgroundColor);
        if (c[3] > 0) { layers.push(c); if (c[3] >= 1) break; }
      }
      let base = colorOf(getComputedStyle(document.body).backgroundColor);
      if (base[3] < 1) base = [255, 255, 255, 1];
      for (let i = layers.length - 1; i >= 0; i--) base = blend(layers[i], base);
      return base;
    };
    const opacityOf = (el) => { let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return o; };
    const visible = (el) => { const s = getComputedStyle(el); if (s.display === "none" || s.visibility === "hidden" || +s.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const inView = (r) => r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
    const desc = (el) => { const t = (el.innerText || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "").trim().replace(/\s+/g, " ").slice(0, 32); return `${el.tagName.toLowerCase()}${t ? ` "${t}"` : ""}`; };
    const srOnly = (el) => { for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const s = getComputedStyle(n); if (s.clipPath && s.clipPath !== "none" && s.position === "absolute") return true; if (s.clip && s.clip !== "auto" && s.position === "absolute") return true; } return false; };
    const inScrollerX = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) return true; } return false; };

    const off = [], clipped = [], small = [], lowContrast = [];
    const sizes = new Map();
    for (const el of document.querySelectorAll("body *")) {
      if (!visible(el) || srOnly(el)) continue;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if ((r.right > vw + 1 || r.left < -1) && !inScrollerX(el) && r.top < vh && r.bottom > 0) off.push(desc(el));
      if ((s.overflowX === "hidden" || s.overflowX === "clip") && el.scrollWidth > el.clientWidth + 2 && el.children.length === 0 && (el.innerText || "").trim() && s.textOverflow !== "ellipsis") clipped.push(desc(el));
      const interactive = el.matches("a[href], button, input:not([type=hidden]), textarea, select, [role=button], [role=tab], [role=switch], [role=radio]") && !el.matches(":disabled, [aria-disabled=true], [aria-hidden=true]");
      if (interactive && inView(r)) {
        // Rozmiar celu z pseudo-elementami powiększającymi pole trafienia pomijamy — liczymy sam element.
        const min = phone ? 44 : 24;
        const before = getComputedStyle(el, "::before"), after = getComputedStyle(el, "::after");
        const expanded = [before, after].some((p) => p.content !== "none" && p.position === "absolute" && (parseFloat(p.height) >= min || p.top.startsWith("-") || p.inset));
        if ((r.width < min || r.height < min) && !expanded) small.push(`${desc(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      const ph = el.matches("input, textarea") && el.getAttribute("placeholder") && !el.value;
      if ((ownText || ph) && inView(r) && !el.closest("[aria-hidden=true]")) {
        const fs = parseFloat(s.fontSize);
        sizes.set(fs, (sizes.get(fs) || 0) + 1);
        if (el.closest(":disabled, [aria-disabled=true]")) continue;
        const fgCss = ph && !ownText ? getComputedStyle(el, "::placeholder").color : s.color;
        const bg = bgOf(el);
        let fg = colorOf(fgCss);
        fg = blend([fg[0], fg[1], fg[2], fg[3] * opacityOf(el)], bg);
        const a = lum(fg), b = lum(bg);
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        const large = fs >= 24 || (fs >= 18.66 && parseInt(s.fontWeight) >= 700);
        const need = large ? 3 : 4.5;
        if (ratio < need) lowContrast.push(`${desc(el)} ${ratio.toFixed(2)}:1 (${fs}px)`);
      }
    }
    return {
      overflowX: de.scrollWidth > vw + 1 ? `${de.scrollWidth}>${vw}` : "",
      off: [...new Set(off)].slice(0, 6), clipped: [...new Set(clipped)].slice(0, 6), small: [...new Set(small)].slice(0, 8),
      lowContrast: [...new Set(lowContrast)].slice(0, 8),
      sizes: [...sizes.keys()].sort((x, y) => x - y),
    };
  }, phone);
}

(async () => {
  let problems = 0;
  for (const scene of SCENES) {
    if (ONLY && !ONLY.includes(scene.name)) continue;
    for (const theme of THEMES) {
      const rows = [];
      for (const w of WIDTHS) {
        if (scene.maxWidth && w > scene.maxWidth) continue;
        const phone = w < 1024;
        const { ctx, page } = await open({ device: phone ? "phone" : "desktop", dark: theme === "dark", delays: {} });
        await page.setViewportSize({ width: w, height: phone ? 800 : 900 });
        try {
          await scene.run(page, w);
          await page.evaluate(() => document.fonts.ready);
          await wait(500);
          const m = await measure(page, w < 768);
          const issues = [];
          if (m.overflowX) issues.push(`przepełnienie ${m.overflowX}`);
          if (m.off.length) issues.push(`poza ekranem: ${m.off.join(" | ")}`);
          if (m.clipped.length) issues.push(`ucięty tekst: ${m.clipped.join(" | ")}`);
          if (m.small.length) issues.push(`małe cele: ${m.small.join(" | ")}`);
          if (m.lowContrast.length) issues.push(`kontrast: ${m.lowContrast.join(" | ")}`);
          if (m.sizes.length > 5) issues.push(`rozmiary czcionki: ${m.sizes.length} (${m.sizes.join(", ")})`);
          problems += issues.length;
          rows.push(`  ${String(w).padStart(4)}px  rozmiary [${m.sizes.join(", ")}]${issues.length ? "\n        " + issues.join("\n        ") : "  ok"}`);
        } catch (e) {
          problems++;
          rows.push(`  ${String(w).padStart(4)}px  BŁĄD ${String(e.message || e).split("\n")[0]}`);
        } finally {
          await ctx.close();
        }
      }
      console.log(`\n== ${scene.name} · ${theme}\n${rows.join("\n")}`);
    }
  }
  console.log(`\nproblemy: ${problems}`);
  await close();
})();
