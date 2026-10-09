const fs = require('fs');
const cheerio = require('cheerio');

function analyzeListItems(filePath) {
    console.log(`\n--- Detailed Analysis ${filePath} ---`);
    const html = fs.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(html);

    $('.ar-list-item').slice(0, 3).each((i, el) => {
        const title = $(el).find('.ar-title a').text().trim();
        const href = $(el).find('.ar-title a').attr('href');
        const meta = $(el).find('.ar-meta').text().replace(/\s+/g, ' ').trim();
        const year = $(el).find('.ar-year').text().trim();
        const pub = $(el).find('.ar-pub').text().trim();
        const authors = $(el).find('a.uk-text-meta').map((i, e) => $(e).text().trim()).get().join(', '); // Not sure if this is the correct selector
        
        console.log(`Item ${i+1}:`);
        console.log(`  Title: ${title}`);
        console.log(`  Href: ${href}`);
        console.log(`  HTML Sample: ${$(el).html().substring(0, 300).replace(/\n/g, '')}`);
    });
}

function findAuthorsList(filePath) {
    console.log(`\n--- Looking for Author List in ${filePath} ---`);
    const html = fs.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(html);
    
    // In department pages, authors are usually displayed in a specific list, let's see structure of .profile-author
    const authorLinks = $('a[href*="/authors/profile/"]').filter((i, el) => {
        return !$(el).attr('href').endsWith('#'); // exclude nav dropdowns
    });
    
    console.log(`Found ${authorLinks.length} actual author links`);
    authorLinks.slice(0, 5).each((i, el) => {
        console.log(`  Name: ${$(el).text().trim()}`);
        console.log(`  Href: ${$(el).attr('href')}`);
        console.log(`  Parent HTML: ${$(el).parent().html().substring(0, 100).replace(/\n/g, '')}`);
    });
    
    // Let's find exactly how the list of authors looks like in the Department Authors page. Wait, I only have DepartmentProfile, Affiliation, AuthorsProfile, AuthorResearch.
}

analyzeListItems('/home/user/uploads/SINTA - Science and Technology Index-AuthorsProfile.html');
analyzeListItems('/home/user/uploads/SINTA - Science and Technology Index-AuthorResearch.html');
findAuthorsList('/home/user/uploads/SINTA - Science and Technology Index-DepartmentProfile.html');
findAuthorsList('/home/user/uploads/SINTA - Science and Technology Index-Affiliation.html');
