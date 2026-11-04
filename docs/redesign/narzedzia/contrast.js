// Kontrast WCAG 2.x dla par kolorów OKLCH (bez zależności). Użycie: node contrast.js
function oklchToLinearSrgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => Math.min(1, Math.max(0, v)));
}
const toGamma = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const toLin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
// Kolor: [L, C, h] albo [L, C, h, alpha] nałożony na tło (blend w sRGB, jak przeglądarka).
function rgb(c, under) {
  const g = oklchToLinearSrgb(c[0], c[1], c[2]).map(toGamma);
  if (c[3] === undefined || !under) return g;
  const u = rgb(under);
  return g.map((v, i) => c[3] * v + (1 - c[3]) * u[i]);
}
const lum = (g) => { const [r, gg, b] = g.map(toLin); return 0.2126 * r + 0.7152 * gg + 0.0722 * b; };
function ratio(fg, bg, base) {
  const B = rgb(bg, base);
  const F = fg[3] !== undefined ? fg.slice(0, 3).map((_, i) => 0) && rgbBlend(fg, B) : rgb(fg);
  const a = lum(F), b = lum(B);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
function rgbBlend(c, underG) {
  const g = oklchToLinearSrgb(c[0], c[1], c[2]).map(toGamma);
  return g.map((v, i) => c[3] * v + (1 - c[3]) * underG[i]);
}
const hex = (c, base) => "#" + rgb(c, base).map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");

const T = {
  light: {
    background: [0.985, 0.002, 260], card: [1, 0, 0], popover: [1, 0, 0], muted: [0.955, 0.003, 260],
    foreground: [0.205, 0.006, 260], "muted-fg": [0.44, 0.008, 260], "subtle-fg": [0.52, 0.008, 260],
    primary: [0.205, 0.006, 260], "primary-fg": [0.985, 0.002, 260],
    border: [0.91, 0.003, 260], input: [0.64, 0.004, 260], ring: [0.45, 0.01, 260],
    destructive: [0.55, 0.2, 27], attention: [0.54, 0.15, 42], "meter-off": [0.88, 0.004, 260],
  },
  dark: {
    background: [0.185, 0.004, 260], card: [0.215, 0.004, 260], popover: [0.24, 0.005, 260], muted: [0.255, 0.005, 260],
    foreground: [0.925, 0.004, 260], "muted-fg": [0.74, 0.006, 260], "subtle-fg": [0.66, 0.006, 260],
    primary: [0.925, 0.004, 260], "primary-fg": [0.185, 0.004, 260],
    border: [0.3, 0.005, 260], input: [0.52, 0.006, 260], ring: [0.72, 0.01, 260],
    destructive: [0.7, 0.15, 25], attention: [0.76, 0.115, 55], "meter-off": [0.34, 0.005, 260],
  },
};

const PAIRS = [
  ["foreground", ["background", "card", "popover", "muted"], 4.5],
  ["muted-fg", ["background", "card", "popover", "muted"], 4.5],
  ["subtle-fg", ["background", "card", "popover", "muted"], 4.5],
  ["primary-fg", ["primary"], 4.5],
  ["destructive", ["background", "card", "muted"], 4.5],
  ["attention", ["background", "card", "muted"], 4.5],
  ["input", ["background", "card"], 3],
  ["ring", ["background", "card", "muted"], 3],
  ["foreground", ["meter-off"], 3],
  ["meter-off", ["background", "card"], 1],
  ["border", ["background", "card"], 1],
];

let fails = 0;
for (const [mode, t] of Object.entries(T)) {
  console.log(`\n== ${mode}`);
  for (const k of Object.keys(t)) console.log(`  ${k.padEnd(12)} ${hex(t[k])}`);
  for (const [fg, bgs, min] of PAIRS) {
    for (const bg of bgs) {
      const r = ratio(t[fg], t[bg]);
      const ok = r >= min;
      if (!ok) fails++;
      console.log(`  ${ok ? "ok " : "BAD"} ${fg} na ${bg}: ${r.toFixed(2)} (min ${min})`);
    }
  }
}
console.log(`\nbłędy: ${fails}`);
