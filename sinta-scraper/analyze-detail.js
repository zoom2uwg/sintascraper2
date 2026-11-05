const fs = require('fs');
const path = require('path');
const { extractPageData } = require('./src/parsers');

function analyzeDetail(filePath) {
  console.log(`\n--- Detailed Analysis: ${path.basename(filePath)} ---`);
  const html = fs.readFileSync(filePath, 'utf-8');
  const data = extractPageData(html);

  console.log('Header        :', JSON.stringify(data.header, null, 2));
  console.log('Scores        :', JSON.stringify(data.scores));
  console.log('SummaryMatrix :', JSON.stringify(data.summaryMatrix));
  console.log('Charts        :', JSON.stringify({
    quartilePie: data.charts.quartilePie?.distribution,
    researchRadar: data.charts.researchRadar?.breakdown,
    yearlyTrends: Object.keys(data.charts.yearlyTrends),
  }));
  console.log('Pagination    :', JSON.stringify(data.pagination));

  data.items.slice(0, 3).forEach((item, idx) => {
    console.log(`Item ${idx + 1}:`, {
      dedup_key: item.dedup_key,
      title: item.title,
      year: item.year,
      authors: item.authors,
      journal_or_scheme: item.journal,
      fund_rp: item.fund_rp,
      nomor_permohonan: item.nomor_permohonan,
      scopus_eid: item.scopus_eid,
    });
  });
}

const rootDir = path.resolve(__dirname, '..');
analyzeDetail(path.join(rootDir, 'SINTA - Science and Technology Index-AuthorsProfile.html'));
analyzeDetail(path.join(rootDir, 'SINTA - Science and Technology Index-AuthorResearch.html'));
analyzeDetail(path.join(rootDir, 'SINTA - Science and Technology Index-DepartmentProfile.html'));
analyzeDetail(path.join(rootDir, 'SINTA - Science and Technology Index-Affiliation.html'));
