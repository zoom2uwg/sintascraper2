const { cleanText, parseScore } = require('./utils');

/**
 * Extract balanced {...} or [...] block starting at or after startIndex,
 * safely ignoring braces inside strings and JS comments.
 */
function extractBalancedBlock(source, startIndex, openChar = '{', closeChar = '}') {
  const firstOpen = source.indexOf(openChar, startIndex);
  if (firstOpen === -1) return null;

  let depth = 0;
  let i = firstOpen;
  const len = source.length;

  while (i < len) {
    const ch = source[i];
    const next = source[i + 1];

    // Single-line comment
    if (ch === '/' && next === '/') {
      const nl = source.indexOf('\n', i + 2);
      if (nl === -1) break;
      i = nl + 1;
      continue;
    }
    // Multi-line comment
    if (ch === '/' && next === '*') {
      const endComment = source.indexOf('*/', i + 2);
      if (endComment === -1) break;
      i = endComment + 2;
      continue;
    }
    // String literals
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      i++;
      while (i < len) {
        if (source[i] === '\\') {
          i += 2;
          continue;
        }
        if (source[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    if (ch === openChar) {
      depth++;
    } else if (ch === closeChar) {
      depth--;
      if (depth === 0) {
        return {
          text: source.slice(firstOpen, i + 1),
          start: firstOpen,
          end: i + 1,
        };
      }
    }
    i++;
  }
  return null;
}

/**
 * Strip JS comments from a code snippet before regex parsing values.
 */
function stripJsComments(code) {
  if (!code) return '';
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1');
}

/**
 * Parse a JS array literal of strings or numbers like ['2020', '2021'] or [1, 2, 3].
 */
function parseSimpleArray(arrLiteral) {
  if (!arrLiteral) return [];
  const inner = arrLiteral.trim().replace(/^\[/, '').replace(/\]$/, '').trim();
  if (!inner) return [];
  const items = [];
  const tokenRegex = /'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|(-?\d+(?:\.\d+)?)/g;
  let m;
  while ((m = tokenRegex.exec(inner)) !== null) {
    if (m[1] !== undefined) {
      items.push(m[1].replace(/\\'/g, "'"));
    } else if (m[2] !== undefined) {
      items.push(m[2].replace(/\\"/g, '"'));
    } else if (m[3] !== undefined) {
      items.push(Number(m[3]));
    }
  }
  return items;
}

/**
 * Parse quartile pie option block (`quartile-pie` / `optionQ`).
 */
function parseQuartilePie(optionText) {
  const cleaned = stripJsComments(optionText);
  const seriesIdx = cleaned.indexOf('series');
  if (seriesIdx === -1) return null;
  const dataIdx = cleaned.indexOf('data', seriesIdx);
  if (dataIdx === -1) return null;
  const arrBlock = extractBalancedBlock(cleaned, dataIdx, '[', ']');
  if (!arrBlock) return null;

  const distribution = {};
  const items = [];
  let total = 0;

  // Match { value: X, name: 'Q1' } or { name: 'Q1', value: X }
  const objRegex = /\{([^{}]+)\}/g;
  let m;
  while ((m = objRegex.exec(arrBlock.text)) !== null) {
    const body = m[1];
    const nameMatch = body.match(/name\s*:\s*['"]([^'"]+)['"]/);
    const valMatch = body.match(/value\s*:\s*(-?\d+(?:\.\d+)?)/);
    if (nameMatch && valMatch) {
      const name = cleanText(nameMatch[1]);
      const value = Number(valMatch[1]);
      distribution[name] = value;
      items.push({ name, value });
      total += value;
    }
  }

  return items.length > 0 ? { distribution, items, total } : null;
}

/**
 * Parse research output radar option block (`research-radar` / `optionRadar`).
 */
function parseResearchRadar(optionText) {
  const cleaned = stripJsComments(optionText);
  const indIdx = cleaned.indexOf('indicator');
  if (indIdx === -1) return null;
  const indArr = extractBalancedBlock(cleaned, indIdx, '[', ']');
  if (!indArr) return null;

  const indicators = [];
  const objRegex = /\{([^{}]+)\}/g;
  let m;
  while ((m = objRegex.exec(indArr.text)) !== null) {
    const body = m[1];
    const nameMatch = body.match(/name\s*:\s*['"]([^'"]+)['"]/);
    const maxMatch = body.match(/max\s*:\s*(-?\d+(?:\.\d+)?)/);
    if (nameMatch) {
      indicators.push({
        name: cleanText(nameMatch[1]),
        max: maxMatch ? Number(maxMatch[1]) : null,
      });
    }
  }

  const seriesIdx = cleaned.indexOf('series', indArr.end);
  if (seriesIdx === -1 || indicators.length === 0) return null;
  const valIdx = cleaned.indexOf('value', seriesIdx);
  if (valIdx === -1) return null;
  const valArr = extractBalancedBlock(cleaned, valIdx, '[', ']');
  const values = valArr ? parseSimpleArray(valArr.text) : [];

  const breakdown = {};
  let total = 0;
  const items = indicators.map((ind, idx) => {
    const val = typeof values[idx] === 'number' ? values[idx] : 0;
    breakdown[ind.name] = val;
    total += val;
    return { name: ind.name, value: val, max: ind.max };
  });

  return { breakdown, items, total };
}

/**
 * Parse Top Department horizontal bar chart (`top-dept` / `optionTopDept`).
 */
function parseTopDepartmentsChart(optionText) {
  const cleaned = stripJsComments(optionText);
  const yAxisIdx = cleaned.indexOf('yAxis');
  if (yAxisIdx === -1) return null;
  const yAxisObj = extractBalancedBlock(cleaned, yAxisIdx, '{', '}');
  if (!yAxisObj) return null;
  const yDataIdx = yAxisObj.text.indexOf('data');
  const yDataArr = yDataIdx !== -1 ? extractBalancedBlock(yAxisObj.text, yDataIdx, '[', ']') : null;
  const names = yDataArr ? parseSimpleArray(yDataArr.text) : [];

  const seriesIdx = cleaned.indexOf('series', yAxisObj.end);
  if (seriesIdx === -1) return null;
  const seriesArr = extractBalancedBlock(cleaned, seriesIdx, '[', ']');
  if (!seriesArr) return null;
  const sDataIdx = seriesArr.text.indexOf('data');
  const sDataArr = sDataIdx !== -1 ? extractBalancedBlock(seriesArr.text, sDataIdx, '[', ']') : null;
  const scores = sDataArr ? parseSimpleArray(sDataArr.text) : [];

  if (names.length === 0) return null;
  const items = names.map((deptLabel, idx) => ({
    department: String(deptLabel),
    score_3yr: typeof scores[idx] === 'number' ? scores[idx] : parseScore(scores[idx]),
  }));
  // Sort highest score first for convenience while preserving rank
  const ranked = [...items].sort((a, b) => (b.score_3yr || 0) - (a.score_3yr || 0));
  return { items, ranked };
}

/**
 * Parse category/year line or bar chart (e.g. `scopus-chart-articles`, `research-chart-articles`).
 */
function parseCategorySeriesChart(domId, optionText) {
  const cleaned = stripJsComments(optionText);
  const xAxisIdx = cleaned.indexOf('xAxis');
  if (xAxisIdx === -1) return null;
  const xAxisObj = extractBalancedBlock(cleaned, xAxisIdx, '{', '}');
  if (!xAxisObj) return null;
  const xDataIdx = xAxisObj.text.indexOf('data');
  const xDataArr = xDataIdx !== -1 ? extractBalancedBlock(xAxisObj.text, xDataIdx, '[', ']') : null;
  const labels = xDataArr ? parseSimpleArray(xDataArr.text).map(String) : [];

  const seriesIdx = cleaned.indexOf('series', xAxisObj.end);
  if (seriesIdx === -1) return null;
  const seriesArr = extractBalancedBlock(cleaned, seriesIdx, '[', ']');
  if (!seriesArr) return null;

  // Support single or multiple series inside series: [ { ... }, { ... } ]
  const seriesList = [];
  let cursor = 1;
  while (cursor < seriesArr.text.length) {
    const sObj = extractBalancedBlock(seriesArr.text, cursor, '{', '}');
    if (!sObj) break;
    cursor = sObj.end;

    const nameMatch = sObj.text.match(/name\s*:\s*['"]([^'"]+)['"]/);
    const typeMatch = sObj.text.match(/type\s*:\s*['"]([^'"]+)['"]/);
    const dIdx = sObj.text.indexOf('data');
    const dArr = dIdx !== -1 ? extractBalancedBlock(sObj.text, dIdx, '[', ']') : null;
    const values = dArr ? parseSimpleArray(dArr.text).map((v) => Number(v) || 0) : [];

    const byLabel = {};
    let total = 0;
    labels.forEach((lbl, idx) => {
      const val = values[idx] !== undefined ? values[idx] : 0;
      byLabel[lbl] = val;
      total += val;
    });

    seriesList.push({
      name: nameMatch ? cleanText(nameMatch[1]) : domId,
      type: typeMatch ? cleanText(typeMatch[1]) : 'line',
      values,
      byYear: byLabel,
      total,
    });
  }

  if (labels.length === 0 && seriesList.length === 0) return null;
  const primary = seriesList[0] || { values: [], byYear: {}, total: 0 };

  return {
    domId,
    labels,
    values: primary.values,
    byYear: primary.byYear,
    total: primary.total,
    series: seriesList,
  };
}

/**
 * Extract all ECharts data embedded in inline <script> tags on a SINTA page.
 */
function parseChartsFromScripts($) {
  const result = {
    quartilePie: null,
    researchRadar: null,
    topDepartments: null,
    yearlyTrends: {},
  };

  const scriptTexts = [];
  $('script:not([src])').each((_, el) => {
    const content = $(el).html();
    if (content && content.includes('echarts.init')) {
      scriptTexts.push(content);
    }
  });

  if (scriptTexts.length === 0) return result;

  const combined = scriptTexts.join('\n');
  const initRegex = /var\s+([A-Za-z0-9_$]+)\s*=\s*echarts\.init\(\s*document\.getElementById\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match;

  while ((match = initRegex.exec(combined)) !== null) {
    const chartVar = match[1];
    const domId = match[2];
    const searchFrom = match.index + match[0].length;

    // Locate the option assignment object right after echarts.init(...)
    const eqAssign = combined.slice(searchFrom).match(/(?:var\s+|let\s+|const\s+)?[A-Za-z0-9_$]+\s*=\s*\{/);
    if (!eqAssign) continue;

    const objStart = searchFrom + eqAssign.index + eqAssign[0].lastIndexOf('{');
    const optionBlock = extractBalancedBlock(combined, objStart, '{', '}');
    if (!optionBlock) continue;

    // Ensure this option block belongs to this chartVar (before chartVar.setOption)
    const setOptIdx = combined.indexOf(`${chartVar}.setOption`, searchFrom);
    if (setOptIdx !== -1 && objStart > setOptIdx) continue;

    if (domId === 'quartile-pie') {
      result.quartilePie = parseQuartilePie(optionBlock.text);
    } else if (domId === 'research-radar') {
      result.researchRadar = parseResearchRadar(optionBlock.text);
    } else if (domId === 'top-dept') {
      result.topDepartments = parseTopDepartmentsChart(optionBlock.text);
    } else {
      const parsedSeries = parseCategorySeriesChart(domId, optionBlock.text);
      if (parsedSeries) {
        result.yearlyTrends[domId] = parsedSeries;
      }
    }
  }

  return result;
}

module.exports = {
  extractBalancedBlock,
  parseChartsFromScripts,
};
