const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const ExcelJS = require('exceljs');
const { createObjectCsvWriter } = require('csv-writer');
const fs = require('fs');

const SINTA_USER = process.env.SINTA_USERNAME || process.env.SINTA_USER;
const SINTA_PASS = process.env.SINTA_PASSWORD || process.env.SINTA_PASS;

function getChromeExecutablePath() {
    if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
    if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
    const paths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    ];
    for (const p of paths) {
        if (fs.existsSync(p)) return p;
    }
    return undefined;
}

const DEPARTMENTS = [
    {
        name: 'Informatika',
        url: 'https://sinta.kemdiktisaintek.go.id/departments/profile/2058/420D8E73-68F0-4044-86CF-5138D1419B20/8A894EDC-B2F1-4575-95B8-91EB1E708F4F',
        authorsUrl: 'https://sinta.kemdiktisaintek.go.id/departments/authors/2058/420D8E73-68F0-4044-86CF-5138D1419B20/8A894EDC-B2F1-4575-95B8-91EB1E708F4F'
    },
    {
        name: 'Bisnis Digital',
        url: 'https://sinta.kemdiktisaintek.go.id/departments/profile/2058/420D8E73-68F0-4044-86CF-5138D1419B20/BB930200-F625-4220-BD63-94F4D1FD2E50',
        authorsUrl: 'https://sinta.kemdiktisaintek.go.id/departments/authors/2058/420D8E73-68F0-4044-86CF-5138D1419B20/BB930200-F625-4220-BD63-94F4D1FD2E50'
    },
    {
        name: 'Sistem dan Teknologi Informasi',
        url: 'https://sinta.kemdiktisaintek.go.id/departments/profile/2058/420D8E73-68F0-4044-86CF-5138D1419B20/895FD91B-B0F2-41E7-99EB-F2D3997A9B0F',
        authorsUrl: 'https://sinta.kemdiktisaintek.go.id/departments/authors/2058/420D8E73-68F0-4044-86CF-5138D1419B20/895FD91B-B0F2-41E7-99EB-F2D3997A9B0F'
    }
];

const VIEWS = ['scopus', 'garuda', 'googlescholar', 'researches', 'services', 'iprs', 'books'];

// Helper for Delay
const delay = ms => new Promise(res => setTimeout(res, ms));

async function scrapeTableData(page) {
    // Tries to extract a generic table or list structure on SINTA.
    // Adapts to standard SINTA structure containing lists of titles/authors/links.
    return await page.evaluate(() => {
        const items = [];
        document.querySelectorAll('.ar-list-item, .uk-card, tr.d-item, .row.d-item').forEach(el => {
            const titleEl = el.querySelector('.ar-title a') || el.querySelector('.item-title, h3, h4, a');
            const metaEl = el.querySelector('.ar-meta') || el.querySelector('.item-authors, .authors, .uk-text-meta');
            const linkEl = titleEl || el.querySelector('a');
            
            if (titleEl && titleEl.innerText.trim() !== '') {
                items.push({
                    title: titleEl.innerText.trim(),
                    authors: metaEl ? metaEl.innerText.replace(/\s+/g, ' ').trim() : '-',
                    link: linkEl ? linkEl.href : '-'
                });
            }
        });
        return items;
    });
}

