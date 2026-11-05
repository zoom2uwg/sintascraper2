const crypto = require('crypto');

const DEFAULT_SINTA_BASE = 'https://sinta.kemdiktisaintek.go.id';

/**
 * Normalize whitespace and trim text. Returns null if empty.
 */
function cleanText(val) {
  if (val == null) return null;
  const cleaned = String(val).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Check whether an href is empty, a hash placeholder (# or #!), or javascript: pseudo-link.
 */
function isDummyUrl(href) {
  if (!href) return true;
  const trimmed = String(href).trim();
  if (!trimmed || trimmed === '#' || trimmed === '#!') return true;
  if (/^javascript:/i.test(trimmed)) return true;
  // SINTA internal dummy links append #! or # to current page URL
  if (trimmed.endsWith('#!') || trimmed.endsWith('#')) return true;
  return false;
}

/**
 * Resolve potentially relative URLs against baseUrl or SINTA base URL.
 */
function resolveUrl(href, baseUrl = DEFAULT_SINTA_BASE) {
  const raw = cleanText(href);
  if (!raw) return null;
  if (/^javascript:/i.test(raw)) return null;
  try {
    return new URL(raw, baseUrl || DEFAULT_SINTA_BASE).toString();
  } catch (_) {
    return raw;
  }
}

/**
 * Strip hash fragments (#! or #) from a URL string.
 */
function stripUrlHash(urlStr) {
  if (!urlStr) return null;
  return String(urlStr).replace(/#!.*$/, '').replace(/#.*$/, '');
}

/**
 * Parse an integer count from strings like "1,234", "1.234", "0 cited", "Total Records 9".
 */
function parseCount(val) {
  if (val == null) return null;
  if (typeof val === 'number') return Number.isFinite(val) ? Math.trunc(val) : null;
  const s = String(val).trim();
  if (!s) return null;
  const match = s.match(/-?\d[\d.,]*/);
  if (!match) return null;
  const digitsOnly = match[0].replace(/[.,]/g, '');
  const parsed = parseInt(digitsOnly, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Parse SINTA score values which may contain thousand separators or decimals.
 * Examples: "474" -> 474, "2.799" -> 2799, "1,245" -> 1245, "12.5" -> 12.5
 */
function parseScore(val) {
  if (val == null) return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  const s = cleanText(val);
  if (!s) return null;
  const match = s.match(/-?\d[\d.,]*/);
  if (!match) return null;
  let token = match[0];
  // Multiple dots or commas => thousand separators
  if (/^\d{1,3}(\.\d{3})+$/.test(token)) {
    token = token.replace(/\./g, '');
  } else if (/^\d{1,3}(,\d{3})+$/.test(token)) {
    token = token.replace(/,/g, '');
  } else if (token.includes(',') && !token.includes('.')) {
    token = token.replace(',', '.');
  } else {
    token = token.replace(/,/g, '');
  }
  const num = Number(token);
  return Number.isFinite(num) ? num : null;
}

/**
 * Parse Indonesian Rupiah currency strings into integer amount.
 * Examples:
 *   "Rp. 4.000.000" -> 4000000
 *   "Rp 2.500.000,00" -> 2500000
 *   "Rp. 0" -> 0
 */
function parseRupiah(val) {
  if (val == null) return null;
  if (typeof val === 'number') return Number.isFinite(val) ? Math.round(val) : null;
  const s = cleanText(val);
  if (!s) return null;
  // Remove currency prefix and optional decimal cents (,00)
  const withoutPrefix = s.replace(/^Rp\.?\s*/i, '').trim();
  const withoutCents = withoutPrefix.replace(/,\d{1,2}$/, '');
  const digits = withoutCents.replace(/[^\d-]/g, '');
  if (!digits || digits === '-') return null;
  const parsed = parseInt(digits, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Normalize strings for deduplication keys (lowercase, alphanumeric + single spaces).
 */
function normalizeForKey(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract saved-from-url comment if HTML was saved from browser ("<!-- saved from url=(0058)https://... -->").
 */
function extractSavedFromUrl(html) {
  if (!html) return null;
  const headSlice = String(html).slice(0, 2000);
  const match = headSlice.match(/saved from url=\(\d+\)\s*(https?:\/\/[^\s>"]+)/i);
  return match ? match[1].trim() : null;
}

/**
 * Build composite deduplication key per Groundtruth & Requirements spec:
 * - Scopus EID: "scopus:<eid>"
 * - WOS UID: "wos:<uid>"
 * - IPR Application Number: "iprs:<nomor_permohonan>"
 * - Book ISBN: "books:<isbn>"
 * - Fallback: "<view>:<md5(normTitle_year_actor)>"
 */
function computeDedupKey(item, fallbackView = 'item') {
  const view = (item.view || fallbackView || 'item').toLowerCase();
  if (item.scopus_eid) {
    return `scopus:${item.scopus_eid}`;
  }
  if (item.wos_uid) {
    return `wos:${item.wos_uid}`;
  }
  if (item.nomor_permohonan) {
    return `iprs:${item.nomor_permohonan}`;
  }
  if (view === 'books' && item.isbn) {
    return `books:${item.isbn}`;
  }
  const normTitle = normalizeForKey(item.title || '');
  const year = item.year || 0;
  const actor = normalizeForKey(
    item.leader || item.inventor || item.creator || item.authors || ''
  );
  const raw = `${normTitle}_${year}_${actor}`;
  const hash = crypto.createHash('md5').update(raw).digest('hex').slice(0, 16);
  return `${view}:${hash}`;
}

/**
 * Convert slug/metric label to snake_case object key.
 */
function toSnakeKey(label) {
  if (!label) return '';
  return String(label)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

module.exports = {
  DEFAULT_SINTA_BASE,
  cleanText,
  isDummyUrl,
  resolveUrl,
  stripUrlHash,
  parseCount,
  parseScore,
  parseRupiah,
  normalizeForKey,
  extractSavedFromUrl,
  computeDedupKey,
  toSnakeKey,
};
