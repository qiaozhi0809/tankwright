import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--window-size=1400,900'] });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });
await page.goto(process.argv[2], { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise(r => setTimeout(r, 25000));
const st = await page.evaluate(() => ({
  loading: document.getElementById('loading') ? getComputedStyle(document.getElementById('loading')).opacity : 'removed',
  panel: document.getElementById('eng-panel') ? document.getElementById('eng-panel').children.length : -1,
  scene: window.app?.scene?.children?.length,
  glass: window.app?.tank?.glassGroup?.children?.length,
  fishes: window.app?.fishes?.schools?.size,
}));
console.log(JSON.stringify(st));
await page.screenshot({ path: process.argv[3] });
await browser.close();
