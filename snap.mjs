import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

async function shot(url, file, opts = {}) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(opts.wait ?? 2500);
  await page.screenshot({
    path: file,
    fullPage: opts.fullPage ?? false,
    clip: opts.clip,
  });
  console.log("captured", file);
}

// Home — hero (above the fold)
await shot("http://localhost:3000/", "/tmp/01-hero.png");

// Home — full page
await shot("http://localhost:3000/", "/tmp/02-home-full.png", {
  fullPage: true,
});

// MarketView tabs — scroll to live-market then click each tab
await page.goto("http://localhost:3000/#live-market", {
  waitUntil: "domcontentloaded",
});
await page.waitForTimeout(2500);
await page.screenshot({ path: "/tmp/03-marketview-heatmap.png" });

for (const label of ["Spreads", "Order book", "Workloads"]) {
  await page.click(`button:has-text("${label}")`);
  await page.waitForTimeout(900);
  const safe = label.toLowerCase().replace(/\s+/g, "-");
  await page.screenshot({ path: `/tmp/04-marketview-${safe}.png` });
  console.log("captured tab", label);
}

// Agents page
await shot("http://localhost:3000/agents", "/tmp/05-agents.png", {
  fullPage: true,
});

// Mobile viewport — hero
await page.setViewportSize({ width: 390, height: 844 });
await shot("http://localhost:3000/", "/tmp/06-mobile-hero.png");

// Mobile — full
await shot("http://localhost:3000/", "/tmp/07-mobile-full.png", {
  fullPage: true,
});

await browser.close();
console.log("done");
