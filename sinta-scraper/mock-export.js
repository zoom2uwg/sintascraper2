const ExcelJS = require('exceljs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');

async function exportData(data) {
    // 1. Export HTML
    let html = '<table border="1"><tr><th>Title</th><th>Authors</th></tr>';
    data.forEach(row => {
        html += `<tr><td>${row.title}</td><td>${row.authors}</td></tr>`;
    });
    html += '</table>';
    fs.writeFileSync('output.html', html);

    // 2. Export CSV
    const csvWriter = createCsvWriter({
        path: 'output.csv',
        header: [
            {id: 'title', title: 'TITLE'},
            {id: 'authors', title: 'AUTHORS'}
        ]
    });
    await csvWriter.writeRecords(data);

    // 3. Export Excel
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Data');
    sheet.columns = [
        { header: 'Title', key: 'title', width: 30 },
        { header: 'Authors', key: 'authors', width: 30 }
    ];
    sheet.addRows(data);
    await workbook.xlsx.writeFile('output.xlsx');
    console.log("Mock export success");
}

exportData([{title: "AI in 2026", authors: "John Doe"}]);
