const fs = require('fs');
const path = require('path');
const { extractPageData } = require('./src/parsers');

function analyzeFile(filePath) {
  console.log(`\n--- Analyzing ${path.basename(filePath)} ---`);
  const html = fs.readFileSync(filePath, 'utf-8');
  const data = extractPageData(html);

  console.log(`Page Type       : ${data.pageType}`);
  console.log(`Source URL      : ${data.url}`);
  console.log(`Logged In       : ${data.session.isLoggedIn} (${data.session.accountName || 'Guest'})`);
  console.log(`Entity Name     : ${data.header.name} (${data.header.entityType})`);
  console.log(`Active View     : ${data.activeView || '-'}`);
  console.log(`Available Views : ${data.navigation.availableViews.join(', ') || '-'}`);
  console.log(`Scores          : ${JSON.stringify(data.scores)}`);
  console.log(
    `Pagination      : Page ${data.pagination.currentPage} of ${data.pagination.totalPages} | Total Records: ${data.pagination.totalRecords} | hasNext: ${data.pagination.hasNext}`
  );
  console.log(`Departments     : ${data.departments.length}`);
  console.log(`Items           : ${data.items.length}`);

  data.items.slice(0, 2).forEach((item, i) => {
    console.log(`  Item ${i + 1}: [${item.dedup_key}] ${item.title} (${item.year})`);
    console.log(`    Meta: ${item.raw_metadata}`);
  });
}

const rootDir = path.resolve(__dirname, '..');
analyzeFile(path.join(rootDir, 'SINTA - Science and Technology Index-Affiliation.html'));
analyzeFile(path.join(rootDir, 'SINTA - Science and Technology Index-DepartmentProfile.html'));
analyzeFile(path.join(rootDir, 'SINTA - Science and Technology Index-AuthorsProfile.html'));
analyzeFile(path.join(rootDir, 'SINTA - Science and Technology Index-AuthorResearch.html'));
