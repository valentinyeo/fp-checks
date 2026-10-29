# fp-checks

Scheduled Playwright checks for https://www.funeralprints.com, run on BrowserStack real devices four times a day (9am, noon, 3pm, 6pm US Eastern).

The repo is public so the runs use free GitHub Actions minutes. Credentials live in encrypted repository secrets. Results and BrowserStack session details are committed to the private report repo through a write-only deploy key.

Secrets: `BROWSERSTACK_USERNAME`, `BROWSERSTACK_ACCESS_KEY`, `FP_LOGIN_EMAIL`, `FP_LOGIN_PASSWORD`, `SITE_DEPLOY_KEY`.
