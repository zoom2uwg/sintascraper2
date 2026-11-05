const fs = require('fs');
const path = require('path');
const { extractPageData } = require('./src/parsers');

function analyzeFirstItem(filePath) {
  const html = fs.readFileSync(filePath, 'utf-8');
  const data = extractPageData(html);

  console.log(`\n--- FIRST ITEM: ${path.basename(filePath)} ---`);
  if (data.items.length > 0) {
    console.log(JSON.stringify(data.items[0], null, 2));
  } else {
    console.log('No .ar-list-item on this page.');
  }
}

const rootDir = path.resolve(__dirname, '..');
analyzeFirstItem(path.join(rootDir, 'SINTA - Science and Technology Index-AuthorResearch.html'));
analyzeFirstItem(path.join(rootDir, 'SINTA - Science and Technology Index-AuthorsProfile.html'));
analyzeFirstItem(path.join(rootDir, 'SINTA - Science and Technology Index-DepartmentProfile.html'));
