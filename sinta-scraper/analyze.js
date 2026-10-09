const fs = require('fs');
const cheerio = require('cheerio');

function analyzeFile(filePath) {
    console.log(`\n--- Analyzing ${filePath} ---`);
    const html = fs.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(html);

    // Look for lists/tables
    console.log("Found .ar-list-item:", $('.ar-list-item').length);
    console.log("Found .uk-card:", $('.uk-card').length);
    console.log("Found tr:", $('tr').length);
    
    // Check specific elements inside what might be a list
    const items = $('.ar-list-item').slice(0, 2);
    items.each((i, el) => {
        const title = $(el).find('.ar-title, .item-title, h3, a.ar-title').text().trim() || $(el).find('a').first().text().trim();
        const link = $(el).find('a').first().attr('href');
        console.log(`Item ${i+1}:`);
        console.log(`  Title: ${title}`);
        console.log(`  Link: ${link}`);
        console.log(`  HTML: ${$(el).html().substring(0, 200)}...`);
    });

    // For authors list in department page
    const authors = $('a[href*="/authors/profile/"]').slice(0, 2);
    console.log(`\nFound ${$('a[href*="/authors/profile/"]').length} author links`);
    authors.each((i, el) => {
        console.log(`Author ${i+1}: ${$(el).text().trim()} - ${$(el).attr('href')}`);
    });
}

analyzeFile('/home/user/uploads/SINTA - Science and Technology Index-DepartmentProfile.html');
analyzeFile('/home/user/uploads/SINTA - Science and Technology Index-AuthorsProfile.html');
analyzeFile('/home/user/uploads/SINTA - Science and Technology Index-AuthorResearch.html');

