const {
  DEFAULT_SINTA_BASE,
  cleanText,
  isDummyUrl,
  resolveUrl,
  parseScore,
} = require('./utils');

/**
 * Parse a single Department row (`.row.d-item`) on Affiliation Departments Index
 * (`/affiliations/departments/2058/071030`).
 */
function parseDepartmentRow($, el, currentUrl = '') {
  const $el = $(el);
  const baseUrl = currentUrl || DEFAULT_SINTA_BASE;

  const level = cleanText($el.find('.tbl-content-meta span').first().text());
  const $nameA = $el.find('.tbl-content-name > a, .tbl-content-name a[href*="/departments/profile/"]').first();
  const name = cleanText($nameA.text());
  const canonicalUrl =
    $nameA.length && !isDummyUrl($nameA.attr('href'))
      ? resolveUrl($nameA.attr('href'), baseUrl)
      : null;

  const codeProdi = cleanText($el.find('.tbl-content-meta-num').first().text());

  const $legacyA = $el.find('.tbl-content-action a[href*="/departments/profile/"]').first();
  const legacyUrl =
    $legacyA.length && !isDummyUrl($legacyA.attr('href'))
      ? resolveUrl($legacyA.attr('href'), baseUrl)
      : null;

  // Parse UUIDs from canonicalUrl (/departments/profile/{affilId}/{parentUuid}/{deptUuid})
  const canonMatch = (canonicalUrl || '').match(
    /\/departments\/profile\/(\d+)\/([0-9A-Fa-f-]{36})\/([0-9A-Fa-f-]{36})/i
  );
  const legacyMatch = (legacyUrl || '').match(/\/departments\/profile\/(\d+)\/(\d+)\/(\d+)/i);

  const affiliationId = canonMatch?.[1] || legacyMatch?.[1] || null;
  const parentKey = canonMatch?.[2] || null;
  const deptId = canonMatch?.[3] || null;
  const affiliationCode = legacyMatch?.[2] || null;

  // Parse SINTA scores inside .profile-hindex if populated
  let sintaScoreOverall = null;
  let sintaScore3Yr = null;
  $el.find('.profile-hindex .profile-id, .profile-hindex span').each((_, sp) => {
    const txt = cleanText($(sp).text()) || '';
    if (/Overall\s*:/i.test(txt)) {
      const after = cleanText(txt.split(':')[1]);
      sintaScoreOverall = parseScore(after);
    } else if (/3Yr\s*:/i.test(txt)) {
      const after = cleanText(txt.split(':')[1]);
      sintaScore3Yr = parseScore(after);
    }
  });

  // Preview authors list (ul.au-list.dept-list li)
  const previewAuthors = [];
  $el.find('ul.au-list.dept-list li').each((_, liEl) => {
    const $li = $(liEl);
    const authorName =
      cleanText($li.attr('data-original-title')) ||
      cleanText($li.attr('title')) ||
      cleanText($li.text());
    const $a = $li.find('a[href*="/authors/profile/"]').first();
    const href = $a.attr('href') || '';
    const profileUrl = href && !isDummyUrl(href) ? resolveUrl(href, baseUrl) : null;
    const idMatch = href.match(/\/authors\/profile\/(\d+)/i);
    const sintaId = idMatch ? parseInt(idMatch[1], 10) : null;
    const avatarUrl = $li.find('img').first().attr('src') || null;

    if (sintaId || authorName) {
      previewAuthors.push({
        sinta_id: sintaId,
        name: authorName,
        profile_url: profileUrl,
        avatar_url: avatarUrl,
      });
    }
  });

  const authorsUrl =
    affiliationId && parentKey && deptId
      ? `${DEFAULT_SINTA_BASE}/departments/authors/${affiliationId}/${parentKey}/${deptId}`
      : null;

  return {
    id: deptId,
    parent_key: parentKey,
    affiliation_id: affiliationId,
    affiliation_code: affiliationCode,
    code_prodi: codeProdi || (legacyMatch ? legacyMatch[3] : null),
    level,
    name,
    canonical_url: canonicalUrl,
    legacy_url: legacyUrl,
    authors_url: authorsUrl,
    sinta_score_overall: sintaScoreOverall,
    sinta_score_3yr: sintaScore3Yr,
    preview_authors: previewAuthors,
  };
}

/**
 * Parse all Department rows on an Affiliation Departments page.
 */
function parseDepartmentList($, currentUrl = '') {
  const departments = [];
  $('.row.d-item').each((_, el) => {
    const $el = $(el);
    // Only treat .row.d-item as a department row when it contains a department profile link or code
    const hasDeptSignal =
      $el.find('a[href*="/departments/profile/"]').length > 0 &&
      $el.find('.profile-name a[href*="/authors/profile/"]').length === 0;
    if (!hasDeptSignal) return;
    const parsed = parseDepartmentRow($, el, currentUrl);
    if (parsed.name || parsed.id || parsed.code_prodi) {
      departments.push(parsed);
    }
  });
  return departments;
}

/**
 * Parse all Author rows on a Department Authors (`/departments/authors/...`),
 * Affiliation Authors (`/affiliations/authors/...`), or general Authors list page.
 */
