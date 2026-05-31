// CommonJS so NODE_PATH works
const { chromium } = require('playwright');
const path = require('path');

const OUT_DIR = __dirname + path.sep;
const BASE = 'http://localhost:5173';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  // ── 1. BIOS Boot Screen ──────────────────────────────────────────
  console.log('[1/6] Boot screen...');
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900); // let ~half the boot lines print
  await page.screenshot({ path: path.join(OUT_DIR, '01-bios-boot.png') });
  console.log('  ✓ 01-bios-boot.png');

  // Skip boot and wait for game
  await page.click('.boot-sequence');
  await page.waitForSelector('.game-layout', { timeout: 5000 });
  await page.waitForTimeout(400);

  // ── 2. 人員 tab ──────────────────────────────────────────────────
  console.log('[2/6] Dashboard 人員 tab...');
  await page.screenshot({ path: path.join(OUT_DIR, '02-dashboard-staff.png') });
  console.log('  ✓ 02-dashboard-staff.png');

  // ── 3. 資安 tab ──────────────────────────────────────────────────
  console.log('[3/6] 資安 tab...');
  await page.click('button:has-text("資安")');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT_DIR, '03-security.png') });
  console.log('  ✓ 03-security.png');

  // ── 4. 科技樹 tab ────────────────────────────────────────────────
  console.log('[4/6] 科技樹 tab...');
  await page.click('button:has-text("科技樹")');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT_DIR, '04-techtree.png') });
  console.log('  ✓ 04-techtree.png');

  // ── 5. 聲譽 tab ──────────────────────────────────────────────────
  console.log('[5/6] 聲譽 tab...');
  await page.click('button:has-text("聲譽")');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT_DIR, '05-reputation.png') });
  console.log('  ✓ 05-reputation.png');

  // ── 6. 時間軸 tab ────────────────────────────────────────────────
  console.log('[6/6] 時間軸 tab...');
  await page.click('button:has-text("時間軸")');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT_DIR, '06-timeline.png') });
  console.log('  ✓ 06-timeline.png');

  await browser.close();
  console.log('\nDone! Files saved in:', OUT_DIR);
})().catch(e => { console.error(e); process.exit(1); });
