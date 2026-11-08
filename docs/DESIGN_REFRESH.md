# Clinic design refresh

## Scope
Three local batches: clearer content and task hierarchy; shared tokens and metrics; loading/error/retry states and accessible feedback. Purple remains the brand accent. Booking, payment and clinical status colors retain semantic meaning.

Unsupported trust badges and hardcoded revenue chart data were removed. Revenue trends stay explicitly unavailable until verified reporting data exists. No invented clinic photographs were added; existing provider cards still use provider photos when supplied.

All four portal dashboards use the shared metric component. Remote font CSS was removed in favor of native font stacks: a blocked font import could leave Ionic's production critical CSS hiding the body. Public layout already supplies the fixed-navbar offset; the hero no longer adds that offset twice.

## Verification
Use Node 20 for this Angular 17 project (no previous runtime pin or engines field existed).

- Production compilation: nvm use 20, then ./node_modules/.bin/ng build.
- Unit tests: npm test -- --watch=false --browsers=ChromeHeadless. Set CHROME_BIN to an installed Chromium/Chrome executable when needed.
- Design token coverage: npm run test:design.
- Responsive smoke: build first, then npm run test:ui:offline (also accepts CHROME_BIN).

The responsive smoke serves only local build files. Every fetch/XHR receives a fixture, all nonlocal asset traffic is blocked, WebSockets are closed, and service workers are disabled. Screenshots are saved to the ignored test-results/design-refresh directory. These are fixture screenshots, not evidence of live data correctness.

Live authenticated/database integration tests are intentionally not run. Existing full E2E suites require backend access and remain outside this offline verification. There is no lint script/target configured. The app version prebuild generator is not invoked by the direct Angular compilation, avoiding unrelated version-file churn.
