const {
  DEFAULT_SINTA_BASE,
  cleanText,
  isDummyUrl,
  resolveUrl,
  stripUrlHash,
  parseCount,
  parseScore,
  toSnakeKey,
} = require('./utils');

const STANDARD_ARTICLE_SUBVIEWS = ['scopus', 'wos', 'garuda', 'googlescholar', 'rama'];

/**
 * Extract view key from a SINTA tab href.
 */
function extractViewFromHref(href) {
  if (!href) return null;
  const cleaned = stripUrlHash(href);
  const m = cleaned.match(/[?&]view=([a-zA-Z0-9_-]+)/i);
  return m ? m[1].toLowerCase() : null;
}

/**
 * Detect login/session status and logged-in operator account info.
 */
function parseSessionInfo($, currentUrl = '') {
  const $logout = $('a[href*="/logins/logout"]').first();
  const logoutUrl = $logout.length ? resolveUrl($logout.attr('href'), currentUrl) : null;

  const $myProfile = $('a[href$="/profile"], a.dropdown-item[href*="/profile"]').first();
  const myProfileUrl = $myProfile.length ? resolveUrl($myProfile.attr('href'), currentUrl) : null;

  let accountName = null;
  if ($logout.length) {
    const $dropdown = $logout.closest('.nav-item.dropdown, li.dropdown, .dropdown');
    const toggleText = cleanText($dropdown.find('.dropdown-toggle').first().text());
    if (toggleText) accountName = toggleText;
  }

  const hasLoginForm =
    $('form[action*="/logins"]').length > 0 ||
    ($('input[name="username"], input[name="email"]').length > 0 &&
      $('input[name="password"]').length > 0);

  const isOnLoginRoute = /\/logins(?:\b|\/|\?|$)/i.test(currentUrl || '') && !$logout.length;
  const isLoginPage = Boolean((hasLoginForm && !$logout.length) || isOnLoginRoute);
  const isLoggedIn = Boolean($logout.length > 0 && !isLoginPage);

  const $loginLink = $('a[href$="/logins"], a.nav-link[href*="/logins"]').first();
  const loginUrl = $loginLink.length ? resolveUrl($loginLink.attr('href'), currentUrl) : null;

  return {
    isLoggedIn,
    isLoginPage,
    accountName,
    myProfileUrl,
    logoutUrl,
    loginUrl,
  };
}

/**
 * Extract search query, active view, sort & filter dropdown states on the page.
 */
