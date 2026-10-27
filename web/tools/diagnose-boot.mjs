// Diagnose why boot() stalls: capture console, page errors and failed requests.
import puppeteer from 'puppeteer-core';

const URL = process.argv[2] || 'http://127.0.0.1:5200/';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--window-size=1400,900',
    '--no-sandbox',
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });

const logs = [];
page.on('console', (m) => logs.push(`[console.${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => logs.push(`[reqfail] ${r.url()} :: ${r.failure()?.errorText}`));
page.on('response', (r) => { if (r.status() >= 400) logs.push(`[http ${r.status()}] ${r.url()}`); });

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

// give boot() real wall-clock time, not virtual time
await new Promise((r) => setTimeout(r, 20000));

const state = await page.evaluate(() => {
  const loading = document.getElementById('loading');
  const bar = document.getElementById('loadbar');
  const panel = document.getElementById('eng-panel');
  const canvas = document.getElementById('c');
  return {
    loadingPresent: !!loading,
    loadingDisplay: loading ? getComputedStyle(loading).opacity : null,
    barWidth: bar ? bar.style.width : null,
    panelChildren: panel ? panel.children.length : null,
    panelText: panel ? panel.textContent.slice(0, 120) : null,
    canvasSize: canvas ? `${canvas.width}x${canvas.height}` : null,
    hasApp: typeof window.app !== 'undefined',
    sceneChildren: window.app?.scene?.children?.length ?? null,
    glassChildren: window.app?.tank?.glassGroup?.children?.length ?? null,
    fishSchools: window.app?.fishes?.schools?.size ?? null,
  };
});

console.log('=== page state after 20s ===');
console.log(JSON.stringify(state, null, 2));
console.log('\n=== console / errors (last 25) ===');
console.log(logs.slice(-25).join('\n') || '(none)');

await page.screenshot({ path: 'E:/逆向/鱼缸/web/shot-diag.png' });
await browser.close();
