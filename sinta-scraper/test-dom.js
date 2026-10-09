const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({ 
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
        headless: "new"
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    // Add realistic headers
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Upgrade-Insecure-Requests': '1'
    });

    try {
        const response = await page.goto('https://sinta.kemdiktisaintek.go.id/departments/profile/2058/420D8E73-68F0-4044-86CF-5138D1419B20/8A894EDC-B2F1-4575-95B8-91EB1E708F4F/?view=scopus', { waitUntil: 'networkidle2', timeout: 30000 });
        const title = await page.title();
        console.log("Status:", response.status());
        console.log("Title:", title);
        
        const lists = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('.ar-list-item, tr, .uk-card')).map(el => el.className).slice(0, 5);
        });
        console.log("List elements classes:", lists);
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await browser.close();
    }
})();
