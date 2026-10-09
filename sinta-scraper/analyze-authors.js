const fs = require('fs');
const cheerio = require('cheerio');

function findAuthorsList(filePath) {
    const html = fs.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(html);
    
    // Sometimes authors are in .profile-name or .author-name
    $('a[href*="/authors/profile/"]').slice(0, 10).each((i, el) => {
        if(!$(el).attr('href').endsWith('#')){
            console.log(`Href: ${$(el).attr('href')}`);
            console.log(`Text in A: ${$(el).text().trim()}`);
            console.log(`Parent HTML: ${$(el).parent().html()}`);
            console.log(`Next HTML: ${$(el).next().html()}`);
            console.log('---');
        }
    });
}

findAuthorsList('/home/user/uploads/SINTA - Science and Technology Index-Affiliation.html');
