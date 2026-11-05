const {
  DEFAULT_SINTA_BASE,
  cleanText,
  isDummyUrl,
  resolveUrl,
  parseCount,
  parseRupiah,
  computeDedupKey,
  toSnakeKey,
} = require('./utils');

/**
 * Parse a single `.ar-list-item` element across ALL SINTA views:
 * - scopus, wos, garuda, googlescholar, rama
 * - researches, services
 * - iprs
 * - books
 * - pak, kepakaran, arts, or any other SINTA list item
 *
 * Preserves BOTH structured view-specific fields AND complete raw metadata (`meta_lines`, `attributes`)
 * so zero information on the card is ever lost.
 */
function parseArListItem($, el, context = {}) {
  const $el = $(el);
  const baseUrl = context.baseUrl || context.currentUrl || DEFAULT_SINTA_BASE;
  const viewHint = (context.view || '').toLowerCase() || null;

  // 1. Title & primary link
  const $titleA = $el.find('.ar-title a').first();
  const title = cleanText($titleA.length ? $titleA.text() : $el.find('.ar-title').text());
  const rawHref = $titleA.attr('href') || null;
  const detailUrl = rawHref ? resolveUrl(rawHref, baseUrl) : null;
  const targetAttr = $titleA.attr('target') || null;
  const isDummy = isDummyUrl(rawHref);
  const isExternal =
    !isDummy &&
    (targetAttr === '_blank' ||
      (detailUrl ? !detailUrl.includes('sinta.kemdiktisaintek.go.id') : false));

  // 2. Initialize structured fields
  let quartile = null;
  let quartileShort = null;
  let accreditation = null;
  let journal = null;
  let journalUrl = null;
  let scopusEid = null;
  let scopusSourceId = null;
  let wosUid = null;
  let garudaId = null;
  let doi = null;
  let creator = null;
  let authorsText = null;
  let authorOrder = null;
  let authorOrderIndex = null;
  let authorTotal = null;
  let leader = null;
  let inventor = null;
  let scheme = null;
  let holderPub = null;
  let publisher = null;
  let isbn = null;
  let bookCategory = null;
  let year = null;
  let cited = null;
  let fundRp = null;
  let fundAmount = null;
  let status = null;
  let source = null;
  let nomorPermohonan = null;
  let nomorRegistrasi = null;
  let iprType = null;

  const members = [];
  const seenMemberIds = new Set();
  const seenMemberNames = new Set();
  const attributes = {};
  const metaLines = [];
  const metaLinks = [];

  // Extract identifiers from detailUrl if external
  if (detailUrl && !isDummy) {
    const eidMatch = detailUrl.match(/[?&]eid=([a-zA-Z0-9.\-_]+)/i);
    if (eidMatch) scopusEid = eidMatch[1];

    const wosMatch = detailUrl.match(/(WOS:[A-Za-z0-9]+)/i);
    if (wosMatch) wosUid = wosMatch[1];

    const garudaMatch = detailUrl.match(/garuda\.[^/]+\/documents\/detail\/(\d+)/i);
    if (garudaMatch) garudaId = garudaMatch[1];

    const doiUrlMatch = detailUrl.match(/doi\.org\/(10\.\d{4,9}\/[^\s?#]+)/i);
    if (doiUrlMatch) doi = decodeURIComponent(doiUrlMatch[1]);
  }

  // Helper to add member/personil without duplicates (deduping both by SINTA ID and normalized name)
  const addMember = (nama, sintaId = null, profileUrl = null) => {
    const cleanNama = cleanText(nama);
    if (!cleanNama || cleanNama === '-') return;
    const normNama = cleanNama.toLowerCase();
    if (sintaId != null && seenMemberIds.has(sintaId)) return;
    if (seenMemberNames.has(normNama)) return;
    if (sintaId != null) seenMemberIds.add(sintaId);
    seenMemberNames.add(normNama);
    members.push({
      sinta_id: sintaId,
      nama: cleanNama,
      url: profileUrl,
    });
  };

  // 3. Process EVERY .ar-meta block inside the item
  $el.find('.ar-meta').each((_, metaDiv) => {
    const $meta = $(metaDiv);
    const fullLineText = cleanText($meta.text());
    if (fullLineText) {
      metaLines.push(fullLineText);
    }

    const isPersonilLine = /^(Personils?|Personnel|Anggota)\s*:/i.test(fullLineText || '');

    $meta.find('a').each((__, aEl) => {
      const $a = $(aEl);
      const txt = cleanText($a.text());
      const href = $a.attr('href') || '';
      const resolvedHref = href ? resolveUrl(href, baseUrl) : null;
      const cls = ($a.attr('class') || '').trim();

      if (txt) {
        metaLinks.push({
          text: txt,
          className: cls || null,
          href: isDummyUrl(href) ? null : resolvedHref,
        });
      }

      if (!txt) return;

      // Capture generic "Key : Value" attributes so unknown views lose nothing
      const kvMatch = txt.match(/^([A-Za-z0-9\s/_-]{2,35}?)\s*:\s*(.+)$/);
      if (kvMatch) {
        const attrKey = toSnakeKey(kvMatch[1]);
        const attrVal = cleanText(kvMatch[2]);
        if (attrKey && attrVal && attrVal !== '-') {
          attributes[attrKey] = attrVal;
        }
      }

      // A. Handle .ar-quartile (overloaded by SINTA across views: quartile, fund, status, source, IPR type, book type)
      if (cls.includes('ar-quartile')) {
        if (/^Rp\.?\s*[\d.,]+/i.test(txt)) {
          fundRp = txt;
          fundAmount = parseRupiah(txt);
        } else if (
          cls.includes('text-success') ||
          /^(Approved|Submitted|Rejected|Accepted|Didanai|Disetujui|Ongoing|Completed)$/i.test(txt)
        ) {
          status = txt;
        } else if (
          cls.includes('text-info') ||
          /\b(INTERNAL\s*SOURCE|EXTERNAL\s*SOURCE|MANDIRI|HIBAH|DRTPM|KEMDIKBUD\w*|KEMDIKTISAINTEK|DOMESTIC|FOREIGN)\b/i.test(txt)
        ) {
          source = txt;
        } else if (/\b(Q[1-4]|no-Q)\b/i.test(txt)) {
          quartile = txt;
          const qShort = txt.match(/\b(Q[1-4]|no-Q)\b/i);
          quartileShort = qShort ? (qShort[1].toLowerCase() === 'no-q' ? 'no-Q' : qShort[1].toUpperCase()) : txt;
        } else if (/\b(SINTA\s*[1-6]|S[1-6]\s*(?:Journal|Accredited)?|Accredited)\b/i.test(txt) && viewHint !== 'iprs') {
          accreditation = txt;
          if (!quartile) quartile = txt;
        } else if (
          viewHint === 'iprs' ||
          /\b(Hak Cipta|Paten|Merek|Desain Industri|Rahasia Dagang|DTLST|Program Komputer|Karya\s+\w+)\b/i.test(txt)
        ) {
          iprType = txt;
        } else if (viewHint === 'books' || /\b(Buku\s+\w+|Monograf|Referensi|Book\s*Chapter)\b/i.test(txt)) {
          bookCategory = txt;
        } else if (!quartile) {
          quartile = txt;
        }
      }

      // B. Handle .ar-pub (Journal / Conference / Scheme / IPR Holder / Book Publisher)
      if (cls.includes('ar-pub')) {
        journal = txt;
        if (resolvedHref && !isDummyUrl(href)) {
          journalUrl = resolvedHref;
          const srcIdMatch = resolvedHref.match(/sourceid\/(\d+)/i);
          if (srcIdMatch) scopusSourceId = srcIdMatch[1];
        }
      }

      // C. Handle .ar-year
      if (cls.includes('ar-year')) {
        const yMatch = txt.match(/\b(19|20)\d{2}\b/);
        if (yMatch) year = parseInt(yMatch[0], 10);
      }

      // D. Handle .ar-cited (Citation count, Nomor Permohonan, ISBN, DOI)
      if (cls.includes('ar-cited')) {
        const citedMatch = txt.match(/([\d.,]+)\s*cited/i) || txt.match(/Citations?\s*:\s*([\d.,]+)/i);
        if (citedMatch) {
          cited = parseCount(citedMatch[1]);
        }
        const permohonanMatch = txt.match(/(?:Nomor\s*Permohonan|Application\s*(?:No|Number))\s*:\s*(\S+)/i);
        if (permohonanMatch) {
          nomorPermohonan = permohonanMatch[1].trim();
        }
        const regMatch = txt.match(/(?:Nomor\s*(?:Pencatatan|Sertifikat|Paten|Registrasi))\s*:\s*(\S+)/i);
        if (regMatch) {
          nomorRegistrasi = regMatch[1].trim();
        }
        const isbnMatch = txt.match(/ISBN\s*:\s*([0-9Xx\-]+)/i);
        if (isbnMatch) {
          isbn = isbnMatch[1].trim();
        }
        const doiMatch = txt.match(/DOI\s*:\s*(10\.\S+|\S+)/i);
        if (doiMatch && doiMatch[1] !== '-') {
          doi = doiMatch[1].trim();
        }
      }

      // E. Handle explicit prefix labels regardless of class
      if (/^Leader\s*:/i.test(txt)) {
        leader = cleanText(txt.replace(/^Leader\s*:/i, ''));
      } else if (/^Creator\s*:/i.test(txt)) {
        creator = cleanText(txt.replace(/^Creator\s*:/i, ''));
      } else if (/^(?:Authors?|Penulis)\s*:/i.test(txt)) {
        authorsText = cleanText(txt.replace(/^(?:Authors?|Penulis)\s*:/i, ''));
        if (!creator) creator = authorsText;
      } else if (/^Inventor\s*:/i.test(txt)) {
        inventor = cleanText(txt.replace(/^Inventor\s*:/i, ''));
      } else if (/^Author\s*Order\s*:/i.test(txt)) {
        authorOrder = cleanText(txt.replace(/^Author\s*Order\s*:/i, ''));
        const ordMatch = (authorOrder || '').match(/(\d+)\s*of\s*(\d+)/i);
        if (ordMatch) {
          authorOrderIndex = parseInt(ordMatch[1], 10);
          authorTotal = parseInt(ordMatch[2], 10);
        }
      } else if (/^(?:Nomor\s*Permohonan|Application\s*(?:No|Number))\s*:/i.test(txt)) {
        nomorPermohonan = cleanText(txt.replace(/^(?:Nomor\s*Permohonan|Application\s*(?:No|Number))\s*:/i, ''));
      } else if (/^ISBN\s*:/i.test(txt)) {
        isbn = cleanText(txt.replace(/^ISBN\s*:/i, ''));
      } else if (/^Publisher\s*:/i.test(txt)) {
        publisher = cleanText(txt.replace(/^Publisher\s*:/i, ''));
      } else if (/^DOI\s*:/i.test(txt)) {
        const dVal = cleanText(txt.replace(/^DOI\s*:/i, ''));
        if (dVal && dVal !== '-') doi = dVal;
      }

      // F. Handle linked SINTA author profiles inside .ar-meta (e.g., Personils on Researches/Services)
      if (href.includes('/authors/profile/') && !isDummyUrl(href)) {
        const authorIdMatch = href.match(/\/authors\/profile\/(\d+)/);
        const sintaId = authorIdMatch ? parseInt(authorIdMatch[1], 10) : null;
        addMember(txt, sintaId, resolvedHref);
      }
    });

    // Also parse plain-text personils or plain-text metadata inside .ar-meta (when not wrapped in <a>)
    if (isPersonilLine && fullLineText) {
      const afterColon = cleanText(fullLineText.replace(/^(Personils?|Personnel|Anggota)\s*:/i, ''));
      if (afterColon && afterColon !== '-') {
        afterColon
          .split(/[;|]/)
          .map((s) => cleanText(s))
          .filter((s) => s && s !== '-')
          .forEach((namePart) => addMember(namePart, null, null));
      }
    }

    // Fallback plain-text checks on fullLineText for year, ISBN, DOI, Authors
    if (fullLineText) {
      if (!isbn) {
        const mIsbn = fullLineText.match(/\bISBN\s*:\s*([0-9Xx\-]+)/i);
        if (mIsbn) isbn = mIsbn[1].trim();
      }
      if (!doi) {
        const mDoi = fullLineText.match(/\bDOI\s*:\s*(10\.\d{4,9}\/[^\s;|]+)/i);
        if (mDoi) doi = mDoi[1].trim();
      }
      if (!authorsText && /^(?:Authors?|Penulis)\s*:/i.test(fullLineText)) {
        authorsText = cleanText(fullLineText.replace(/^(?:Authors?|Penulis)\s*:/i, ''));
        if (!creator) creator = authorsText;
      }
      if (year == null) {
        const yElText = cleanText($meta.find('.ar-year').text());
        if (yElText) {
          const ym = yElText.match(/\b(19|20)\d{2}\b/);
          if (ym) year = parseInt(ym[0], 10);
        }
      }
    }
  });

  // 4. Infer / assign semantic aliases based on view or detected fields
  const inferredView =
    viewHint ||
    (leader || fundRp ? 'researches' : null) ||
    (inventor || nomorPermohonan ? 'iprs' : null) ||
    (isbn ? 'books' : null) ||
    (scopusEid ? 'scopus' : null) ||
    (wosUid ? 'wos' : null) ||
    (garudaId ? 'garuda' : null) ||
    'articles';

  if (inferredView === 'researches' || inferredView === 'services') {
    scheme = journal;
  } else if (inferredView === 'iprs') {
    holderPub = journal;
    if (!iprType && quartile) {
      iprType = quartile;
      quartile = null;
    }
  } else if (inferredView === 'books') {
    if (!publisher && journal) publisher = journal;
  }

  const personilNames = members.map((m) => m.nama);
  const personilIds = members.map((m) => m.sinta_id).filter((id) => id != null);

  // Build unified authors display string for backwards-compatible summary columns
  const primaryActors =
    creator ||
    authorsText ||
    (leader
      ? personilNames.length > 0
        ? `${leader} (Leader); Anggota: ${personilNames.join(', ')}`
        : `${leader} (Leader)`
      : null) ||
    inventor ||
    (personilNames.length > 0 ? personilNames.join(', ') : null) ||
    null;

  const partialItem = {
    view: viewHint || inferredView,
    title,
    year,
    scopus_eid: scopusEid,
    wos_uid: wosUid,
    nomor_permohonan: nomorPermohonan,
    isbn,
    leader,
    inventor,
    creator,
    authors: primaryActors,
  };

  const dedupKey = computeDedupKey(partialItem, inferredView);

  return {
    dedup_key: dedupKey,
    view: viewHint || inferredView,
    page: context.page || 1,
    title,
    detail_url: isDummy ? null : detailUrl,
    raw_url: detailUrl,
    is_external: isExternal,
    is_dummy_link: isDummy,
    year,
    cited,
    quartile,
    quartile_short: quartileShort,
    accreditation,
    journal,
    journal_url: journalUrl,
    scopus_eid: scopusEid,
    scopus_source_id: scopusSourceId,
    wos_uid: wosUid,
    garuda_id: garudaId,
    doi,
    creator,
    authors: primaryActors,
    authors_text: authorsText,
    author_order: authorOrder,
    author_order_index: authorOrderIndex,
    author_total: authorTotal,
    leader,
    scheme,
    members,
    personil_names: personilNames,
    personil_ids: personilIds,
    fund_rp: fundRp,
    fund_amount: fundAmount,
    status,
    source,
    inventor,
    holder_pub: holderPub,
    nomor_permohonan: nomorPermohonan,
    nomor_registrasi: nomorRegistrasi,
    ipr_type: iprType,
    publisher,
    isbn,
    book_category: bookCategory,
    attributes,
    meta_lines: metaLines,
    raw_metadata: metaLines.join(' | '),
    meta_links: metaLinks,
    entity_type: context.entityType || null,
    entity_name: context.entityName || null,
    dept_id: context.deptId || null,
    dept_name: context.deptName || null,
    dept_slug: context.deptSlug || null,
    author_id: context.authorId || null,
    author_name: context.authorName || null,
    sinta_source_url: context.currentUrl || null,
    scraped_at: context.scrapedAt || new Date().toISOString(),
  };
}

/**
 * Parse all `.ar-list-item` elements on a page.
 */
function parseAllArListItems($, context = {}) {
  const items = [];
  const $scoped = $('.profile-article .ar-list-item');
  const $targets = $scoped.length > 0 ? $scoped : $('.ar-list-item');

  $targets.each((_, el) => {
    const parsed = parseArListItem($, el, context);
    if (parsed.title) {
      items.push(parsed);
    }
  });
  return items;
}

/**
 * Convert a parsed research/service item into the exact schema expected by
 * `export-borang.js` and `export-report.js`.
 */
function toBorangResearchItem(item) {
  return {
    judul: item.title,
    leader: item.leader || item.creator || null,
    scheme: item.scheme || item.journal || null,
    year: item.year || null,
    fund_rp: item.fund_amount != null ? item.fund_amount : parseRupiah(item.fund_rp),
    fund_rp_text: item.fund_rp || null,
    status: item.status || null,
    source: item.source || null,
    members: (item.members || []).map((m) => ({
      sinta_id: m.sinta_id != null ? m.sinta_id : null,
      nama: m.nama,
    })),
    sinta_id_ketua:
      item.author_id && item.author_name && item.leader &&
      item.author_name.toLowerCase() === item.leader.toLowerCase()
        ? Number(item.author_id)
        : undefined,
    sinta_source_url: item.sinta_source_url || null,
    dedup_key: item.dedup_key,
  };
}

module.exports = {
  parseArListItem,
  parseAllArListItems,
  toBorangResearchItem,
};
