import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

// Collect console messages
const logs = [];
page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => logs.push(`[PAGE_ERROR] ${err.message}`));

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
console.log('Page loaded, waiting 5s...');
await page.waitForTimeout(5000);

// Get error overlay message
const errorMsg = await page.evaluate(() => {
  const overlay = document.querySelector('vite-error-overlay');
  if (!overlay) return 'NO_VITE_OVERLAY';
  const shadow = overlay.shadowRoot;
  if (!shadow) return 'NO_SHADOW_ROOT';
  const msg = shadow.querySelector('.message-body')?.textContent || shadow.querySelector('.error-message')?.textContent || shadow.textContent || 'UNKNOWN';
  return msg.trim();
});
console.log('Vite Error:', errorMsg);

// Also check console errors
console.log('\n--- Console logs ---');
logs.forEach(l => console.log(l));

// Take a screenshot
await page.screenshot({ path: '/tmp/dark-isle-debug.png' });
console.log('Screenshot saved to /tmp/dark-isle-debug.png');

await browser.close();
