const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));

  page.on('response', response => {
    if (!response.ok()) console.log('RESPONSE FAILED:', response.url(), response.status());
  });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 5000));
  const html = await page.content();
  const fs = require('fs');
  fs.writeFileSync('dom_dump.html', html);
  await browser.close();
})();