function parseSearchAndFilters($, currentUrl = '') {
  // Active search query from alert banner or input[name="q"] or URL
  let query = cleanText($('.alert-info em').first().text());
  if (query) {
    query = query.replace(/^["']|["']$/g, '');
  }
  if (!query) {
    query = cleanText($('input[name="q"]').first().attr('value'));
  }
  if (!query && currentUrl) {
    try {
      const u = new URL(stripUrlHash(currentUrl), DEFAULT_SINTA_BASE);
      query = cleanText(u.searchParams.get('q'));
    } catch (_) {
      // ignore
    }
  }

  const $clearBtn = $('.alert-info a').first();
  const clearSearchUrl =
    $clearBtn.length && !isDummyUrl($clearBtn.attr('href'))
      ? resolveUrl($clearBtn.attr('href'), currentUrl)
      : null;

  // Determine active view
  let activeView = cleanText($('form input[type="hidden"][name="view"]').first().attr('value'));
  if (!activeView && currentUrl) {
    activeView = extractViewFromHref(currentUrl);
  }
  if (!activeView) {
    const $activeSub = $('ul.article-tab a.active').first();
    if ($activeSub.length) {
      activeView = extractViewFromHref($activeSub.attr('href')) || toSnakeKey($activeSub.text());
    }
  }
  if (!activeView) {
    const $activeNav = $('nav.profile-nav a.active').first();
    if ($activeNav.length) {
      activeView = extractViewFromHref($activeNav.attr('href'));
      if (!activeView && /articles/i.test($activeNav.text())) {
        activeView = 'scopus';
      }
    }
  }

  const parseSelect = ($sel) => {
    if (!$sel.length) return null;
    const options = [];
    let selected = null;
    $sel.find('option').each((_, opt) => {
      const $o = $(opt);
      const value = $o.attr('value') ?? '';
      const label = cleanText($o.text());
      const isSelected = $o.is(':selected') || $o.attr('selected') !== undefined;
      if (isSelected) selected = { value, label };
      options.push({ value, label, selected: isSelected });
    });
    return { selected, options };
  };

  return {
    query: query || null,
    clearSearchUrl,
    activeView: activeView ? activeView.toLowerCase() : null,
    sort: parseSelect($('select#sort, select[name="sort"]').first()),
    filter: parseSelect($('select#filter, select[name="filter"]').first()),
  };
}

/**
 * Extract all navigation tabs (`nav.profile-nav`), hidden HTML-commented tabs (`arts`),
 * article sub-tabs (`ul.article-tab`, including `.d-none` WOS), and action links.
 */
function parseNavigationTabs($, currentUrl = '') {
  const primaryTabs = [];
  const commentedTabs = [];
  const articleSubTabs = [];
  const actionLinks = [];

  let hasArticlesTab = false;

  const $profileNav = $('nav.profile-nav').first();
  if ($profileNav.length) {
    $profileNav.find('a').each((_, aEl) => {
      const $a = $(aEl);
      const label = cleanText($a.text());
      const href = $a.attr('href') || '';
      const url = href ? resolveUrl(href, currentUrl) : null;
      const cls = $a.attr('class') || '';
      const parentCls = $a.parent().attr('class') || '';
      const hidden = /\bd-none\b/.test(cls) || /\bd-none\b/.test(parentCls);
      const active = /\bactive\b/.test(cls);
      let view = extractViewFromHref(href);
      if (!view && /articles/i.test(label || '')) {
        view = 'articles';
        hasArticlesTab = true;
      }
      primaryTabs.push({ label, view, url, active, hidden });
    });

    // Also inspect HTML comments inside nav.profile-nav (e.g., <!-- <a ... ?view=arts">Arts</a> -->)
    const rawNavHtml = $profileNav.html() || '';
    const commentRegex = /<!--([\s\S]*?)-->/g;
    let cm;
    while ((cm = commentRegex.exec(rawNavHtml)) !== null) {
      const snippet = cm[1];
      const aMatch = snippet.match(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
      if (aMatch) {
        const cHref = aMatch[1];
        const cLabel = cleanText(aMatch[2].replace(/<[^>]+>/g, ''));
        const cView = extractViewFromHref(cHref);
        commentedTabs.push({
          label: cLabel,
          view: cView,
          url: resolveUrl(cHref, currentUrl),
          commentedOut: true,
        });
      }
    }
  }

  // Article sub-tabs (Scopus, Web of Science [d-none!], Garuda, Google Scholar, RAMA)
  $('ul.article-tab li').each((_, liEl) => {
    const $li = $(liEl);
    const $a = $li.find('a').first();
    if (!$a.length) return;
    const label = cleanText($a.text());
    const href = $a.attr('href') || '';
    const url = href ? resolveUrl(href, currentUrl) : null;
    const liCls = $li.attr('class') || '';
    const aCls = $a.attr('class') || '';
    const hidden = /\bd-none\b/.test(liCls) || /\bd-none\b/.test(aCls);
    const active = /\bactive\b/.test(aCls) || /\bactive\b/.test(liCls);
    const view = extractViewFromHref(href) || toSnakeKey(label);
    articleSubTabs.push({ label, view, url, active, hidden });
  });

  // Action buttons in content-box (e.g., Scopus Analysis, Back to profile)
  $('.content-box a.btn').each((_, btnEl) => {
    const $b = $(btnEl);
    const label = cleanText($b.text());
    const href = $b.attr('href') || '';
    if (label && href && !isDummyUrl(href)) {
      actionLinks.push({
        label,
        url: resolveUrl(href, currentUrl),
      });
    }
  });

  // Build ordered deduplicated list of all scrapable views for this profile
  const availableViews = [];
  const addView = (v) => {
    if (v && v !== 'articles' && !availableViews.includes(v)) {
      availableViews.push(v);
    }
  };

  if (articleSubTabs.length > 0) {
    articleSubTabs.forEach((t) => addView(t.view));
  } else if (hasArticlesTab) {
    STANDARD_ARTICLE_SUBVIEWS.forEach(addView);
  }
  primaryTabs.forEach((t) => addView(t.view));

  return {
    primaryTabs,
    articleSubTabs,
    commentedTabs,
    actionLinks,
    availableViews,
  };
}

/**
 * Parse header profile info for Affiliation, Department, or Author pages.
 */
function parseProfileHeader($, currentUrl = '') {
  const $univProfile = $('.univ-profile').first();

  // Case 1: Affiliation or Department Header (.univ-profile / .univ-name)
  if ($univProfile.length > 0) {
    const $h3a = $univProfile.find('.univ-name h3 a').first();
    const name = cleanText($h3a.length ? $h3a.text() : $univProfile.find('.univ-name h3').text());
    const headerHref = $h3a.attr('href') || '';
    const headerUrl = headerHref && !isDummyUrl(headerHref) ? resolveUrl(headerHref, currentUrl) : null;

    const $logo = $univProfile.find('img.univ-logo-main, .univ-name img').first();
    const logoUrl = $logo.length ? $logo.attr('src') || null : null;

    const $meta = $univProfile.find('.meta-profile').first();
    const metaText = cleanText($meta.text()) || '';
    const location = cleanText($meta.find('.affil-loc').text());
    const abbrevText = cleanText($meta.find('.affil-abbrev').text());

    const $affilLink = $meta.find('a[href*="/affiliations/profile/"]').first();
    const affilUrl = $affilLink.length ? resolveUrl($affilLink.attr('href'), currentUrl) : headerUrl;
    const affilIdFromLink = (affilUrl || '').match(/\/affiliations\/profile\/(\d+)/i)?.[1] || null;

    const idMatch = metaText.match(/\bID\s*:\s*(\d+)/i);
    const codePtMatch = metaText.match(/\bCODE(?:\s+PT)?\s*:\s*(\d+)/i);
    const codeProdiMatch = metaText.match(/\bCODE\s+PRODI\s*:\s*(\d+)/i);

    // Determine whether this is a Department or an Affiliation header
    const isDepartment = Boolean(
      codeProdiMatch ||
      /\/departments\/(?:profile|authors)\//i.test(currentUrl || headerHref || '')
    );

    const urlToInspect = stripUrlHash(currentUrl || headerHref || '');
    const canonicalDeptMatch = urlToInspect.match(
      /\/departments\/(?:profile|authors)\/(\d+)\/([0-9A-Fa-f-]{36})\/([0-9A-Fa-f-]{36})/i
    );

    if (isDepartment) {
      const affilId = canonicalDeptMatch?.[1] || affilIdFromLink || idMatch?.[1] || null;
      const parentKey = canonicalDeptMatch?.[2] || null;
      const deptId = canonicalDeptMatch?.[3] || null;
      const codeProdi = codeProdiMatch ? codeProdiMatch[1] : null;
      const codePt = codePtMatch ? codePtMatch[1] : null;

      return {
        entityType: 'department',
        name,
        url: headerUrl || (currentUrl ? stripUrlHash(currentUrl) : null),
        imageUrl: logoUrl,
        isVerified: null,
        sintaId: null,
        nidn: null,
        affiliation: {
          id: affilId,
          code: codePt,
          name: cleanText($affilLink.text()) || abbrevText,
          abbreviation: null,
          url: affilUrl,
          location,
        },
        department: {
          id: deptId,
          parentKey,
          codeProdi,
          level: null,
          name,
          canonicalUrl:
            affilId && parentKey && deptId
              ? `${DEFAULT_SINTA_BASE}/departments/profile/${affilId}/${parentKey}/${deptId}`
              : null,
          legacyUrl:
            affilId && codePt && codeProdi
              ? `${DEFAULT_SINTA_BASE}/departments/profile/${affilId}/${codePt}/${codeProdi}`
              : null,
        },
        subjects: [],
      };
    }

    // Affiliation header
    const affilId = idMatch?.[1] || affilIdFromLink || (urlToInspect.match(/\/affiliations\/\w+\/(\d+)/i)?.[1] ?? null);
    const affilCode = codePtMatch?.[1] || (urlToInspect.match(/\/affiliations\/departments\/\d+\/(\d+)/i)?.[1] ?? null);

    return {
      entityType: 'affiliation',
      name,
      url: headerUrl || (affilId ? `${DEFAULT_SINTA_BASE}/affiliations/profile/${affilId}` : null),
      imageUrl: logoUrl,
      isVerified: null,
      sintaId: null,
      nidn: null,
      affiliation: {
        id: affilId,
        code: affilCode,
        name,
        abbreviation: abbrevText,
        url: headerUrl || (affilId ? `${DEFAULT_SINTA_BASE}/affiliations/profile/${affilId}` : null),
        location,
      },
      department: null,
      subjects: [],
    };
  }

  // Case 2: Author Profile Header (.content-box h3 + .meta-profile + ul.subject-list)
  const $contentBox = $('.content-box').first();
  const $h3 = $contentBox.find('h3').first();
  if ($h3.length > 0) {
    const $nameA = $h3.find('a').first();
    const name = cleanText($nameA.length ? $nameA.text() : $h3.text());
    const isVerified = $h3.find('i.el-ok-sign, .el-ok-sign').length > 0;
    const $avatar = $contentBox.find('img.img-thumbnail, img.au-avatar').first();
    const avatarUrl = $avatar.length ? $avatar.attr('src') || null : null;

    const $meta = $contentBox.find('.meta-profile').first();
    const metaText = cleanText($meta.text()) || cleanText($contentBox.text()) || '';

    const sintaIdMatch =
      metaText.match(/SINTA\s*ID\s*:\s*(\d+)/i) ||
      (currentUrl || '').match(/\/authors\/profile\/(\d+)/i);
    const sintaId = sintaIdMatch ? parseInt(sintaIdMatch[1], 10) : null;

    const nidnMatch = metaText.match(/\b(?:NIDN|NIDK|NUPTK)\s*:\s*([0-9A-Za-z]+)/i);
    const nidn = nidnMatch ? nidnMatch[1] : null;

    const $affilA = $meta.find('a[href*="/affiliations/profile/"]').first();
    const affilUrl = $affilA.length ? resolveUrl($affilA.attr('href'), currentUrl) : null;
    const affilId = (affilUrl || '').match(/\/affiliations\/profile\/(\d+)/i)?.[1] || null;
    const affilName = cleanText($affilA.text());

    const $deptA = $meta.find('a[href*="/departments/profile/"]').first();
    const deptRawText = cleanText($deptA.text());
    const deptUrl = $deptA.length ? resolveUrl($deptA.attr('href'), currentUrl) : null;

    let deptLevel = null;
    let deptName = deptRawText;
    if (deptRawText && deptRawText.includes(' - ')) {
      const parts = deptRawText.split(/\s*-\s*/);
      deptLevel = parts[0].trim();
      deptName = parts.slice(1).join(' - ').trim();
    }

    const legacyMatch = (deptUrl || '').match(/\/departments\/profile\/(\d+)\/(\d+)\/(\d+)/i);
    const canonMatch = (deptUrl || '').match(
      /\/departments\/profile\/(\d+)\/([0-9A-Fa-f-]{36})\/([0-9A-Fa-f-]{36})/i
    );

    const subjects = [];
    $contentBox.find('ul.subject-list li a').each((_, sEl) => {
      const $s = $(sEl);
      const sName = cleanText($s.text());
      const sHref = $s.attr('href') || '';
      const sUrl = sHref ? resolveUrl(sHref, currentUrl) : null;
      const sIdMatch = sHref.match(/\/subjects\/detail\/(\d+)/i);
      if (sName) {
        subjects.push({
          id: sIdMatch ? parseInt(sIdMatch[1], 10) : null,
          name: sName,
          url: sUrl,
        });
      }
    });

    if (sintaId || subjects.length > 0 || $affilA.length > 0) {
      const profileUrl = sintaId
        ? `${DEFAULT_SINTA_BASE}/authors/profile/${sintaId}`
        : ($nameA.length && !isDummyUrl($nameA.attr('href'))
          ? resolveUrl($nameA.attr('href'), currentUrl)
          : stripUrlHash(currentUrl));

      return {
        entityType: 'author',
        name,
        url: profileUrl,
        imageUrl: avatarUrl,
        isVerified,
        sintaId,
        nidn,
        affiliation: {
          id: affilId,
          code: legacyMatch ? legacyMatch[2] : null,
          name: affilName,
          abbreviation: null,
          url: affilUrl,
          location: null,
        },
        department: deptRawText
          ? {
              id: canonMatch ? canonMatch[3] : null,
              parentKey: canonMatch ? canonMatch[2] : null,
              codeProdi: legacyMatch ? legacyMatch[3] : null,
              level: deptLevel,
              name: deptName,
              rawText: deptRawText,
              canonicalUrl: canonMatch ? deptUrl : null,
              legacyUrl: legacyMatch ? deptUrl : null,
            }
          : null,
        subjects,
      };
    }
  }

  return {
    entityType: null,
    name: null,
    url: currentUrl || null,
    imageUrl: null,
    isVerified: null,
    sintaId: null,
    nidn: null,
    affiliation: null,
    department: null,
    subjects: [],
  };
}

/**
 * Parse top stat counter cards (`.stat-card`), SINTA score cards (`.stat-profile` / `.pr-num`),
 * sidebar summary tables (`.stat-table`), and any content tables (e.g., `?view=matrics`).
 */
function parseStatsAndTables($, currentUrl = '') {
  // 1. Stat counter cards (.stat-card .card-body)
  const statCards = [];
  const statCounts = {};
  $('.stat-card .card-body').each((_, cardEl) => {
    const $c = $(cardEl);
    const rawNum = cleanText($c.find('.stat-num').first().text());
    const label = cleanText($c.find('.stat-text').first().text());
    const $arrowA = $c.find('.stat-arrow a').first();
    const url =
      $arrowA.length && !isDummyUrl($arrowA.attr('href'))
        ? resolveUrl($arrowA.attr('href'), currentUrl)
        : null;
    if (label || rawNum != null) {
      const value = parseCount(rawNum);
      const key = toSnakeKey(label || 'count');
      statCards.push({ key, label, value, rawValue: rawNum, url });
      if (key) statCounts[key] = value;
    }
  });

  // 2. SINTA score cards (.stat-profile -> .pr-num & .pr-txt)
  const scoreItems = [];
  const scores = {};
  $('.stat-profile .pr-num').each((_, numEl) => {
    const $num = $(numEl);
    const $parent = $num.parent();
    const rawValue = cleanText($num.text());
    const label = cleanText($parent.find('.pr-txt').first().text());
    if (!label && rawValue == null) return;

    const value = parseScore(rawValue);
    let normKey = toSnakeKey(label || 'score');

    if (/overall\s+productivity/i.test(label || '')) {
      normKey = 'productivity_overall';
    } else if (/3yr\s+productivity/i.test(label || '')) {
      normKey = 'productivity_3yr';
    } else if (/affil\s+score\s+3yr/i.test(label || '')) {
      normKey = 'affil_3yr';
    } else if (/affil\s+score/i.test(label || '')) {
      normKey = 'affil';
    } else if (/score\s+3yr/i.test(label || '')) {
      normKey = 'three_year';
    } else if (/score\s+overall/i.test(label || '')) {
      normKey = 'overall';
    }

    scoreItems.push({ key: normKey, label, value, rawValue });
    scores[normKey] = value;
  });

  // 3. Summary matrix tables (.stat-table)
  const summaryTables = [];
  let summaryMatrix = null;

  $('table.stat-table').each((ti, tblEl) => {
    const $tbl = $(tblEl);
    const sources = [];
    const hiddenSources = [];

    $tbl.find('thead tr').first().find('th, td').each((ci, cell) => {
      if (ci === 0) return; // metric label column
      const $cell = $(cell);
      const colName = cleanText($cell.text()) || `col_${ci}`;
      const colKey = toSnakeKey(colName);
      sources.push({ key: colKey, label: colName });
      if (/\bd-none\b/.test($cell.attr('class') || '')) {
        hiddenSources.push(colKey);
      }
    });

    const bySource = {};
    const byMetric = {};
    const rawRows = [];

    sources.forEach((s) => {
      bySource[s.key] = {};
    });

    $tbl.find('tbody tr').each((_, trEl) => {
      const $cells = $(trEl).find('th, td');
      if ($cells.length < 2) return;
      const metricLabel = cleanText($cells.eq(0).text());
      if (!metricLabel) return;
      const metricKey = toSnakeKey(metricLabel);
      byMetric[metricKey] = {};

      const rowValues = {};
      sources.forEach((src, idx) => {
        const rawCell = cleanText($cells.eq(idx + 1).text());
        const numVal = parseScore(rawCell);
        const finalVal = numVal != null ? numVal : 0;
        bySource[src.key][metricKey] = finalVal;
        byMetric[metricKey][src.key] = finalVal;
        rowValues[src.key] = finalVal;
      });

      rawRows.push({ metric: metricLabel, key: metricKey, values: rowValues });
    });

    const parsedTbl = {
      index: ti,
      sources: sources.map((s) => s.key),
      sourceLabels: sources,
      hiddenSources,
      bySource,
      byMetric,
      rawRows,
    };
    summaryTables.push(parsedTbl);
    if (ti === 0) summaryMatrix = bySource;
  });

  // 4. Non-stat content tables (e.g. `?view=matrics`, `?view=pak`, `?view=kepakaran`)
  const contentTables = [];
  $('.profile-article table, .content-box table')
    .not('.stat-table')
    .each((idx, tblEl) => {
      const $tbl = $(tblEl);
      const caption =
        cleanText($tbl.find('caption').first().text()) ||
        cleanText($tbl.prev('h3, h4, h5, .section-title').text()) ||
        null;

      let headers = [];
      $tbl.find('thead tr').first().find('th, td').each((_, th) => {
        headers.push(cleanText($(th).text()) || '');
      });

      const bodyRows = [];
      $tbl.find('tbody tr, tr').each((ri, tr) => {
        // Skip thead rows already captured
        if ($(tr).closest('thead').length > 0) return;
        const cells = [];
        $(tr).find('th, td').each((_, td) => {
          cells.push(cleanText($(td).text()) || '');
        });
        if (cells.some(Boolean)) {
          if (headers.length === 0 && ri === 0 && $(tr).find('th').length > 0) {
            headers = cells;
          } else {
            bodyRows.push(cells);
          }
        }
      });

      const objects =
        headers.length > 0
          ? bodyRows.map((cells) => {
              const obj = {};
              headers.forEach((h, i) => {
                const k = h || `col_${i + 1}`;
                obj[k] = cells[i] !== undefined ? cells[i] : null;
              });
              return obj;
            })
          : [];

      if (headers.length > 0 || bodyRows.length > 0) {
        contentTables.push({
          index: idx,
          caption,
          headers,
          rows: bodyRows,
          objects,
        });
      }
    });

  return {
    statCards,
    statCounts,
    scores,
    scoreItems,
    summaryMatrix,
    summaryTables,
    contentTables,
  };
}

module.exports = {
  STANDARD_ARTICLE_SUBVIEWS,
  extractViewFromHref,
  parseSessionInfo,
  parseSearchAndFilters,
  parseNavigationTabs,
  parseProfileHeader,
  parseStatsAndTables,
};
