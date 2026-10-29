import { defineConfig } from '@playwright/test';

const bsCaps = (profile: string, name: string) => {
  const caps: any = {
    'name': name,
    'build': process.env.BROWSERSTACK_BUILD_NAME || 'fp-cro-tests',
    'browserstack.username': process.env.BROWSERSTACK_USERNAME || '',
    'browserstack.accessKey': process.env.BROWSERSTACK_ACCESS_KEY || '',
    'client.playwrightVersion': '1.49.1',
  };
  if (profile === 'chrome') {
    caps.browser = 'chrome';
    caps.browser_version = 'latest';
    caps.os = 'osx';
    caps.os_version = 'sonoma';
  } else if (profile === 'webkit') {
    caps.browser = 'playwright-webkit';
    caps.os = 'osx';
    caps.os_version = 'sonoma';
  } else if (profile === 'iphone') {
    caps.browser = 'playwright-webkit';
    caps.os = 'ios';
    caps.os_version = '17';
    caps.device = 'iPhone 15';
    caps.realMobile = true;
  } else if (profile === 'win-chrome' || profile === 'win-edge') {
    caps.browser = profile === 'win-edge' ? 'edge' : 'chrome';
    caps.browser_version = 'latest';
    caps.os = 'Windows';
    caps.os_version = '11';
  } else if (profile === 'android') {
    // Real Android phones use Playwright's Android API (see tests/bs.ts), with BrowserStack's camelCase caps.
    caps.osVersion = '13.0';
    caps.deviceName = 'Samsung Galaxy S23';
    caps.browserName = 'chrome';
    caps.realMobile = 'true';
  }
  return caps;
};

const endpoint = (caps: any) =>
  `wss://cdp.browserstack.com/playwright?caps=${encodeURIComponent(JSON.stringify(caps))}`;

export default defineConfig({
  testDir: './tests',
  timeout: 120000,
  retries: 2,
  workers: 1, // the BrowserStack plan allows one session at a time; two workers collide ("Only one browser context is allowed")
  use: {
    baseURL: 'https://www.funeralprints.com',
  },
  projects: [
    {
      name: 'chrome',
      use: {
        connectOptions: {
          wsEndpoint: endpoint(bsCaps('chrome', 'FP Smoke - Desktop Chrome')),
          timeout: 30000,
        },
      },
    },
    {
      name: 'webkit',
      use: {
        connectOptions: {
          wsEndpoint: endpoint(bsCaps('webkit', 'FP Smoke - Desktop Safari')),
          timeout: 30000,
        },
      },
    },
    {
      name: 'iphone',
      use: {
        connectOptions: {
          wsEndpoint: endpoint(bsCaps('iphone', 'FP Smoke - iPhone 15 Safari')),
          timeout: 60000,
        },
      },
    },
    // Windows: ~44% of revenue in GA4 (Jul-Sep 2026: Chrome 31%, Edge 13%).
    { name: 'win-chrome', use: { connectOptions: { wsEndpoint: endpoint(bsCaps('win-chrome', 'FP Smoke - Windows Chrome')), timeout: 30000 } } },
    { name: 'win-edge', use: { connectOptions: { wsEndpoint: endpoint(bsCaps('win-edge', 'FP Smoke - Windows Edge')), timeout: 30000 } } },
    // Android: 17% of visits. MegaEdit's Android step flow is not automated yet (Oct 2026: after START and
    // Next the "Preview & Add to Basket" button never showed), so the designer journey is skipped here.
    { name: 'android', grepInvert: /Designer journey/, use: { connectOptions: { wsEndpoint: endpoint(bsCaps('android', 'FP Smoke - Samsung Galaxy S23')), timeout: 90000 } } },
    // Same phone on Lighthouse's "Slow 4G" profile (tests/bs.ts): do the main pages still load on weak signal?
    { name: 'android-4g', grep: /Homepage|Product page|Designer button/, timeout: 300000, use: { connectOptions: { wsEndpoint: endpoint(bsCaps('android', 'FP Smoke - Samsung Galaxy S23 slow 4G')), timeout: 90000 } } },
  ],
});
