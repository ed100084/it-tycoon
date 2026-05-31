import { chromium } from 'playwright';
import { existsSync } from 'fs';

const OUT_DIR = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const BASE = 'http://localhost:5173';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });

// ── 1. BIOS Boot Screen ───────────────────────────────────────────
console.log('[1/6] Navigating for boot screen...');
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
// Wait ~900ms so several boot lines have printed but animation is still running
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT_DIR}01-bios-boot.png`, fullPage: false });
console.log('  ✓ 01-bios-boot.png');

// Click to skip boot sequence and wait for game to appear
await page.click('.boot-sequence');
await page.waitForSelector('.game-layout', { timeout: 5000 });
await page.waitForTimeout(400); // let dashboardIn animation settle

// ── 2. Main Dashboard — 人員 tab (default) ────────────────────────
console.log('[2/6] Dashboard — 人員 tab...');
await page.screenshot({ path: `${OUT_DIR}02-dashboard-staff.png`, fullPage: false });
console.log('  ✓ 02-dashboard-staff.png');

// ── 3. 資安 tab ───────────────────────────────────────────────────
console.log('[3/6] 資安 tab...');
await page.click('button:has-text("資安")');
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT_DIR}03-security.png`, fullPage: false });
console.log('  ✓ 03-security.png');

// ── 4. 科技樹 tab ─────────────────────────────────────────────────
console.log('[4/6] 科技樹 tab...');
await page.click('button:has-text("科技樹")');
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT_DIR}04-techtree.png`, fullPage: false });
console.log('  ✓ 04-techtree.png');

// ── 5. 聲譽 tab ───────────────────────────────────────────────────
console.log('[5/6] 聲譽 tab...');
await page.click('button:has-text("聲譽")');
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT_DIR}05-reputation.png`, fullPage: false });
console.log('  ✓ 05-reputation.png');

// ── 6. 時間軸 tab ─────────────────────────────────────────────────
console.log('[6/6] 時間軸 tab...');
await page.click('button:has-text("時間軸")');
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT_DIR}06-timeline.png`, fullPage: false });
console.log('  ✓ 06-timeline.png');

await browser.close();
console.log('\nAll screenshots saved to:', OUT_DIR);
