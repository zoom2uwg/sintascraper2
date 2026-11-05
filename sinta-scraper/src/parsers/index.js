const cheerio = require('cheerio');
const utils = require('./utils');
const { parseChartsFromScripts } = require('./charts');
const { parseArListItem, parseAllArListItems, toBorangResearchItem } = require('./cards');
const {
  STANDARD_ARTICLE_SUBVIEWS,
  extractViewFromHref,
  parseSessionInfo,
  parseSearchAndFilters,
  parseNavigationTabs,
  parseProfileHeader,
  parseStatsAndTables,
} = require('./profile');
const {
  parseDepartmentRow,
  parseDepartmentList,
  parseAuthorList,
} = require('./lists');
const { parsePagination } = require('../pagination');

/**
 * Determine the exact SINTA page type from URL, header, and list structures.
 */
function detectPageType({ currentUrl, session, header, departments, authors, items }) {
  if (session.isLoginPage) return 'login';
  const url = currentUrl || '';

  if (/\/affiliations\/departments\//i.test(url) || (header.entityType === 'affiliation' && departments.length > 0)) {
    return 'affiliation_departments';
  }
  if (/\/affiliations\/authors\//i.test(url)) {
    return 'affiliation_authors';
  }
  if (/\/departments\/authors\//i.test(url) || (header.entityType === 'department' && authors.length > 0 && items.length === 0)) {
    return 'department_authors';
  }
  if (/\/departments\/profile\//i.test(url) || header.entityType === 'department') {
    return 'department_profile';
  }
  if (/\/authors\/profile\//i.test(url) || header.entityType === 'author') {
    return 'author_profile';
  }
  if (/\/affiliations\/profile\//i.test(url) || header.entityType === 'affiliation') {
    return 'affiliation_profile';
  }
  return 'general_list';
}

/**
 * Master extractor: reads and extracts ALL information present on any SINTA HTML page,
 * including session state, search/filters, profile headers, SINTA scores, stat cards,
 * summary tables, content tables, inline ECharts data, navigation tabs (including hidden WOS),
 * pagination metadata/links, department rows, author rows, and universal `.ar-list-item` records.
 */
function extractPageData(htmlOrCheerio, options = {}) {
  const isCheerio = typeof htmlOrCheerio === 'function' && htmlOrCheerio.root;
  const rawHtml = isCheerio ? '' : String(htmlOrCheerio || '');
  const $ = isCheerio ? htmlOrCheerio : cheerio.load(rawHtml);

  const savedFromUrl = !isCheerio ? utils.extractSavedFromUrl(rawHtml) : null;
  const currentUrl = options.currentUrl || options.url || savedFromUrl || '';

  const pageTitle = utils.cleanText($('title').first().text());
  const session = parseSessionInfo($, currentUrl);
  const searchAndFilters = parseSearchAndFilters($, currentUrl);
  const header = parseProfileHeader($, currentUrl);
  const navigation = parseNavigationTabs($, currentUrl);
  const stats = parseStatsAndTables($, currentUrl);
  const charts = parseChartsFromScripts($);
  const pagination = parsePagination($, currentUrl);

  const activeView =
    options.view ||
    searchAndFilters.activeView ||
    utils.cleanText(extractViewFromHref(currentUrl)) ||
    null;

  const activePage = options.page || pagination.currentPage || 1;

  // Build context for item records from header + caller options
  const itemContext = {
    view: activeView,
    page: activePage,
    currentUrl: currentUrl || header.url || null,
    baseUrl: currentUrl || utils.DEFAULT_SINTA_BASE,
    entityType:
      options.entityType ||
      (header.entityType === 'author'
        ? 'Author'
        : header.entityType === 'department'
          ? 'Department'
          : header.entityType === 'affiliation'
            ? 'Affiliation'
            : null),
    entityName: options.entityName || header.name || null,
    deptId: options.deptId || header.department?.id || null,
    deptName: options.deptName || header.department?.name || null,
    deptSlug: options.deptSlug || null,
    authorId: options.authorId || header.sintaId || null,
    authorName:
      options.authorName || (header.entityType === 'author' ? header.name : null),
    scrapedAt: options.scrapedAt || new Date().toISOString(),
  };

  const departments = parseDepartmentList($, currentUrl);
  const authors = parseAuthorList($, currentUrl);
  const items = parseAllArListItems($, itemContext);

  const pageType = detectPageType({
    currentUrl,
    session,
    header,
    departments,
    authors,
    items,
  });

  return {
    pageType,
    pageTitle,
    url: currentUrl || null,
    savedFromUrl,
    activeView,
    session,
    searchAndFilters,
    header,
    navigation,
    statCards: stats.statCards,
    statCounts: stats.statCounts,
    scores: stats.scores,
    scoreItems: stats.scoreItems,
    summaryMatrix: stats.summaryMatrix,
    summaryTables: stats.summaryTables,
    contentTables: stats.contentTables,
    charts,
    pagination,
    departments,
    authors,
    items,
    scrapedAt: itemContext.scrapedAt,
  };
}

module.exports = {
  ...utils,
  STANDARD_ARTICLE_SUBVIEWS,
  extractViewFromHref,
  parseSessionInfo,
  parseSearchAndFilters,
  parseNavigationTabs,
  parseProfileHeader,
  parseStatsAndTables,
  parseChartsFromScripts,
  parseArListItem,
  parseAllArListItems,
  toBorangResearchItem,
  parseDepartmentRow,
  parseDepartmentList,
  parseAuthorList,
  detectPageType,
  extractPageData,
};
