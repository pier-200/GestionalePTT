// Genera le icone PNG della PWA da public/icona.svg (Playwright + Microsoft Edge).
//   node scripts/icone.mjs
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const svg = readFileSync('public/icona.svg', 'utf8');
const font = readFileSync('node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2').toString('base64');
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage();
for (const [nome, lato, scala] of [['icona-512', 512, 1], ['icona-192', 192, 1], ['icona-180', 180, 1], ['icona-maskable-512', 512, 0.78]]) {
  await page.setViewportSize({ width: lato, height: lato });
  await page.setContent(`<style>@font-face{font-family:'Barlow Condensed';font-weight:700;src:url(data:font/woff2;base64,${font})}
    html,body{margin:0;background:#f6f7f4}div{width:${lato}px;height:${lato}px;display:grid;place-items:center}svg{width:${lato * scala}px;height:${lato * scala}px}</style><div>${svg}</div>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `public/${nome}.png` });
}
await browser.close();
console.log('Icone generate in public/');
