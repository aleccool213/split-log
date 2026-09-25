// Renders the app icon set and the link-preview card from public/favicon.svg
// and data/split-log.csv. The card is stored as scripts/og-card.b64, which
// `npm run og` materializes into public/og.png at build time.
// Run: node scripts/render-brand.mjs  (uses Playwright + Chromium; needs network for the font)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync, execSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = (f) => join(root, "public", f);

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  const g = execSync("npm root -g").toString().trim();
  ({ chromium } = createRequire(join(g, "noop.js"))("playwright"));
}

const BLUE = "#4f6ef7";
const PALE = "#c5cffc";

const mark = readFileSync(pub("favicon.svg"), "utf8");
// Same mark with extra blue padding, for the maskable icon's safe zone.
const markPadded = mark
  .replace('viewBox="0 0 32 32"', 'viewBox="-6 -6 44 44"')
  .replace('<rect width="32" height="32"', '<rect x="-6" y="-6" width="44" height="44"');

// Headless Chromium can't always reach Google Fonts, so inline the TTFs as data URIs.
function fontFaces() {
  const get = (url, enc) => execFileSync("curl", ["-fsSL", url], { encoding: enc, maxBuffer: 1 << 24 });
  const css = get("https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;800", "utf8");
  return css.replace(/url\((https:[^)]+)\)/g, (_, url) => `url(data:font/ttf;base64,${get(url, "buffer").toString("base64")})`);
}

function paceChart() {
  const rows = readFileSync(join(root, "data/split-log.csv"), "utf8").trim().split("\n").slice(1);
  const paces = rows
    .map((r) => r.split(",")[5])
    .filter(Boolean)
    .map((p) => {
      const [m, s] = p.split(":");
      return Number(m) * 60 + Number(s);
    });
  const W = 460, H = 300, L = 70, R = 20, T = 20, B = 30;
  const lo = Math.floor(Math.min(...paces) / 10) * 10 - 5;
  const hi = Math.ceil(Math.max(...paces) / 10) * 10 + 5;
  const x = (i) => L + (i * (W - L - R)) / Math.max(paces.length - 1, 1);
  const y = (v) => T + ((v - lo) * (H - T - B)) / (hi - lo);
  const fmt = (v) => `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, "0")}`;
  const grid = [];
  for (let v = Math.ceil(lo / 10) * 10; v <= hi; v += 10) {
    grid.push(`<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#ececec" stroke-width="2"/>`);
    grid.push(`<text x="${L - 14}" y="${y(v) + 7}" text-anchor="end">${fmt(v)}</text>`);
  }
  const pts = paces.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const dots = paces.map((v, i) => `<rect x="${x(i) - 7}" y="${y(v) - 7}" width="14" height="14" fill="${i === paces.length - 1 ? BLUE : "#fff"}" stroke="${BLUE}" stroke-width="3"/>`);
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="JetBrains Mono" font-size="20" fill="#555">
    ${grid.join("")}
    <polyline points="${pts}" fill="none" stroke="${BLUE}" stroke-width="4" stroke-linejoin="bevel"/>
    ${dots.join("")}
  </svg>`;
}

const cardHtml = `<!doctype html><html><head><meta charset="utf-8">
<style>
${fontFaces()}
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; font-family: "JetBrains Mono", monospace; color: #000;
    background: #fafafa radial-gradient(${PALE} 2.4px, transparent 2.4px) 0 0 / 30px 30px; }
  .card { position: absolute; inset: 60px; background: #fff; border: 2px solid #d4d4d4;
    display: flex; align-items: center; justify-content: space-between; padding: 0 56px 0 64px; gap: 40px; }
  .card::after { content: ""; position: absolute; left: -2px; right: -2px; top: -2px; height: 12px; background: ${BLUE}; }
  .left { display: flex; flex-direction: column; gap: 22px; }
  .brand { display: flex; align-items: center; gap: 26px; }
  .brand svg { width: 104px; height: 104px; display: block; }
  h1 { font-size: 74px; font-weight: 800; letter-spacing: -0.03em; line-height: 1; }
  p { font-size: 30px; color: #555; line-height: 1.35; max-width: 500px; }
  .tags { display: flex; gap: 12px; margin-top: 6px; }
  .tags span { font-size: 20px; font-weight: 500; padding: 8px 14px; border: 2px solid #d4d4d4; }
  .tags span.hot { background: ${BLUE}; color: #fff; border-color: ${BLUE}; }
  .legend { margin: 10px 0 0 70px; font-size: 18px; color: #555; display: flex; justify-content: space-between; width: 370px; }
</style></head><body>
<div class="card">
  <div class="left">
    <div class="brand">${mark}<h1>Split<br>Log</h1></div>
    <p>Concept2 training log — splits, volume, and the next session.</p>
    <div class="tags"><span class="hot">Splits</span><span>Pace</span><span>Volume</span><span>PBs</span></div>
  </div>
  <div>
    ${paceChart()}
    <div class="legend"><span>Avg /500m pace</span><span>by session</span></div>
  </div>
</div>
</body></html>`;

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_BROWSERS_PATH ? {} : { executablePath: "/opt/pw-browsers/chromium" },
);
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function png(html, w, h) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  return page.screenshot({ clip: { x: 0, y: 0, width: w, height: h } });
}

const iconPage = (svg, s) =>
  `<!doctype html><style>*{margin:0}svg{display:block;width:${s}px;height:${s}px}</style>${svg}`;

const out = {
  "__grok/icon-180.png": await png(iconPage(mark, 180), 180, 180),
  "icon-192.png": await png(iconPage(mark, 192), 192, 192),
  "icon-512.png": await png(iconPage(mark, 512), 512, 512),
  "icon-maskable-512.png": await png(iconPage(markPadded, 512), 512, 512),
};
for (const [f, buf] of Object.entries(out)) {
  writeFileSync(pub(f), buf);
  console.log("wrote public/" + f);
}

const card = await png(cardHtml, 1200, 630);
writeFileSync(join(root, "scripts/og-card.b64"), card.toString("base64") + "\n");
writeFileSync(pub("og.png"), card);
console.log(`wrote scripts/og-card.b64 + public/og.png (${card.length} bytes)`);

await browser.close();
