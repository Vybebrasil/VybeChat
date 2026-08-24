const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('requestfailed', request =>
    console.log('REQUEST FAILED:', request.url(), request.failure().errorText)
  );

  console.log('Navigating to production...');
  const response = await page.goto('https://vybechat.pages.dev/', { waitUntil: 'networkidle' });
  console.log('Response status:', response.status());
  
  const rootContent = await page.evaluate(() => {
    return document.getElementById('root') ? document.getElementById('root').innerHTML : 'NO ROOT';
  });
  console.log('Root HTML:', rootContent);
  
  await browser.close();
})();
