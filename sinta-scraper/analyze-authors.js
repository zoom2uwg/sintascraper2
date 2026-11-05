const fs = require('fs');
const path = require('path');
const { extractPageData } = require('./src/parsers');

function findAuthorsList(filePath) {
  const html = fs.readFileSync(filePath, 'utf-8');
  const data = extractPageData(html);

  console.log(`=== ${path.basename(filePath)} ===`);
  console.log(`Pagination: ${data.pagination.rawText}`);

  if (data.departments.length > 0) {
    data.departments.forEach((dept) => {
      console.log(`Department: ${dept.name} (${dept.level} - Kode: ${dept.code_prodi})`);
      console.log(`  Authors URL: ${dept.authors_url}`);
      dept.preview_authors.forEach((aut) => {
        console.log(`  Preview Author: [${aut.sinta_id}] ${aut.name} -> ${aut.profile_url}`);
      });
    });
  }

  if (data.authors.length > 0) {
    data.authors.forEach((aut) => {
      console.log(`Author: [${aut.sinta_id}] ${aut.name} -> ${aut.profile_url}`);
    });
  }
}

findAuthorsList(path.resolve(__dirname, '../SINTA - Science and Technology Index-Affiliation.html'));
