const fs = require('fs');
const path = require('path');

// Load .env from repo root first, then local sinta-scraper/.env
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const DEFAULT_VIEWS = [
  'scopus',
  'wos',
  'garuda',
  'googlescholar',
  'rama',
  'researches',
  'services',
  'iprs',
  'books',
  'pak',
  'kepakaran',
  'matrics',
];

function parseCliArgs(argv = process.argv.slice(2)) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const eqIdx = arg.indexOf('=');
    if (eqIdx !== -1) {
      const key = arg.slice(2, eqIdx);
      flags[key] = arg.slice(eqIdx + 1);
    } else {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }
  return flags;
}

function getChromeExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

  const candidates = [
    // Windows
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

function loadDepartmentsConfig(customConfigPath) {
  const cfgPath =
    customConfigPath || path.resolve(__dirname, '../config/departments.json');
  if (fs.existsSync(cfgPath)) {
    return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  }
  return {
    affiliationId: process.env.AFFILIATION_ID || '2058',
    affiliationCode: process.env.AFFILIATION_CODE || '071030',
    affiliationName: process.env.AFFILIASI_NAMA || 'Universitas Widya Gama',
    parentKey: process.env.DEPT_PARENT_KEY || '420D8E73-68F0-4044-86CF-5138D1419B20',
    departments: [],
  };
}

function loadConfig(argv = process.argv.slice(2)) {
  const cli = parseCliArgs(argv);
  const deptRegistry = loadDepartmentsConfig(cli.config);

  const sintaBase = (process.env.SINTA_BASE || 'https://sinta.kemdiktisaintek.go.id').replace(
    /\/+$/,
    ''
  );
  const affiliationId = String(cli['affiliation-id'] || process.env.AFFILIATION_ID || deptRegistry.affiliationId || '2058');
  const affiliationCode = String(cli['affiliation-code'] || process.env.AFFILIATION_CODE || deptRegistry.affiliationCode || '071030');
  const parentKey = String(process.env.DEPT_PARENT_KEY || deptRegistry.parentKey || '420D8E73-68F0-4044-86CF-5138D1419B20');

  const rawViews = cli.view || cli.views || process.env.VIEWS || '';
  const configuredViews = rawViews
    ? String(rawViews)
        .split(',')
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean)
    : DEFAULT_VIEWS;

  const hasExplicitViewFilter = Boolean(cli.view || cli.views);

  let departments = deptRegistry.departments || [];
  if (cli.dept) {
    const filterTokens = String(cli.dept)
      .toLowerCase()
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    departments = departments.filter((d) =>
      filterTokens.some(
        (tok) =>
          (d.slug && d.slug.toLowerCase() === tok) ||
          (d.codeProdi && String(d.codeProdi) === tok) ||
          (d.id && d.id.toLowerCase() === tok) ||
          (d.name && d.name.toLowerCase().includes(tok))
      )
    );
  }

  const headlessFlag =
    cli.headless !== undefined
      ? cli.headless === true || cli.headless === 'true' || cli.headless === 'new'
      : process.env.HEADLESS === 'true';

  const saveRawHtml =
    cli['save-raw'] === true ||
    cli['save-raw'] === 'true' ||
    process.env.SAVE_RAW_HTML === 'true';

  const maxPages = parseInt(
    cli['max-pages'] ?? process.env.MAX_PAGES_PER_VIEW ?? '0',
    10
  ) || 0;

  const outputDir = path.resolve(
    path.resolve(__dirname, '..'),
    cli.out || process.env.OUTPUT_DIR || './data'
  );

  return {
    cli,
    sintaBase,
    username: process.env.SINTA_USERNAME || process.env.SINTA_USER || '',
    password: process.env.SINTA_PASSWORD || process.env.SINTA_PASS || '',
    manualLogin: Boolean(cli['manual-login']),
    headless: headlessFlag,
    affiliationId,
    affiliationCode,
    affiliationName: process.env.AFFILIASI_NAMA || deptRegistry.affiliationName || 'Universitas Widya Gama',
    affiliationUrl: `${sintaBase}/affiliations/profile/${affiliationId}`,
    affiliationDepartmentsUrl: `${sintaBase}/affiliations/departments/${affiliationId}/${affiliationCode}`,
    affiliationAuthorsUrl: `${sintaBase}/affiliations/authors/${affiliationId}`,
    parentKey,
    departments,
    views: configuredViews,
    discoverViews: cli['no-discover-views'] ? false : !hasExplicitViewFilter,
    skipAffiliation: Boolean(cli['skip-affiliation']),
    skipDeptViews: Boolean(cli['skip-dept-views']),
    skipAuthors: Boolean(cli['skip-authors']),
    navDelayMs: parseInt(cli.delay || process.env.NAV_DELAY_MS || '2200', 10),
    pageTimeoutMs: parseInt(cli.timeout || process.env.PAGE_TIMEOUT_MS || '60000', 10),
    loginTimeoutMs: parseInt(process.env.LOGIN_TIMEOUT_MS || '120000', 10),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
    maxPages,
    saveRawHtml,
    resume: Boolean(cli.resume),
    outputDir,
    chromeExecutablePath: getChromeExecutablePath(),
  };
}

module.exports = {
  DEFAULT_VIEWS,
  parseCliArgs,
  getChromeExecutablePath,
  loadDepartmentsConfig,
  loadConfig,
};