async function scrapeAuthorsFromDept(page, url) {
    console.log(`Navigating to Authors list: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await delay(2000);
    
    return await page.evaluate(() => {
        const authorLinks = [];
        document.querySelectorAll('a[href*="/authors/profile/"]').forEach(a => {
            const name = a.innerText.trim();
            if (name && !authorLinks.some(l => l.url === a.href)) {
                authorLinks.push({
                    name: name,
                    url: a.href
                });
            }
        });
        return authorLinks;
    });
}

async function runScraper() {
    console.log("Starting SINTAScraper...");

    const chromePath = getChromeExecutablePath();
    console.log("Using browser:", chromePath || "Default Puppeteer Chrome");

    const launchOptions = {
        headless: process.env.HEADLESS === 'true' ? true : false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    };
    if (chromePath) {
        launchOptions.executablePath = chromePath;
    }

    const browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });

    try {
        console.log("Navigating to login page...");
        await page.goto('https://sinta.kemdiktisaintek.go.id/logins', { waitUntil: 'networkidle2' });
        
        if (SINTA_USER && SINTA_PASS) {
            console.log(`Filling login form for: ${SINTA_USER}...`);
            await page.waitForSelector('input[name="username"], input[name="email"]', { timeout: 15000 }).catch(() => null);
            const userSelector = (await page.$('input[name="username"]')) ? 'input[name="username"]' : 'input[name="email"]';
            
            if (await page.$(userSelector)) {
                await page.type(userSelector, SINTA_USER);
                await page.type('input[name="password"]', SINTA_PASS);
                
                await Promise.all([
                    page.click('button[type="submit"], input[type="submit"]'),
                    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => null)
                ]);
                await delay(3000);
                console.log("Login submitted, current URL:", page.url());
                console.log("Proceeding to scrape...");
            }
        } else {
            console.log("No credentials found in .env, attempting to bypass login (Public View).");
        }
        
        let allExtractedData = [];

        // 1. Iterate over Departments
        for (const dept of DEPARTMENTS) {
            console.log(`\n=== Processing Department: ${dept.name} ===`);
            
            for (const view of VIEWS) {
                const targetUrl = `${dept.url}/?view=${view}`;
                console.log(`Scraping View: ${view} -> ${targetUrl}`);
                
                await page.goto(targetUrl, { waitUntil: 'networkidle2' });
                await delay(2000 + Math.random() * 2000); // Dynamic delay
                
                const data = await scrapeTableData(page);
                data.forEach(item => {
                    allExtractedData.push({
                        entityType: 'Department',
                        entityName: dept.name,
                        category: view,
                        title: item.title,
                        authors: item.authors,
                        link: item.link
                    });
                });
            }

            // 2. Extract Authors for this department
            const authors = await scrapeAuthorsFromDept(page, dept.authorsUrl);
            console.log(`Found ${authors.length} authors in ${dept.name}`);

            // 3. Iterate over Authors
            for (const author of authors) {
                console.log(`\n--- Processing Author: ${author.name} (${author.url}) ---`);
                
                for (const view of VIEWS) {
                    const authorTargetUrl = `${author.url}/?view=${view}`;
                    console.log(`Scraping Author View: ${view} -> ${authorTargetUrl}`);
                    
                    await page.goto(authorTargetUrl, { waitUntil: 'networkidle2' });
                    await delay(1500 + Math.random() * 1500); // Dynamic delay
                    
                    const data = await scrapeTableData(page);
                    data.forEach(item => {
                        allExtractedData.push({
                            entityType: 'Author',
                            entityName: author.name,
                            category: view,
                            title: item.title,
                            authors: item.authors,
                            link: item.link
                        });
                    });
                }
            }
        }

        // --- EXPORT DATA ---
        console.log(`\nExtracted total ${allExtractedData.length} records. Exporting data...`);
        
        // 1. Export CSV
        const csvWriter = createObjectCsvWriter({
            path: 'sinta_export.csv',
            header: [
                { id: 'entityType', title: 'TYPE' },
                { id: 'entityName', title: 'NAME' },
                { id: 'category', title: 'CATEGORY' },
                { id: 'title', title: 'TITLE' },
                { id: 'authors', title: 'AUTHORS' },
                { id: 'link', title: 'LINK' }
            ]
        });
        await csvWriter.writeRecords(allExtractedData);

        // 2. Export Excel
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('SINTA Data');
        sheet.columns = [
            { header: 'Type', key: 'entityType', width: 15 },
            { header: 'Name', key: 'entityName', width: 30 },
            { header: 'Category', key: 'category', width: 15 },
            { header: 'Title', key: 'title', width: 50 },
            { header: 'Authors', key: 'authors', width: 30 },
            { header: 'Link', key: 'link', width: 40 }
        ];
        sheet.addRows(allExtractedData);
        await workbook.xlsx.writeFile('sinta_export.xlsx');

        // 3. Export HTML
        let htmlContent = `
        <html>
        <head>
            <title>SINTA Scrape Results</title>
            <style>
                table { border-collapse: collapse; width: 100%; font-family: sans-serif; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
            </style>
        </head>
        <body>
            <h2>SINTA Scraper Results</h2>
            <table>
                <tr>
                    <th>Type</th><th>Name</th><th>Category</th><th>Title</th><th>Authors</th><th>Link</th>
                </tr>
                ${allExtractedData.map(r => `
                <tr>
                    <td>${r.entityType}</td>
                    <td>${r.entityName}</td>
                    <td>${r.category}</td>
                    <td>${r.title}</td>
                    <td>${r.authors}</td>
                    <td><a href="${r.link}" target="_blank">Link</a></td>
                </tr>
                `).join('')}
            </table>
        </body>
        </html>`;
        fs.writeFileSync('sinta_export.html', htmlContent);

        console.log("All data successfully exported to sinta_export.csv, sinta_export.xlsx, and sinta_export.html");

    } catch (err) {
        console.error("An error occurred during scraping:", err);
    } finally {
        await browser.close();
        console.log("Browser closed. Process finished.");
    }
}

runScraper();
