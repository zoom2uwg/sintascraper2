const fs = require('fs');
const cheerio = require('cheerio');

function analyzeListItems(filePath) {
    const html = fs.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(html);

    $('.ar-list-item').slice(0, 1).each((i, el) => {
        console.log(`--- ITEM ${filePath} ---`);
        console.log($(el).html());
        
        const title = $(el).find('.ar-title a').text().trim();
        const authors = $(el).find('.ar-meta, .uk-text-meta').text().replace(/\s+/g, ' ').trim();
        console.log("Extracted title:", title);
        console.log("Extracted authors:", authors);
    });
}
analyzeListItems('/home/user/uploads/SINTA - Science and Technology Index-AuthorResearch.html');
analyzeListItems('/home/user/uploads/SINTA - Science and Technology Index-AuthorsProfile.html');
