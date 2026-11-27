// Визуальная сверка сайта: снимает все основные страницы на 3 ширинах
// и сравнивает с эталоном. Запуск из папки tools:
//   npm i && npx playwright install chromium
//   npm run baseline   — снять эталон (до правок)
//   npm run check      — снять заново и сравнить (после правок)
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const site = 'file://' + path.resolve(dir, '..', 'index.html');
const mode = process.argv[2] || 'check';
const out = path.join(dir, 'shots', mode === 'baseline' ? 'baseline' : 'current');
fs.mkdirSync(out, { recursive: true });

const routes = ['home', 'catalog', 'product/p-yana-3', 'cart', 'checkout', 'delivery', 'privacy', 'favorites'];
const widths = [390, 768, 1440];

const browser = await chromium.launch();
const ctx = await browser.newContext({ reducedMotion: 'reduce' });
let failed = 0;
for (const w of widths) {
  const page = await ctx.newPage();
  await page.setViewportSize({ width: w, height: 900 });
  await page.goto(site + '#home');
  await page.locator('[data-ck="all"]').click({ timeout: 3000 }).catch(() => {});
  for (const r of routes) {
    await page.goto(site + '#' + r);
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
    await page.waitForTimeout(700);
    await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach(i => (i.loading = 'eager')));
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } scrollTo(0, 0); });
    await page.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {}))));
    await page.waitForFunction(() => [...document.images].every(i => i.complete), null, { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    const name = `${r.replace(/\//g, '_')}-${w}.png`;
    const file = path.join(out, name);
    await page.screenshot({ path: file, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (overflow > 0) { console.log(`⚠ ${name}: горизонтальная прокрутка ${overflow}px`); failed++; }
    if (mode !== 'baseline') {
      const basePath = path.join(dir, 'shots', 'baseline', name);
      if (!fs.existsSync(basePath)) { console.log(`— ${name}: нет эталона`); continue; }
      const a = PNG.sync.read(fs.readFileSync(basePath));
      const b = PNG.sync.read(fs.readFileSync(file));
      if (a.width !== b.width || a.height !== b.height) {
        console.log(`✗ ${name}: размер ${a.width}x${a.height} → ${b.width}x${b.height}`); failed++; continue;
      }
      const diff = new PNG({ width: a.width, height: a.height });
      const n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
      const pct = (100 * n / (a.width * a.height)).toFixed(3);
      if (n > 0) {
        fs.mkdirSync(path.join(dir, 'shots', 'diff'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'shots', 'diff', name), PNG.sync.write(diff));
      }
      console.log(`${n === 0 ? '✓' : '✗'} ${name}: отличий ${pct}%`);
      if (n > 0) failed++;
    }
  }
  await page.close();
}
await browser.close();
console.log(mode === 'baseline' ? `Эталон сохранён: ${out}` : failed ? `Есть отличия: ${failed}. Смотрите tools/shots/diff` : 'Отличий нет');
process.exit(mode !== 'baseline' && failed ? 1 : 0);
