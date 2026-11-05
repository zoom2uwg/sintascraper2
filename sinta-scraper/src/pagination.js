const {
  DEFAULT_SINTA_BASE,
  cleanText,
  isDummyUrl,
  resolveUrl,
  stripUrlHash,
  parseCount,
} = require('./parsers/utils');

/**
 * Extract integer `page` query parameter from a URL string if present.
 */
function extractPageParam(urlStr) {
  if (!urlStr) return null;
  const cleaned = stripUrlHash(urlStr);
  const match = cleaned.match(/[?&]page=(\d+)(?:&|$)/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Build a paginated SINTA URL preserving existing query parameters (view, q, sort, filter, etc.)
 * and stripping any dummy hash (#! or #).
 */
function buildPaginatedUrl(baseUrl, pageNum, extraParams = {}) {
  const cleanBase = stripUrlHash(baseUrl || DEFAULT_SINTA_BASE);
  let parsed;
  try {
    parsed = new URL(cleanBase, DEFAULT_SINTA_BASE);
  } catch (_) {
    return cleanBase;
  }

  // Snapshot existing params except page
  const existingEntries = [];
  for (const [k, v] of parsed.searchParams.entries()) {
    if (k.toLowerCase() !== 'page') {
      existingEntries.push([k, v]);
    }
  }

  // Rebuild searchParams with `page` first (matches SINTA native ?page=N&view=V format)
  parsed.search = '';
  if (pageNum != null) {
    parsed.searchParams.set('page', String(pageNum));
  }
  for (const [k, v] of existingEntries) {
    parsed.searchParams.append(k, v);
  }
  for (const [k, v] of Object.entries(extraParams || {})) {
    if (v !== undefined && v !== null && v !== '') {
      parsed.searchParams.set(k, String(v));
    }
  }

  return parsed.toString();
}

/**
 * Create a canonical comparison key for a URL to prevent duplicate page visits or loops.
 */
function normalizeUrlKey(urlStr) {
  if (!urlStr) return '';
  try {
    const u = new URL(stripUrlHash(urlStr), DEFAULT_SINTA_BASE);
    const pathname = u.pathname.replace(/\/+$/, '') || '/';
    const params = new URLSearchParams(u.search);
    if (!params.get('page')) {
      params.set('page', '1');
    }
    const sorted = [...params.entries()]
      .filter(([, v]) => v !== '')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    return `${u.origin}${pathname}?${sorted}`;
  } catch (_) {
    return String(urlStr).trim();
  }
}

/**
 * Parse all pagination metadata and controls from a SINTA page DOM (Cheerio `$`).
 * Handles:
 * - `.pagination-text small` ("Page X of Y | Total Records Z")
 * - Multiple identical pagination bars on the same page (e.g., Affiliation Departments top & bottom)
 * - `ul.pagination li.page-item` (First, Previous, numbered pages, Next, Last)
 * - Disabled states (`li.disabled`, `aria-disabled="true"`, `?page=&...`, `#!`)
 * - Anonymous fallback "View more ..." buttons/links (including login-gated links)
 */
function parsePagination($, currentUrl = '') {
  const baseForLinks = stripUrlHash(currentUrl) || DEFAULT_SINTA_BASE;

  // 1. Parse pagination summary text (.pagination-text small or .pagination-text)
  const $pagTextEl = $('.pagination-text small').first().length
    ? $('.pagination-text small').first()
    : $('.pagination-text').first();

  const rawText = cleanText($pagTextEl.text());
  let textCurrentPage = null;
  let textTotalPages = null;
  let totalRecords = null;

  if (rawText) {
    const pageMatch = rawText.match(/Page\s+([\d.,]+)\s+of\s+([\d.,]+)/i);
    if (pageMatch) {
      textCurrentPage = parseCount(pageMatch[1]);
      textTotalPages = parseCount(pageMatch[2]);
    }
    const recordsMatch = rawText.match(/Total\s+Records?\s*:?\s*([\d.,]+)/i);
    if (recordsMatch) {
      totalRecords = parseCount(recordsMatch[1]);
    }
    // Alternative format: "Showing 1 to 10 of 45 entries"
    if (totalRecords == null) {
      const showingMatch = rawText.match(/Showing\s+([\d.,]+)\s+to\s+([\d.,]+)\s+of\s+([\d.,]+)/i);
      if (showingMatch) {
        const start = parseCount(showingMatch[1]) || 1;
        const end = parseCount(showingMatch[2]) || start;
        const total = parseCount(showingMatch[3]) || 0;
        const perPage = Math.max(1, end - start + 1);
        totalRecords = total;
        textCurrentPage = Math.floor((start - 1) / perPage) + 1;
        textTotalPages = total > 0 ? Math.ceil(total / perPage) : 0;
      }
    }
  }

  // 2. Parse pagination navigation links from the first ul.pagination bar
  const $pagUl = $('nav[aria-label*="pagination"] ul.pagination').first().length
    ? $('nav[aria-label*="pagination"] ul.pagination').first()
    : $('ul.pagination').first();

  let hasPrev = false;
  let hasNext = false;
  let firstUrl = null;
  let prevUrl = null;
  let nextUrl = null;
  let lastUrl = null;
  let activeLinkPage = null;
  let maxNumberedPage = 0;
  let lastLinkPage = null;
  let nextLinkPage = null;
  const pageLinks = [];
  const seenPageNums = new Set();

  if ($pagUl.length > 0) {
    $pagUl.children('li').each((_, liEl) => {
      const $li = $(liEl);
      const $a = $li.find('a, span').first();
      if (!$a.length) return;

      const label = cleanText($a.text()) || '';
      const ariaLabel = ($a.attr('aria-label') || '').toLowerCase();
      const rawHref = ($a.attr('href') || '').trim();
      const hasEmptyPageParam = /[?&]page=(?:&|$)/i.test(stripUrlHash(rawHref));

      const isDisabled =
        $li.hasClass('disabled') ||
        $a.hasClass('disabled') ||
        $a.attr('aria-disabled') === 'true' ||
        !rawHref ||
        isDummyUrl(rawHref) ||
        hasEmptyPageParam;

      const isActive = $li.hasClass('active') || $a.hasClass('active');
      const resolvedHref = !isDisabled && rawHref ? resolveUrl(rawHref, baseForLinks) : null;
      const hrefPageNum = extractPageParam(rawHref);

      if (/^(?:«\s*)?first|awal$/i.test(label) || ariaLabel.includes('first')) {
        if (!isDisabled && resolvedHref) firstUrl = resolvedHref;
      } else if (/^(?:‹|«|&laquo;|prev(?:ious)?|sebelumnya)$/i.test(label) || ariaLabel.includes('prev')) {
        hasPrev = !isDisabled && !!resolvedHref;
        prevUrl = hasPrev ? resolvedHref : null;
      } else if (/^(?:›|»|&raquo;|next|selanjutnya)$/i.test(label) || ariaLabel.includes('next')) {
        hasNext = !isDisabled && !!resolvedHref;
        nextUrl = hasNext ? resolvedHref : null;
        if (hasNext && hrefPageNum) nextLinkPage = hrefPageNum;
      } else if (/^last(?:\s*»)?|akhir$/i.test(label) || ariaLabel.includes('last')) {
        if (!isDisabled && resolvedHref) {
          lastUrl = resolvedHref;
          if (hrefPageNum) lastLinkPage = hrefPageNum;
        }
      } else if (/^\d+$/.test(label)) {
        const pNum = parseInt(label, 10);
        if (pNum > maxNumberedPage) maxNumberedPage = pNum;
        if (isActive) activeLinkPage = pNum;
        if (!seenPageNums.has(pNum)) {
          seenPageNums.add(pNum);
          pageLinks.push({
            page: pNum,
            url: resolvedHref || (currentUrl ? buildPaginatedUrl(baseForLinks, pNum) : null),
            active: isActive,
            disabled: isDisabled,
          });
        }
      }
    });
  }

  // 3. Detect anonymous / fallback "View more ..." link or button
  let viewMore = {
    present: false,
    text: null,
    url: null,
    requiresLogin: false,
  };

  $('.profile-article a, .profile-article button, .content-box a.btn, .content-box button').each((_, el) => {
    if (viewMore.present) return;
    const $el = $(el);
    const txt = cleanText($el.text());
    if (txt && /\b(?:view\s+more|load\s+more|lihat\s+selengkapnya|more\s+articles)\b/i.test(txt)) {
      const href = $el.attr('href') || '';
      const resolved = href && !isDummyUrl(href) ? resolveUrl(href, baseForLinks) : null;
      viewMore = {
        present: true,
        text: txt,
        url: resolved,
        requiresLogin: /\/logins\b/i.test(href || resolved || ''),
      };
    }
  });

  // 4. Reconcile currentPage & totalPages across all signals
  const urlPage = extractPageParam(currentUrl);
  const currentPage = textCurrentPage || activeLinkPage || urlPage || 1;

  const hasPagination = Boolean(rawText || $pagUl.length > 0);
  const candidateMaxPages = Math.max(
    textTotalPages || 0,
    maxNumberedPage || 0,
    lastLinkPage || 0,
    nextLinkPage || 0
  );

  // Check if the page actually has list records
  const itemCountOnDom =
    $('.profile-article .ar-list-item, .ar-list-item, .row.d-item, .au-item').length;

  let effectiveTotalPages;
  if (totalRecords === 0 && itemCountOnDom === 0) {
    effectiveTotalPages = 0;
  } else if (candidateMaxPages > 0) {
    effectiveTotalPages = candidateMaxPages;
  } else if (itemCountOnDom > 0) {
    effectiveTotalPages = Math.max(1, currentPage);
  } else {
    effectiveTotalPages = 0;
  }

  // If currentPage < effectiveTotalPages and nextUrl wasn't parsed (or vice versa), synthesize nextUrl
  if (!hasNext && effectiveTotalPages > currentPage && currentUrl) {
    hasNext = true;
    nextUrl = buildPaginatedUrl(baseForLinks, currentPage + 1);
  }
  if (!hasPrev && currentPage > 1 && currentUrl) {
    hasPrev = true;
    prevUrl = buildPaginatedUrl(baseForLinks, currentPage - 1);
  }

  // Generate complete URL list for pages 1..effectiveTotalPages when a base URL is known
  const linkByPage = new Map(pageLinks.map((pl) => [pl.page, pl.url]));
  const allPageUrls = [];
  if (currentUrl && effectiveTotalPages > 0) {
    for (let p = 1; p <= effectiveTotalPages; p++) {
      allPageUrls.push(linkByPage.get(p) || buildPaginatedUrl(baseForLinks, p));
    }
  }

  return {
    hasPagination,
    currentPage,
    totalPages: effectiveTotalPages,
    reportedTotalPages: textTotalPages,
    totalRecords,
    itemsOnPage: itemCountOnDom,
    rawText,
    hasPrev,
    hasNext,
    firstUrl,
    prevUrl,
    nextUrl,
    lastUrl,
    pageLinks,
    allPageUrls,
    viewMore,
  };
}

/**
 * Compute a quick content fingerprint of extracted records on a page to detect
 * servers that ignore `?page=N` and return identical items repeatedly.
 */
function computePageFingerprint(pageData) {
  const keys = [
    ...(pageData.items || []).map((i) => i.dedup_key || i.title),
    ...(pageData.departments || []).map((d) => d.id || d.code_prodi || d.name),
    ...(pageData.authors || []).map((a) => a.sinta_id || a.profile_url || a.name),
  ].filter(Boolean);
  return keys.length > 0 ? keys.join('||') : null;
}

/**
 * Generic multi-page pagination crawler engine.
 *
 * Works with any `fetchPageHtml(url, pageNum)` provider (Puppeteer live browser, HTTP client, or offline test mock)
 * and `parsePageFn(html, context)` (defaults to `extractPageData`).
 *
 * Supports:
 * 1. Numbered pagination (`Page 1 of Y | Total Records Z`) -> iterates pages 1..Y
 * 2. Sliding-window pagination (`1 2 3 4 5 Next Last`) -> updates `knownTotalPages` dynamically
 * 3. `Next`-only pagination (no `pagination-text`) -> follows `nextUrl` until disabled
 * 4. Loop guards: normalized visited URL tracking, identical-page fingerprint detection, and `maxPages` cap
 * 5. Anonymous fallback: detects login-gated `View more` or triggers `fallbackLoadMore()`
 * 6. Integrity check: compares extracted item count against `Total Records Z`
 */
async function crawlPaginatedPages(options) {
  const {
    startUrl,
    view = null,
    context = {},
    maxPages = 0, // 0 or Infinity = unlimited (scrape all pages)
    fetchPageHtml,
    parsePageFn,
    fallbackLoadMore = null,
    onPage = null,
  } = options;

  if (typeof fetchPageHtml !== 'function') {
    throw new Error('crawlPaginatedPages requires a fetchPageHtml(url, pageNum) function');
  }
  const parsePage = parsePageFn || require('./parsers').extractPageData;
  const pageCap = maxPages && maxPages > 0 ? maxPages : Infinity;

  const extraQuery = view && view !== 'articles' ? { view } : {};
  const page1Url = buildPaginatedUrl(startUrl, 1, extraQuery);

  const visitedKeys = new Set();
  const visitedUrls = [];
  const warnings = [];

  const allItems = [];
  const allDepartments = [];
  const allAuthors = [];
  const seenItemKeys = new Set();
  const seenDeptKeys = new Set();
  const seenAuthorKeys = new Set();
  const pagesMeta = [];

  let firstPageData = null;
  let previousFingerprint = null;

  const collectFromPage = (pageData, pageNum, sourceUrl) => {
    for (const item of pageData.items || []) {
      item.page = pageNum;
      item.sinta_source_url = sourceUrl;
      allItems.push(item);
      if (item.dedup_key) seenItemKeys.add(item.dedup_key);
    }
    for (const dept of pageData.departments || []) {
      const dk = dept.id || dept.code_prodi || dept.canonical_url || dept.name;
      if (!dk || !seenDeptKeys.has(dk)) {
        if (dk) seenDeptKeys.add(dk);
        allDepartments.push({ ...dept, page: pageNum });
      }
    }
    for (const aut of pageData.authors || []) {
      const ak = aut.sinta_id ? `id:${aut.sinta_id}` : aut.profile_url || aut.name;
      if (!ak || !seenAuthorKeys.has(ak)) {
        if (ak) seenAuthorKeys.add(ak);
        allAuthors.push({ ...aut, page: pageNum });
      }
    }
  };

  // --- Fetch Page 1 ---
  visitedKeys.add(normalizeUrlKey(page1Url));
  const res1 = await fetchPageHtml(page1Url, 1);
  const finalUrl1 = (res1 && res1.finalUrl) || page1Url;
  visitedKeys.add(normalizeUrlKey(finalUrl1));
  visitedUrls.push(finalUrl1);

  let html1 = res1 && typeof res1 === 'object' ? res1.html : res1;

  firstPageData = parsePage(html1, {
    ...context,
    view,
    page: 1,
    currentUrl: finalUrl1,
  });

  // Fallback for anonymous mode with interactive "View more" (if no pagination bar)
  let truncatedByAuth = false;
  if (!firstPageData.pagination.hasPagination && firstPageData.pagination.viewMore.present) {
    if (firstPageData.pagination.viewMore.requiresLogin) {
      truncatedByAuth = true;
      warnings.push(
        `ANONYMOUS_TRUNCATED: "${firstPageData.pagination.viewMore.text}" requires login (${finalUrl1})`
      );
    } else if (typeof fallbackLoadMore === 'function') {
      const expandedHtml = await fallbackLoadMore(finalUrl1);
      if (expandedHtml) {
        html1 = expandedHtml;
        firstPageData = parsePage(html1, {
          ...context,
          view,
          page: 1,
          currentUrl: finalUrl1,
        });
      }
    }
  }

  collectFromPage(firstPageData, 1, finalUrl1);
  previousFingerprint = computePageFingerprint(firstPageData);
  pagesMeta.push({
    page: 1,
    url: finalUrl1,
    itemsExtracted: (firstPageData.items || []).length,
    departmentsExtracted: (firstPageData.departments || []).length,
    authorsExtracted: (firstPageData.authors || []).length,
  });

  if (typeof onPage === 'function') {
    await onPage(firstPageData, 1, firstPageData.pagination.totalPages || 1);
  }

  const pag1 = firstPageData.pagination;
  const reportedTotalRecords = pag1.totalRecords;
  let knownTotalPages = pag1.totalPages || 1;

  // Validate selector health on Page 1
  const totalExtractedPage1 =
    allItems.length + allDepartments.length + allAuthors.length + (firstPageData.contentTables || []).length;
  if (reportedTotalRecords != null && reportedTotalRecords > 0 && totalExtractedPage1 === 0) {
    warnings.push(
      `SELECTOR_MISMATCH: Page 1 reported Total Records ${reportedTotalRecords} but 0 items were parsed (${finalUrl1})`
    );
  }

  const emptyVerified =
    (reportedTotalRecords === 0 || (!pag1.hasPagination && totalExtractedPage1 === 0)) &&
    totalExtractedPage1 === 0;

  // --- Multi-Page Loop (Pages 2..N) ---
  if (!emptyVerified && pageCap > 1) {
    let currentPageNum = 1;
    let lastPageData = firstPageData;

    while (currentPageNum < pageCap) {
      const nextPageNum = currentPageNum + 1;
      const lastPag = lastPageData.pagination;

      // Determine whether another page exists
      const hasKnownRemaining = nextPageNum <= knownTotalPages;
      const hasExplicitNext = Boolean(lastPag && lastPag.hasNext && lastPag.nextUrl);

      if (!hasKnownRemaining && !hasExplicitNext) {
        break;
      }

      // Prefer exact link from pagination bar if present, else nextUrl, else constructed ?page=N
      const linkedEntry =
        (lastPag.pageLinks || []).find((pl) => pl.page === nextPageNum && pl.url) ||
        (pag1.pageLinks || []).find((pl) => pl.page === nextPageNum && pl.url);

      let targetUrl;
      if (linkedEntry && linkedEntry.url) {
        targetUrl = linkedEntry.url;
      } else if (hasExplicitNext && extractPageParam(lastPag.nextUrl) === nextPageNum) {
        targetUrl = lastPag.nextUrl;
      } else if (hasKnownRemaining) {
        targetUrl = buildPaginatedUrl(startUrl, nextPageNum, extraQuery);
      } else {
        targetUrl = lastPag.nextUrl;
      }

      const normTarget = normalizeUrlKey(targetUrl);
      if (!targetUrl || visitedKeys.has(normTarget)) {
        break;
      }
      visitedKeys.add(normTarget);

      const resN = await fetchPageHtml(targetUrl, nextPageNum);
      const finalUrlN = (resN && resN.finalUrl) || targetUrl;
      visitedKeys.add(normalizeUrlKey(finalUrlN));
      visitedUrls.push(finalUrlN);

      const htmlN = resN && typeof resN === 'object' ? resN.html : resN;
      const pageDataN = parsePage(htmlN, {
        ...context,
        view,
        page: nextPageNum,
        currentUrl: finalUrlN,
      });

      const countOnN =
        (pageDataN.items || []).length +
        (pageDataN.departments || []).length +
        (pageDataN.authors || []).length;

      if (countOnN === 0) {
        warnings.push(`EMPTY_SUBSEQUENT_PAGE: Page ${nextPageNum} returned 0 records (${finalUrlN})`);
        break;
      }

      // Guard against servers ignoring ?page=N and returning identical content
      const fpN = computePageFingerprint(pageDataN);
      if (fpN && previousFingerprint && fpN === previousFingerprint) {
        warnings.push(
          `DUPLICATE_PAGE_CONTENT: Page ${nextPageNum} returned identical records to page ${currentPageNum}; stopping pagination`
        );
        break;
      }
      previousFingerprint = fpN;

      collectFromPage(pageDataN, nextPageNum, finalUrlN);
      pagesMeta.push({
        page: nextPageNum,
        url: finalUrlN,
        itemsExtracted: (pageDataN.items || []).length,
        departmentsExtracted: (pageDataN.departments || []).length,
        authorsExtracted: (pageDataN.authors || []).length,
      });

      // Dynamically update knownTotalPages if sliding window reveals higher page count
      if (pageDataN.pagination && pageDataN.pagination.totalPages > knownTotalPages) {
        knownTotalPages = pageDataN.pagination.totalPages;
      }

      if (typeof onPage === 'function') {
        await onPage(pageDataN, nextPageNum, knownTotalPages);
      }

      lastPageData = pageDataN;
      currentPageNum = nextPageNum;
    }
  }

  const totalExtracted =
    allItems.length > 0
      ? allItems.length
      : allDepartments.length > 0
        ? allDepartments.length
        : allAuthors.length;

  if (
    reportedTotalRecords != null &&
    reportedTotalRecords > 0 &&
    pageCap === Infinity &&
    totalExtracted !== reportedTotalRecords
  ) {
    warnings.push(
      `RECORD_COUNT_DIFF: SINTA reported ${reportedTotalRecords} records, extracted ${totalExtracted} (${page1Url})`
    );
  }

  return {
    firstPage: firstPageData,
    items: allItems,
    departments: allDepartments,
    authors: allAuthors,
    pages: pagesMeta,
    paginationSummary: {
      startUrl: page1Url,
      view,
      pagesScraped: pagesMeta.length,
      reportedTotalPages: pag1.reportedTotalPages != null ? pag1.reportedTotalPages : knownTotalPages,
      effectiveTotalPages: knownTotalPages,
      reportedTotalRecords,
      extractedCount: totalExtracted,
      uniqueItemCount: seenItemKeys.size,
      isComplete:
        (reportedTotalRecords != null && totalExtracted >= reportedTotalRecords) ||
        (reportedTotalRecords === 0 && emptyVerified) ||
        (pagesMeta.length >= knownTotalPages && !truncatedByAuth),
      emptyVerified,
      truncatedByAuth,
      visitedUrls,
      warnings,
    },
  };
}

module.exports = {
  extractPageParam,
  buildPaginatedUrl,
  normalizeUrlKey,
  parsePagination,
  crawlPaginatedPages,
};
