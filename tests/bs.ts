import { test as base, expect, type Page } from '@playwright/test';

// One BrowserStack session per check (and per retry), named after the check, so the BrowserStack
// dashboard reads "iPhone 15 · Designer journey ..." instead of one "FP Smoke" session per browser,
// and each video shows exactly one check. A fresh connection per test also avoids the real iPhone's
// "Only one browser context is allowed" error, which hit every second check on a shared connection.
// At the start of each check the browser looks up where it is running (ipinfo.io), and at the end the
// session is marked passed or failed on BrowserStack. Lines parsed by .github/scripts/update-history.mjs:
// "Session: <url>", "Video: <url>", "Where: <city, region, country>".

// Lighthouse's mobile "Slow 4G" profile: 1.6 Mbps down, 750 kbps up, 150 ms round trip.
const SLOW_4G = { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 };
const DEVICE: Record<string, string> = {
  chrome: 'Mac Chrome', webkit: 'Mac Safari', iphone: 'iPhone 15', 'win-chrome': 'Windows Chrome', 'win-edge': 'Windows Edge',
  android: 'Galaxy S23', 'android-4g': 'Galaxy S23 slow 4G',
};

const exec = (page: Page, action: object) =>
  page.evaluate(() => {}, `browserstack_executor: ${JSON.stringify(action)}`);

export const test = base.extend({
  context: async ({ playwright, baseURL }, use, testInfo) => {
    const endpoint: string = (testInfo.project.use as any).connectOptions.wsEndpoint;
    const url = new URL(endpoint);
    const caps = JSON.parse(url.searchParams.get('caps')!);
    caps.name = `${DEVICE[testInfo.project.name] ?? testInfo.project.name} · ${testInfo.title}${testInfo.retry ? ` (retry ${testInfo.retry})` : ''}`;
    url.searchParams.set('caps', JSON.stringify(caps));
    let context: any, close: () => Promise<void>;
    if (testInfo.project.name.startsWith('android')) {
      // Real Android phones are driven through Playwright's Android API: connect to the phone, then open Chrome on it.
      const device = await (playwright as any)._android.connect(url.toString(), { timeout: 90000 });
      await device.shell('am force-stop com.android.chrome');
      context = await device.launchBrowser({ baseURL });
      close = () => device.close();
    } else {
      const browser = await playwright.chromium.connect(url.toString(), { timeout: 90000 });
      context = await browser.newContext({ baseURL });
      close = () => browser.close();
    }
    await use(context);
    const page = context.pages()[0];
    if (page) {
      const passed = testInfo.status === testInfo.expectedStatus;
      const reason = passed ? 'passed' : (testInfo.error?.message || 'failed').split('\n')[0].slice(0, 250);
      await exec(page, { action: 'setSessionStatus', arguments: { status: passed ? 'passed' : 'failed', reason } }).catch(() => {});
    }
    await context.close().catch(() => {});
    await close().catch(() => {});
  },
  page: async ({ context }, use, testInfo) => {
    const page = await context.newPage();
    if (testInfo.project.name.endsWith('-4g')) {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', SLOW_4G);
      // On the real Android phone setDefaultNavigationTimeout does not take; only a timeout passed to goto
      // does (3 Oct: the first throttled homepage load took 32s against the 30s default).
      const goto = page.goto.bind(page);
      page.goto = (url: string, o: any = {}) => goto(url, { timeout: 120000, ...o });
    }
    try {
      const raw = await exec(page, { action: 'getSessionDetails' });
      const d = JSON.parse(String(raw));
      if (d.public_url) console.log(`Session: ${d.public_url}`);
      if (d.video_url) console.log(`Video: ${d.video_url}`);
    } catch {}
    try {
      await page.goto('https://ipinfo.io/json', { timeout: 15000 });
      const j = JSON.parse(await page.locator('body').innerText());
      console.log(`Where: ${[j.city, j.region, j.country].filter(Boolean).join(', ')}`);
    } catch { console.log('Where: unknown'); }
    await use(page);
  },
});

export { expect };
