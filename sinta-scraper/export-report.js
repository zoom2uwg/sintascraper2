const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

/**
 * Export Report Generator for SINTA Scraper
 * Generates beautiful PDF and HTML reports from research data
 */

// Helper function to format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
}

// Helper function to format date
function formatDate(date = new Date()) {
    return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }).format(date);
}

// Generate HTML Template
function generateHTMLReport(data) {
    const { authors, researches, metadata = {} } = data;
    
    // Calculate statistics
    const totalResearches = researches.length;
    const totalFunding = researches.reduce((sum, r) => sum + (r.fund_rp || 0), 0);
    const yearRange = researches.length > 0 
        ? `${Math.min(...researches.map(r => r.year))} - ${Math.max(...researches.map(r => r.year))}`
        : '-';
    const uniqueAuthors = new Set();
    researches.forEach(r => {
        uniqueAuthors.add(r.leader);
        r.members.forEach(m => uniqueAuthors.add(m.nama));
    });
    
    // Group researches by year
    const researchesByYear = {};
    researches.forEach(r => {
        if (!researchesByYear[r.year]) {
            researchesByYear[r.year] = [];
        }
        researchesByYear[r.year].push(r);
    });
    const years = Object.keys(researchesByYear).sort((a, b) => b - a);

    const html = `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Laporan Penelitian SINTA</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            overflow: hidden;
        }
        
        /* Header */
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            font-weight: 700;
        }
        
        .header .subtitle {
            font-size: 1.2em;
            opacity: 0.9;
        }
        
        .header .date {
            margin-top: 15px;
            font-size: 0.95em;
            opacity: 0.8;
        }
        
        /* Statistics Cards */
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            padding: 40px;
            background: #f8f9fa;
        }
        
        .stat-card {
            background: white;
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            border-left: 4px solid #667eea;
            transition: transform 0.3s ease;
        }
        
        .stat-card:hover {
            transform: translateY(-5px);
        }
        
        .stat-card .label {
            font-size: 0.9em;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 10px;
        }
        
        .stat-card .value {
            font-size: 2em;
            font-weight: 700;
            color: #667eea;
        }
        
        .stat-card .value.currency {
            font-size: 1.5em;
        }
        
        /* Content Section */
        .content {
            padding: 40px;
        }
        
        .section {
            margin-bottom: 40px;
        }
        
        .section-title {
            font-size: 1.8em;
            color: #333;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 3px solid #667eea;
        }
        
        /* Authors List */
        .authors-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }
        
        .author-card {
            background: #f8f9fa;
            padding: 15px 20px;
            border-radius: 8px;
            border-left: 3px solid #764ba2;
            display: flex;
            align-items: center;
        }
        
        .author-card .icon {
            width: 40px;
            height: 40px;
            background: #667eea;
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            margin-right: 15px;
            flex-shrink: 0;
        }
        
        .author-card .info .name {
            font-weight: 600;
            color: #333;
        }
        
        .author-card .info .id {
            font-size: 0.85em;
            color: #666;
        }
        
        /* Research Cards */
        .year-group {
            margin-bottom: 40px;
        }
        
        .year-header {
            font-size: 1.5em;
            font-weight: 700;
            color: #667eea;
            margin-bottom: 20px;
            padding: 15px 20px;
            background: #f8f9fa;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .year-header .badge {
            background: #667eea;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.7em;
        }
        
        .research-card {
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 10px;
            padding: 25px;
            margin-bottom: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            transition: all 0.3s ease;
        }
        
        .research-card:hover {
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            border-color: #667eea;
        }
        
        .research-card .title {
            font-size: 1.2em;
            font-weight: 700;
            color: #333;
            margin-bottom: 15px;
            line-height: 1.4;
        }
        
        .research-card .meta {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 15px;
        }
        
        .research-card .meta-item {
            display: flex;
            flex-direction: column;
        }
        
        .research-card .meta-item .label {
            font-size: 0.85em;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
        }
        
        .research-card .meta-item .value {
            font-weight: 600;
            color: #333;
        }
        
        .research-card .meta-item .value.amount {
            color: #27ae60;
            font-size: 1.1em;
        }
        
        .research-card .members {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #e0e0e0;
        }
        
        .research-card .members .label {
            font-size: 0.9em;
            color: #666;
            margin-bottom: 8px;
            font-weight: 600;
        }
        
        .research-card .members .member-list {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }
        
        .research-card .members .member-tag {
            background: #e3f2fd;
            color: #1976d2;
            padding: 5px 12px;
            border-radius: 15px;
            font-size: 0.85em;
            font-weight: 500;
        }
        
        .research-card .status {
            display: inline-block;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: 600;
            background: #d4edda;
            color: #155724;
        }
        
        .research-card .scheme {
            background: #fff3cd;
            color: #856404;
            padding: 8px 15px;
            border-radius: 6px;
            font-size: 0.9em;
            display: inline-block;
            margin-top: 10px;
        }
        
        /* Footer */
        .footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            color: #666;
            border-top: 1px solid #e0e0e0;
        }
        
        .footer .generated {
            font-size: 0.9em;
        }
        
        .footer .source {
            margin-top: 10px;
            font-size: 0.85em;
        }
        
        .footer a {
            color: #667eea;
            text-decoration: none;
        }
        
        .footer a:hover {
            text-decoration: underline;
        }
        
        /* Print Styles */
        @media print {
            body {
                background: white;
                padding: 0;
            }
            
            .container {
                box-shadow: none;
            }
            
            .research-card {
                page-break-inside: avoid;
            }
            
            .year-group {
                page-break-inside: avoid;
            }
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            .header h1 {
                font-size: 1.8em;
            }
            
            .stats {
                grid-template-columns: 1fr;
                padding: 20px;
            }
            
            .content {
                padding: 20px;
            }
            
            .authors-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>📊 Laporan Penelitian SINTA</h1>
            <div class="subtitle">${metadata.institution || 'Universitas Widyagama Malang'}</div>
            <div class="date">Tanggal Laporan: ${formatDate()}</div>
        </div>
        
        <!-- Statistics -->
        <div class="stats">
            <div class="stat-card">
                <div class="label">Total Penelitian</div>
                <div class="value">${totalResearches}</div>
            </div>
            <div class="stat-card">
                <div class="label">Total Pendanaan</div>
                <div class="value currency">${formatCurrency(totalFunding)}</div>
            </div>
            <div class="stat-card">
                <div class="label">Rentang Tahun</div>
                <div class="value" style="font-size: 1.5em;">${yearRange}</div>
            </div>
            <div class="stat-card">
                <div class="label">Peneliti Unik</div>
                <div class="value">${uniqueAuthors.size}</div>
            </div>
        </div>
        
        <!-- Content -->
        <div class="content">
            <!-- Authors Section -->
            <div class="section">
                <h2 class="section-title">👥 Daftar Peneliti</h2>
                <div class="authors-grid">
                    ${authors.map((author, idx) => `
                        <div class="author-card">
                            <div class="icon">${author.nama.charAt(0).toUpperCase()}</div>
                            <div class="info">
                                <div class="name">${author.nama}</div>
                                <div class="id">SINTA ID: ${author.sinta_id}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <!-- Researches Section -->
            <div class="section">
                <h2 class="section-title">🔬 Daftar Penelitian</h2>
                ${years.map(year => `
                    <div class="year-group">
                        <div class="year-header">
                            <span>Tahun ${year}</span>
                            <span class="badge">${researchesByYear[year].length} Penelitian</span>
                        </div>
                        ${researchesByYear[year].map((research, idx) => `
                            <div class="research-card">
                                <div class="title">${research.judul}</div>
                                
                                <div class="meta">
                                    <div class="meta-item">
                                        <span class="label">Ketua Peneliti</span>
                                        <span class="value">${research.leader}</span>
                                    </div>
                                    <div class="meta-item">
                                        <span class="label">Dana Penelitian</span>
                                        <span class="value amount">${formatCurrency(research.fund_rp)}</span>
                                    </div>
                                    <div class="meta-item">
                                        <span class="label">Status</span>
                                        <span class="status">${research.status}</span>
                                    </div>
                                    <div class="meta-item">
                                        <span class="label">Sumber</span>
                                        <span class="value">${research.source}</span>
                                    </div>
                                </div>
                                
                                <div class="scheme">${research.scheme}</div>
                                
                                ${research.members && research.members.length > 0 ? `
                                    <div class="members">
                                        <div class="label">Anggota Tim (${research.members.length}):</div>
                                        <div class="member-list">
                                            ${research.members.map(m => `
                                                <span class="member-tag">${m.nama}</span>
                                            `).join('')}
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                `).join('')}
            </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
            <div class="generated">
                Laporan ini dibuat secara otomatis menggunakan <strong>SINTA Scraper</strong>
            </div>
            <div class="source">
                Sumber data: <a href="https://sinta.kemdiktisaintek.go.id/" target="_blank">SINTA - Science and Technology Index</a>
            </div>
        </div>
    </div>
</body>
</html>
    `;
    
    return html;
}

// Generate PDF from HTML
async function generatePDF(htmlContent, outputPath) {
    console.log('Generating PDF...');
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    await page.pdf({
        path: outputPath,
        format: 'A4',
        printBackground: true,
        margin: {
            top: '20px',
            right: '20px',
            bottom: '20px',
            left: '20px'
        }
    });
    
    await browser.close();
    console.log(`PDF saved to: ${outputPath}`);
}

// Main export function
async function exportReport(options = {}) {
    const {
        authorsFile = './fixtures/sample-authors.json',
        researchesFile = './fixtures/sample-researches.json',
        outputDir = './output',
        format = 'both', // 'html', 'pdf', or 'both'
        metadata = {}
    } = options;
    
    try {
        console.log('Starting report generation...');
        
        // Load data
        const authors = JSON.parse(fs.readFileSync(authorsFile, 'utf8'));
        const researches = JSON.parse(fs.readFileSync(researchesFile, 'utf8'));
        
        console.log(`Loaded ${authors.length} authors and ${researches.length} researches`);
        
        // Create output directory
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const data = { authors, researches, metadata };
        
        // Generate HTML
        const htmlContent = generateHTMLReport(data);
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const htmlPath = path.join(outputDir, `laporan-sinta-${timestamp}.html`);
        const pdfPath = path.join(outputDir, `laporan-sinta-${timestamp}.pdf`);
        
        if (format === 'html' || format === 'both') {
            fs.writeFileSync(htmlPath, htmlContent);
            console.log(`✅ HTML report saved: ${htmlPath}`);
        }
        
        if (format === 'pdf' || format === 'both') {
            await generatePDF(htmlContent, pdfPath);
            console.log(`✅ PDF report saved: ${pdfPath}`);
        }
        
        console.log('\n🎉 Report generation completed successfully!');
        
        return {
            success: true,
            files: {
                html: format === 'html' || format === 'both' ? htmlPath : null,
                pdf: format === 'pdf' || format === 'both' ? pdfPath : null
            }
        };
        
    } catch (error) {
        console.error('❌ Error generating report:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// CLI Usage
if (require.main === module) {
    const args = process.argv.slice(2);
    const format = args[0] || 'both'; // html, pdf, or both
    
    exportReport({ format })
        .then(result => {
            if (result.success) {
                console.log('\nGenerated files:');
                if (result.files.html) console.log(`  - HTML: ${result.files.html}`);
                if (result.files.pdf) console.log(`  - PDF: ${result.files.pdf}`);
            }
            process.exit(result.success ? 0 : 1);
        })
        .catch(err => {
            console.error('Fatal error:', err);
            process.exit(1);
        });
}

module.exports = { exportReport, generateHTMLReport, generatePDF };
