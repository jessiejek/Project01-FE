// Offline UI verification: all API calls use fixtures; external traffic is blocked.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('@playwright/test');
const root = path.resolve('dist/app');
const output = path.resolve('test-results/design-refresh');
const doctor = { id: 'fixture-provider', fullName: 'Dr. Sample Provider', specialization: 'Family Medicine', consultationFee: 500, status: 'Active', averageRating: null, reviewCount: 0 };
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + '/') && file !== root) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
(async () => {
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    fs.mkdirSync(output, { recursive: true });
    browser = await chromium.launch({ headless: true, ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}) });
    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      const context = await browser.newContext({ viewport, serviceWorkers: 'block', reducedMotion: 'reduce' });
      await context.routeWebSocket('**/*', socket => socket.close());
      let mocked = 0;
      await context.route('**/*', route => {
        const req = route.request(); const url = new URL(req.url());
        if (['xhr', 'fetch'].includes(req.resourceType())) {
          mocked++;
          const body = url.pathname.endsWith('/doctors') ? [doctor] : url.pathname.endsWith('/settings') ? { clinicName: 'Dr. Grace E. Gavino Medical Clinic', clinic_name: 'Dr. Grace E. Gavino Medical Clinic' } : [];
          return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
        }
        if (url.origin === base) return route.continue();
        return route.abort();
      });
      const page = await context.newPage(); const errors = [];
      page.on('pageerror', e => { errors.push(e.message); console.error('Browser error: ' + e.message); });
      page.on('console', m => { if (m.type() === 'error') console.error('Console: ' + m.text()); });
      await page.goto(base + '/public', { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: 'Family medicine for adults and children', exact: true }).waitFor({ timeout: 5000 });
      await page.locator('.doctor-card__name').filter({ hasText: 'Dr. Sample Provider' }).waitFor();
      assert.equal(await page.locator('.hero__trust').count(), 0);
      assert.equal(await page.locator('.hero__cta-primary').getAttribute('href'), '/public/booking');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      assert.equal(overflow, false, 'No horizontal document overflow');
      const title = page.locator('.hero h1');
      assert.equal(await title.evaluate(el => getComputedStyle(el).textWrap), 'balance');
      const card = page.locator('.doctor-card').first();
      const duration = await card.evaluate(el => getComputedStyle(el).transitionDuration);
      assert(duration.split(',').every(value => parseFloat(value) <= 0.001), 'Reduced motion minimizes transitions');
      await page.screenshot({ path: path.join(output, 'home-' + viewport.width + '.png'), fullPage: true });
      assert.deepEqual(errors, [], 'No uncaught browser errors');
      console.log('PASS offline home ' + viewport.width + 'px; ' + mocked + ' fixture requests; no real API/database access');
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
