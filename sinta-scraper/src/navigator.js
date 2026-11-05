const fs = require('fs');
const path = require('path');
const { crawlPaginatedPages } = require('./pagination');
const { extractPageData } = require('./parsers');
const { ensureActiveSession } = require('./auth');

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

/**
 * Polite randomized delay between requests to respect SINTA server rate limits.
 */
async function politeDelay(baseMs = 2200) {
  if (!baseMs || baseMs <= 0) return;
  const jitter = Math.floor(Math.random() * 800);
  await delay(baseMs + jitter);
}

/**
 * Save raw HTML snapshot for audit / debugging when `--save-raw` is enabled.
 */
function saveRawHtmlSnapshot(outputDir, scopeSlug, viewName, pageNum, html) {
  try {
    const safeScope = String(scopeSlug || 'general').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeView = String(viewName || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
    const dir = path.join(outputDir, 'raw', safeScope, safeView);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `page_${pageNum}.html`), html, 'utf8');
  } catch (err) {
    console.warn(`[RAW] Gagal menyimpan snapshot HTML: ${err.message}`);
  }
}

/**
 * Navigate to a URL with retry + exponential backoff + Session Guard + content readiness wait.
 */
async function navigateWithRetry(page, url, cfg, authState = null) {
  const maxRetries = Math.max(1, cfg.maxRetries || 3);
  let lastErr = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: cfg.pageTimeoutMs || 60000,
      });

      // Wait briefly for dynamic DOM / ECharts / cards if present
      await page
        .waitForSelector(
          '.profile-article, .ar-list-item, .row.d-item, .au-item, .pagination-text, .stat-table, .content-box',
          { timeout: 8000 }
        )
        .catch(() => null);

      // Session Guard: if session expired & redirected to /logins, re-authenticate and reload target URL
      if (authState && authState.authenticated && /\/logins(?:\b|\/|\?|$)/i.test(page.url())) {
        const recovered = await ensureActiveSession(page, cfg, authState);
        if (recovered) {
          await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: cfg.pageTimeoutMs || 60000,
          });
        }
      }

      const html = await page.content();
      return {
        html,
        finalUrl: page.url(),
      };
    } catch (err) {
      lastErr = err;
      const backoffMs = Math.pow(2, attempt) * 1000;
      console.warn(
        `[NAV] Percobaan ${attempt}/${maxRetries} gagal untuk ${url}: ${err.message}. Menunggu ${backoffMs}ms...`
      );
      await delay(backoffMs);
    }
  }

  throw lastErr;
}

/**
 * Fallback interactive load-more handler in browser for anonymous pages without pagination bar.
 */
async function tryInteractiveLoadMore(page, maxClicks = 20) {
  let clicks = 0;
  while (clicks < maxClicks) {
    const clicked = await page.evaluate(() => {
      const candidates = Array.from(
        document.querySelectorAll('.profile-article a, .profile-article button, .content-box button')
      );
      const btn = candidates.find((el) => {
        const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
        const href = el.getAttribute('href') || '';
        return (
          /\b(?:view\s+more|load\s+more|lihat\s+selengkapnya)\b/i.test(txt) &&
          !href.includes('/logins')
        );
      });
      if (!btn) return false;
      btn.scrollIntoView({ behavior: 'instant', block: 'center' });
      btn.click();
      return true;
    });

    if (!clicked) break;
    clicks++;
    await delay(2000);
  }

  return clicks > 0 ? page.content() : null;
}

/**
 * Crawl ALL paginated pages (`?page=1..totalPages`) of a SINTA URL using Puppeteer
 * and extract complete page information + all records across every page.
 */
async function scrapePaginatedEndpoint(page, startUrl, options = {}) {
  const {
    cfg,
    authState = null,
    view = null,
    scopeSlug = 'general',
    context = {},
    label = '',
  } = options;

  const result = await crawlPaginatedPages({
    startUrl,
    view,
    context,
    maxPages: cfg.maxPages || 0,
    fetchPageHtml: async (targetUrl, pageNum) => {
      if (pageNum > 1) {
        await politeDelay(cfg.navDelayMs);
      }
      const res = await navigateWithRetry(page, targetUrl, cfg, authState);
      if (cfg.saveRawHtml) {
        saveRawHtmlSnapshot(cfg.outputDir, scopeSlug, view || 'index', pageNum, res.html);
      }
      return res;
    },
    parsePageFn: extractPageData,
    fallbackLoadMore: async () => tryInteractiveLoadMore(page),
    onPage: async (pageData, pageNum, totalPages) => {
      const pag = pageData.pagination;
      const recInfo =
        pag.totalRecords != null ? ` | Total Records: ${pag.totalRecords}` : '';
      const count =
        (pageData.items || []).length ||
        (pageData.departments || []).length ||
        (pageData.authors || []).length;
      console.log(
        `  -> ${label ? `[${label}] ` : ''}Page ${pageNum}/${Math.max(1, totalPages)}${recInfo} — extracted ${count} rows`
      );
    },
  });

  await politeDelay(Math.floor((cfg.navDelayMs || 2000) * 0.6));
  return result;
}

module.exports = {
  politeDelay,
  saveRawHtmlSnapshot,
  navigateWithRetry,
  tryInteractiveLoadMore,
  scrapePaginatedEndpoint,
};
