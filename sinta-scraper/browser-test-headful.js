const puppeteer = require('puppeteer-core');

const URL = 'https://sinta.kemdiktisaintek.go.id/departments/profile/2058/420D8E73-68F0-4044-86CF-5138D1419B20/8A894EDC-B2F1-4575-95B8-91EB1E708F4F/?view=scopus';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  console.log('BROWSER_TEST_HEADFUL_START');
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1366,900',
    ],
  });
  console.log('BROWSER_LAUNCH_OK');
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8' });

  const resp = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log('HTTP_STATUS=' + (resp ? resp.status() : 'no-response'));
  console.log('TITLE=' + (await page.title()));
  await new Promise((r) => setTimeout(r, 8000));

  try {
    await page.waitForSelector('.profile-article .ar-list-item, .pagination-text', { timeout: 15000 });
    console.log('SELECTOR_FOUND=true');
  } catch (e) {
    console.log('SELECTOR_FOUND=false');
  }

  const data = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.profile-article .ar-list-item')];
    const pag = document.querySelector('.pagination-text small');
    const dept = document.querySelector('.univ-name h3 a');
    return {
      count: items.length,
      pagination: pag ? pag.innerText.trim() : null,
      deptName: dept ? dept.innerText.trim() : null,
      firstTitle: items[0] ? items[0].querySelector('.ar-title a').innerText.trim().slice(0, 120) : null,
      bodySnippet: document.body ? document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 300) : null,
      url: location.href,
    };
  });
  console.log('RESULT=' + JSON.stringify(data, null, 2));
  await page.screenshot({ path: 'browser-test-shot.png' });
  console.log('SCREENSHOT_SAVED=browser-test-shot.png');
  await browser.close();
  console.log('BROWSER_TEST_DONE');
})().catch((e) => { console.error('BROWSER_TEST_FAIL: ' + (e && e.message)); process.exit(1); });
