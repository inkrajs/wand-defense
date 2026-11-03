/** Cold, isolated font audit; no screenshots or shared browser profiles.
 * node scripts/measure-font-downloads.mjs URL /absolute/path/to/playwright/index.mjs
 * Optional third argument --without-symbol-subset compares the dev server without
 * the original font stack (same app sources and sample corpus).
 * Service workers are blocked to separate font demand from PWA prefetch policy.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [url, playwrightPath, comparisonMode] = process.argv.slice(2);
if (!url || !playwrightPath) throw Error('Expected URL and installed Playwright module path');
const { chromium } = await import(pathToFileURL(path.resolve(playwrightPath)).href);
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
  ? walk(path.join(dir, entry.name)) : /\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.') ? [path.join(dir, entry.name)] : []);
const corpus = [...new Set([...walk('src').map(file => fs.readFileSync(file, 'utf8')).join('')])];
const samples = {
  chinese: corpus.filter(char => /\p{Script=Han}/u.test(char)).join(''),
  symbols: corpus.filter(char => char.codePointAt(0) > 127 && !/\p{Script=Han}/u.test(char)).join(''),
  latin: corpus.filter(char => char.codePointAt(0) >= 32 && char.codePointAt(0) < 127).join(''),
};
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1281, height: 954 } });
  const page = await context.newPage();

  const requests = new Map();
  const pending = [];
  context.on('response', response => {
    if (!/\.woff2?(?:\?|$)/.test(response.url())) return;
    pending.push(response.body().then(body => requests.set(response.url(), { url: response.url(), bytes: body.byteLength, status: response.status() })));
  });
  await page.goto(url);
  await page.locator('.game-shell').waitFor();
  if (comparisonMode === '--without-symbol-subset') {
    // Vite can inline @import, so compare font selection rather than URL routing.
    await page.addStyleTag({ content: ':root { --inkra-font-hand: "Inkra Xiaolai", "Trip Map Hand", "Kaiti SC", "STKaiti", cursive !important; }' });
  }
  await page.evaluate(() => document.fonts.ready);
  await Promise.all(pending);
  const firstScreen = [...requests.values()];
  await page.evaluate(samples => {
    const host = document.createElement('div'); host.id = 'font-measurement';
    host.style.cssText = 'position:fixed;top:-10000px;left:0;font:16px var(--inkra-font-hand);';
    for (const [name, text] of Object.entries(samples)) {
      const span = document.createElement('span'); span.id = `font-${name}`; span.textContent = text; host.append(span);
    }
    document.body.append(host);
  }, samples);
  await page.evaluate(() => document.fonts.ready);
  await Promise.all(pending);
  const cdp = await context.newCDPSession(page);
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument');
  const coverage = {};
  for (const [name, text] of Object.entries(samples)) {
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: `#font-${name}` });
    coverage[name] = { characters: [...text].length, ...(await cdp.send('CSS.getPlatformFontsForNode', { nodeId })) };
  }
  const sum = resources => resources.reduce((bytes, resource) => bytes + resource.bytes, 0);
  console.log(JSON.stringify({ url, serviceWorkers: 'blocked', comparisonMode: comparisonMode ?? 'current', inlineFontCssBytes: fs.existsSync('src/ui/fonts.css') ? fs.statSync('src/ui/fonts.css').size : 0, firstScreen: { bytes: sum(firstScreen), resources: firstScreen }, withCoverageProbe: { bytes: sum([...requests.values()]), resources: [...requests.values()] }, coverage }, null, 2));
} finally { await browser.close(); }
