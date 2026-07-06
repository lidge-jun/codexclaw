# Playwright CLI for Debugging

Use Playwright as a debugging tool (not just a test runner) when the bug is in
a web surface: visual, routing, network, or state-dependent behavior.
Lineage: lazycodex `tools/playwright-cli.md`, adapted for codexclaw.

## When to Use (vs browser:control-in-app-browser)

Playwright is for DETERMINISTIC repro: a spec file that fails red and passes
green. For one-shot exploratory QA, use the native browser tools per
`dev-testing` QA-TOOL-LADDER-01.

## Quick Repro Spec

```bash
npx playwright codegen http://localhost:3000    # record actions -> code
```

One-shot repro from a bug description:

```typescript
import { test, expect } from '@playwright/test';
test('bug: empty cart shows 500', async ({ page }) => {
  await page.goto('http://localhost:3000/cart');
  await expect(page.locator('.cart-items')).toBeVisible();
  // if this fails, the bug is real and reproducible
});
```

## Debug Mode

```bash
PWDEBUG=1 npx playwright test --headed    # opens inspector, pauses on test
npx playwright test --debug               # same (shorthand)
npx playwright test --ui                  # interactive UI mode
```

## Trace Viewer (post-mortem)

```bash
npx playwright test --trace on            # record trace
npx playwright show-trace test-results/trace.zip   # replay
```

Trace contains: screenshots per action, DOM snapshots, network log, console
log. Often sufficient to find the bug without live debugging.

## Useful Listeners for Agent Debugging

```typescript
page.on('console', msg => console.log(`[browser] ${msg.type()}: ${msg.text()}`));
page.on('pageerror', err => console.error(`[browser error]`, err));
page.on('request', req => console.log(`>> ${req.method()} ${req.url()}`));
page.on('response', res => console.log(`<< ${res.status()} ${res.url()}`));
```

## Viewport / Device Gotchas

- Always set viewport explicitly: `page.setViewportSize({ width: 1440, height: 900 })`
- `isMobile: true` changes touch behavior and user-agent — test with and without
- Default headless viewport is 1280x720; headed is the OS window size

## Cleanup

```bash
# Kill Playwright browsers
pkill -f 'chromium.*--headless' || true
pkill -f 'playwright' || true
# Remove trace files if not needed
rm -rf test-results/ playwright-report/
```