function parseAuthorList($, currentUrl = '') {
  const baseUrl = currentUrl || DEFAULT_SINTA_BASE;
  const authors = [];
  const seenIds = new Set();

  // Primary structured containers used by SINTA v3 for author directories: .au-item, .row.au-item, or author .row.d-item
  const $containers = $('.au-item, .profile-item').length
    ? $('.au-item, .profile-item')
    : $('.row.d-item').filter((_, el) => {
        const $el = $(el);
        return (
          $el.find('a[href*="/authors/profile/"]').length > 0 &&
          $el.find('ul.au-list.dept-list').length === 0
        );
      });

  if ($containers.length > 0) {
    $containers.each((_, el) => {
      const $el = $(el);
      const $nameA = $el
        .find('.profile-name a[href*="/authors/profile/"], a[href*="/authors/profile/"]')
        .filter((__, a) => Boolean(cleanText($(a).text())))
        .first();

      const fallbackA = !$nameA.length ? $el.find('a[href*="/authors/profile/"]').first() : $nameA;
      const href = fallbackA.attr('href') || '';
      if (!href || isDummyUrl(href)) return;

      const profileUrl = resolveUrl(href, baseUrl);
      const idMatch = profileUrl.match(/\/authors\/profile\/(\d+)/i);
      const sintaId = idMatch ? parseInt(idMatch[1], 10) : null;
      const key = sintaId ? `id:${sintaId}` : profileUrl;
      if (seenIds.has(key)) return;
      seenIds.add(key);

      const name =
        cleanText($nameA.text()) ||
        cleanText($el.find('.profile-name').text()) ||
        cleanText(fallbackA.attr('title')) ||
        null;

      const isVerified = $el.find('i.el-ok-sign, .el-ok-sign').length > 0;
      const avatarUrl = $el.find('img').first().attr('src') || null;

      const $deptA = $el.find('a[href*="/departments/profile/"]').first();
      const department = cleanText($deptA.text());
      const departmentUrl = $deptA.length ? resolveUrl($deptA.attr('href'), baseUrl) : null;

      const $affilA = $el.find('a[href*="/affiliations/profile/"]').first();
      const affiliation = cleanText($affilA.text());

      const rowText = cleanText($el.text()) || '';
      const nidnMatch = rowText.match(/\b(?:NIDN|NIDK|NUPTK)\s*:\s*([0-9A-Za-z]+)/i);
      const nidn = nidnMatch ? nidnMatch[1] : null;

      // Parse inline metrics/scores inside author card (.profile-hindex, .stat-num, .pr-num)
      const metrics = {};
      $el.find('.profile-id, .profile-hindex span').each((__, sp) => {
        const t = cleanText($(sp).text()) || '';
        const parts = t.split(':');
        if (parts.length >= 2) {
          const k = parts[0].trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
          const v = cleanText(parts.slice(1).join(':'));
          if (k && k !== 'sinta_id') {
            metrics[k] = parseScore(v) ?? v;
          }
        }
      });

      $el.find('.pr-num, .stat-num').each((__, numEl) => {
        const $n = $(numEl);
        const rawV = cleanText($n.text());
        const lbl = cleanText($n.parent().find('.pr-txt, .stat-text').first().text());
        if (lbl && rawV != null) {
          const k = lbl.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
          metrics[k] = parseScore(rawV);
        }
      });

      const subjects = [];
      $el.find('ul.subject-list li a').each((__, sEl) => {
        const sTxt = cleanText($(sEl).text());
        if (sTxt) subjects.push(sTxt);
      });

      authors.push({
        sinta_id: sintaId,
        name,
        nama: name, // alias compatible with export-borang.js & export-report.js
        nidn,
        is_verified: isVerified,
        affiliation,
        department,
        department_url: departmentUrl,
        subjects,
        metrics,
        sinta_score_overall:
          metrics.sinta_score_overall ?? metrics.overall ?? null,
        sinta_score_3yr:
          metrics.sinta_score_3yr ?? metrics.sinta_score_3_yr ?? null,
        affil_score: metrics.affil_score ?? null,
        profile_url: profileUrl,
        url: profileUrl, // backwards-compatible alias
        avatar_url: avatarUrl,
      });
    });

    return authors;
  }

  // Fallback: extract scoped author profile links inside .content-box (excluding navbar & .ar-list-item personils)
  const isAuthorDirectoryRoute = /\/(?:departments|affiliations)\/authors\/|\/authors(?:\?|$)/i.test(
    baseUrl
  );
  if (isAuthorDirectoryRoute) {
    $('.content-box a[href*="/authors/profile/"]').each((_, aEl) => {
      const $a = $(aEl);
      if ($a.closest('.ar-list-item, nav.navbar').length > 0) return;
      const href = $a.attr('href') || '';
      if (!href || isDummyUrl(href)) return;
      const profileUrl = resolveUrl(href, baseUrl);
      const idMatch = profileUrl.match(/\/authors\/profile\/(\d+)/i);
      const sintaId = idMatch ? parseInt(idMatch[1], 10) : null;
      const name =
        cleanText($a.text()) ||
        cleanText($a.closest('li').attr('data-original-title')) ||
        null;
      if (!name && !sintaId) return;

      const key = sintaId ? `id:${sintaId}` : profileUrl;
      if (seenIds.has(key)) return;
      seenIds.add(key);

      authors.push({
        sinta_id: sintaId,
        name,
        nama: name,
        nidn: null,
        is_verified: false,
        affiliation: null,
        department: null,
        department_url: null,
        subjects: [],
        metrics: {},
        sinta_score_overall: null,
        sinta_score_3yr: null,
        affil_score: null,
        profile_url: profileUrl,
        url: profileUrl,
        avatar_url: $a.find('img').first().attr('src') || null,
      });
    });
  }

  return authors;
}

module.exports = {
  parseDepartmentRow,
  parseDepartmentList,
  parseAuthorList,
};
