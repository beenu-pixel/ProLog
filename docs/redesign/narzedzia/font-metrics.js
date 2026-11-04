// Mierzy metryki Atkinson Hyperlegible Next/Mono względem Arial/Courier New, żeby
// zbudować krój zastępczy (size-adjust, ascent/descent-override) bez skoku tekstu.
const { open, close, hydrated } = require("./harness");
const BASE = process.env.BASE || "http://localhost:3000";
(async () => {
  const { ctx, page } = await open({ device: "desktop" });
  await page.goto(`${BASE}/entries`);
  await hydrated(page);
  await page.evaluate(() => document.fonts.ready);
  const r = await page.evaluate(async () => {
    const cs = getComputedStyle(document.documentElement);
    const vars = { sans: cs.getPropertyValue("--font-atkinson").trim(), mono: cs.getPropertyValue("--font-atkinson-mono").trim() };
    const first = (v) => v.split(",")[0].trim();
    const sample = "Jak minął dzień? Pięć krótkich ocen i kilka zdań. Spokojny wieczór, długi spacer po pracy. Źdźbło żółć gęś łąka ńś 0123456789";
    const c = document.createElement("canvas").getContext("2d");
    const m = (family) => {
      c.font = `400 100px ${family}`;
      const t = c.measureText(sample);
      return { w: t.width, asc: t.fontBoundingBoxAscent, desc: t.fontBoundingBoxDescent };
    };
    await document.fonts.load(`400 100px ${first(vars.sans)}`);
    await document.fonts.load(`400 100px ${first(vars.mono)}`);
    return { vars, sans: m(first(vars.sans)), arial: m("Arial"), mono: m(first(vars.mono)), courier: m('"Courier New"') };
  });
  const calc = (f, fb) => {
    const sa = f.w / fb.w;
    return { sizeAdjust: (sa * 100).toFixed(2) + "%", ascent: ((f.asc / 100 / sa) * 100).toFixed(2) + "%", descent: ((f.desc / 100 / sa) * 100).toFixed(2) + "%" };
  };
  console.log(JSON.stringify(r, null, 1));
  console.log("sans vs Arial:", calc(r.sans, r.arial));
  console.log("mono vs Courier New:", calc(r.mono, r.courier));
  await ctx.close();
  await close();
})();
