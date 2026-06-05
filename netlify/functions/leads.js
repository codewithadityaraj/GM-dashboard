const LEADS_URL = process.env.SHEET_URL_LEADS
  || 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQe0m4OUvApuACPrN8jWN7twZuoGgZA3jj3ZU9Adp1C5LTe_8DZD7rseDmtxoaE7poMn7CMd4nVxyoZ/pub?gid=1770292739&single=true&output=csv';

const CACHE_TTL_MS = 5 * 60 * 1000;
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

let sheetCache = { body: null, fetchedAt: 0 };

function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result.map((s) => s.replace(/^"|"$/g, '').trim());
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h.trim()] = (vals[idx] !== undefined ? vals[idx] : '').trim();
    });
    rows.push(obj);
  }
  return { headers, rows };
}

function rowToCSVLine(headers, obj) {
  return headers.map((h) => {
    const val = obj[h] ?? '';
    const s = String(val);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  }).join(',');
}

function normalizeDate(val) {
  if (!val) return '';
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  const parts = s.split('/');
  if (parts.length === 3) {
    const mm = parts[0].padStart(2, '0');
    const dd = parts[1].padStart(2, '0');
    let yy = parts[2].trim();
    if (yy.length === 2) yy = `20${yy}`;
    return `${yy}-${mm}-${dd}`;
  }
  return s.substring(0, 10);
}

function getField(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== '') return row[name];
  }
  return '';
}

function matchesFilters(row, filters) {
  const createdOn = normalizeDate(getField(row, ['Created On']));
  const gm = getField(row, ['GM NAME']).trim();
  const program = getField(row, ['Program']).trim();
  const tl = getField(row, ['TL Name ', 'TL Name']).trim();
  const owner = getField(row, ['Owner (User Email)']).trim();

  if (filters.dateFrom && createdOn && createdOn < filters.dateFrom) return false;
  if (filters.dateTo && createdOn && createdOn > filters.dateTo) return false;
  if (filters.gm && gm !== filters.gm) return false;
  if (filters.program && program !== filters.program) return false;
  if (filters.tl && tl !== filters.tl) return false;
  if (filters.bde && owner !== filters.bde) return false;
  return true;
}

async function getFullSheetText() {
  const now = Date.now();
  if (sheetCache.body && now - sheetCache.fetchedAt < CACHE_TTL_MS) {
    return sheetCache.body;
  }
  const resp = await fetch(LEADS_URL, {
    headers: { 'User-Agent': 'GM-Dashboard-Netlify/1.0' },
  });
  if (!resp.ok) {
    throw new Error(`Google Sheets returned HTTP ${resp.status}`);
  }
  const body = await resp.text();
  sheetCache = { body, fetchedAt: now };
  return body;
}

function buildMeta(rows) {
  let dateMin = '';
  let dateMax = '';
  const gms = new Set();
  const programs = new Set();
  const tls = new Set();
  const bdes = new Set();

  rows.forEach((row) => {
    const createdOn = normalizeDate(getField(row, ['Created On']));
    if (createdOn) {
      if (!dateMin || createdOn < dateMin) dateMin = createdOn;
      if (!dateMax || createdOn > dateMax) dateMax = createdOn;
    }
    const gm = getField(row, ['GM NAME']).trim();
    const program = getField(row, ['Program']).trim();
    const tl = getField(row, ['TL Name ', 'TL Name']).trim();
    const owner = getField(row, ['Owner (User Email)']).trim();
    if (gm) gms.add(gm);
    if (program) programs.add(program);
    if (tl) tls.add(tl);
    if (owner) bdes.add(owner);
  });

  return {
    dateMin,
    dateMax,
    rowCount: rows.length,
    gms: [...gms].sort(),
    programs: [...programs].sort(),
    tls: [...tls].sort(),
    bdes: [...bdes].sort(),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const qs = event.queryStringParameters || {};
  const filters = {
    dateFrom: qs.dateFrom || '',
    dateTo: qs.dateTo || '',
    gm: qs.gm && qs.gm !== 'ALL' ? qs.gm : '',
    program: qs.program && qs.program !== 'ALL' ? qs.program : '',
    tl: qs.tl && qs.tl !== 'ALL' ? qs.tl : '',
    bde: qs.bde && qs.bde !== 'ALL' ? qs.bde : '',
  };

  try {
    const text = await getFullSheetText();
    const { headers, rows } = parseCSV(text);

    if (qs.meta === '1') {
      return {
        statusCode: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
        },
        body: JSON.stringify(buildMeta(rows)),
      };
    }

    const filtered = rows.filter((row) => matchesFilters(row, filters));
    const csvBody = [
      headers.join(','),
      ...filtered.map((row) => rowToCSVLine(headers, row)),
    ].join('\n');

    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': 'public, max-age=120',
        'X-Filtered-Rows': String(filtered.length),
        'X-Total-Rows': String(rows.length),
      },
      body: csvBody,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Failed to fetch leads data' }),
    };
  }
};
