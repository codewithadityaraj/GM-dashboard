/* ==========================================================================
   GM DASHBOARD — app.js
   Credential-based, per-GM data, 4 views: Overview, Revenue, Productivity, Lead Report
   ========================================================================== */

// ==========================================
// GM CREDENTIALS & TEAM CONFIGURATION
// ==========================================
const USERS = {
  umang: {
    password: 'umang@123',
    displayName: 'Umang',
    tls: [
      {
        name: 'Rahul',
        program: 'Online MBA',
        target: 12000000,
        bdes: ['Aditi', 'Vikram', 'Kunal']
      },
      {
        name: 'Priya',
        program: 'Advanced AI/ML',
        target: 8000000,
        bdes: ['Riya', 'Arjun', 'Vivek']
      }
    ]
  },
  siddharth: {
    password: 'sid@123',
    displayName: 'Siddharth',
    tls: [
      {
        name: 'Amit',
        program: 'M.Tech Data Science',
        target: 10000000,
        bdes: ['Neha', 'Rohan']
      },
      {
        name: 'Sneha',
        program: 'Executive Cybersecurity',
        target: 6000000,
        bdes: ['Sameer', 'Pooja']
      }
    ]
  }
};

// ==========================================
// GLOBAL STATE
// ==========================================
let currentUser = null;   // set on login

let activeView = 'overview';

let activeFilters = {
  gm: 'ALL',
  program: 'ALL',
  tl: 'ALL',
  bde: 'ALL',
  dateFrom: '2026-05-01',
  dateTo: '2026-05-28'
};

let charts = {};   // chart.js instances

// ==========================================
// LEAD ANALYSIS — CSV STATE
// ==========================================
const SHEETS_API = {
  productivity: '/api/sheets?sheet=productivity',
  revenueToken: '/api/sheets?sheet=revenue-token',
  revenueFull:  '/api/sheets?sheet=revenue-full',
};

const DEFAULT_SHEET_URLS = {
  leads: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQe0m4OUvApuACPrN8jWN7twZuoGgZA3jj3ZU9Adp1C5LTe_8DZD7rseDmtxoaE7poMn7CMd4nVxyoZ/pub?gid=1770292739&single=true&output=csv',
  productivity: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT6_Ukl-_qTeyobt1Q3SpgXhR0921qgUWrz6WPnINvl3U2OXl1dcsjEyGgMafUmG_cb9rE6QNrWZkuX/pub?gid=948739317&single=true&output=csv',
  revenueToken: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSYw0XpoBrl5gNAHq3n2p-OLAEOHwsBVVQy70ffPRRSk2SloYaqPPZ1X6YcuesaGvzlgf1EDUE8bwJV/pub?gid=0&single=true&output=csv',
  revenueFull: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSYw0XpoBrl5gNAHq3n2p-OLAEOHwsBVVQy70ffPRRSk2SloYaqPPZ1X6YcuesaGvzlgf1EDUE8bwJV/pub?gid=1494867608&single=true&output=csv',
};

let sheetConfig = null;
let sheetConfigPromise = null;

async function loadSheetConfig() {
  if (sheetConfig) return sheetConfig;
  if (!sheetConfigPromise) {
    sheetConfigPromise = fetch('/api/config')
      .then((resp) => (resp.ok ? resp.json() : { ...DEFAULT_SHEET_URLS }))
      .catch(() => ({ ...DEFAULT_SHEET_URLS }))
      .then((cfg) => {
        sheetConfig = { ...DEFAULT_SHEET_URLS, ...cfg };
        return sheetConfig;
      });
  }
  return sheetConfigPromise;
}

function viewUsesLeadCSV() {
  return CSV_LEAD_VIEWS.includes(activeView) || activeView === 'overview';
}
let laAllRows  = [];   // parsed CSV rows
let laLoaded   = false;
let laLoading  = false;

const CSV_LEAD_VIEWS = ['lead-analysis', 'leads'];
const TOKEN_REVENUE_RATE = 5000;
let prodAllRows  = [];
let prodLoaded   = false;
let prodLoading  = false;
let revTokenRows = [];
let revFullRows  = [];
let revLoaded    = false;
let revLoading   = false;

function isNonBlank(val) {
  return val != null && String(val).trim() !== '';
}

function usesCSVLeadData() {
  return CSV_LEAD_VIEWS.includes(activeView) && laLoaded;
}

function usesCSVProdData() {
  return activeView === 'productivity' && prodLoaded;
}

function usesCSVRevData() {
  return (activeView === 'revenue' || activeView === 'overview') && revLoaded;
}

function isCSVFilterView(viewId) {
  return CSV_LEAD_VIEWS.includes(viewId) || viewId === 'productivity' || viewId === 'revenue' || viewId === 'overview';
}

function prodOwnerMatchesBdeFilter(owner, bdeFilter) {
  if (!bdeFilter || bdeFilter === 'ALL') return true;
  if ((owner || '').trim() === bdeFilter) return true;
  if (bdeFilter.includes('@')) {
    const disp = emailToDisplayName(bdeFilter).toLowerCase();
    const o = (owner || '').trim().toLowerCase();
    return o === disp || o === bdeFilter.toLowerCase();
  }
  return false;
}

function getOverviewProdData() {
  let pool = getProdGlobalData();
  const programOwners = getProdOwnersForProgram();
  if (programOwners) pool = pool.filter(r => programOwners.has(r.owner));
  if (activeFilters.tl !== 'ALL') pool = pool.filter(r => r.manager === activeFilters.tl);
  if (activeFilters.bde !== 'ALL') pool = pool.filter(r => prodOwnerMatchesBdeFilter(r.owner, activeFilters.bde));
  return pool;
}

// MM/DD/YYYY or M/D/YYYY → YYYY-MM-DD
function parseSheetDate(val) {
  if (!val || !String(val).trim()) return '';
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  const parts = s.split('/');
  if (parts.length === 3) {
    const mm = parts[0].padStart(2, '0');
    const dd = parts[1].padStart(2, '0');
    let yy = parts[2].trim();
    if (yy.length === 2) yy = '20' + yy;
    return `${yy}-${mm}-${dd}`;
  }
  return '';
}

function parseNum(val) {
  const n = parseFloat(String(val ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

// ashish.singh@futurense.com → Ashish | ashish@futurense.com → Ashish
function emailToDisplayName(email) {
  if (!email || !email.includes('@')) return email || '—';
  const local = (email.split('@')[0] || '').trim();
  const first = (local.split('.')[0] || local).trim();
  if (!first) return email;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function buildTeamTreeFromCSV() {
  const tree = {};
  const add = (gm, tl, owner) => {
    if (!gm || !tl || !owner) return;
    if (!tree[gm]) tree[gm] = {};
    if (!tree[gm][tl]) tree[gm][tl] = new Set();
    tree[gm][tl].add(owner);
  };
  if (prodLoaded) prodAllRows.forEach(r => add(r.gm, r.manager, r.owner));
  if (laLoaded)   laAllRows.forEach(r => add(r.gm, r.tl, r.owner));
  return tree;
}

function renderSidebarTeam() {
  const teamList = document.getElementById('sidebar-team-list');
  if (!teamList) return;
  teamList.innerHTML = '';

  if (prodLoaded || laLoaded) {
    const tree = buildTeamTreeFromCSV();
    let gmNames = Object.keys(tree).sort();
    if (activeFilters.gm !== 'ALL') {
      gmNames = gmNames.filter(g => g === activeFilters.gm);
    }

    if (gmNames.length === 0) {
      teamList.innerHTML = '<div class="team-empty">No team data</div>';
      return;
    }

    gmNames.forEach(gmName => {
      const gmBlock = document.createElement('div');
      gmBlock.className = 'team-gm-block';

      if (activeFilters.gm === 'ALL') {
        const gmTitle = document.createElement('div');
        gmTitle.className = 'team-gm-name';
        gmTitle.textContent = gmName;
        gmBlock.appendChild(gmTitle);
      }

      Object.keys(tree[gmName]).sort().forEach(tlName => {
        const owners = [...tree[gmName][tlName]].sort();
        const block = document.createElement('div');
        block.className = 'team-tl-block';
        block.innerHTML = `
          <div class="team-tl-name">
            <span class="team-tl-dot"></span>
            ${tlName}
          </div>
          <div class="team-bde-list">
            ${owners.map(o => `<span class="team-bde-pill" title="${o}">${emailToDisplayName(o)}</span>`).join('')}
          </div>
        `;
        gmBlock.appendChild(block);
      });

      teamList.appendChild(gmBlock);
    });
    return;
  }

  // Fallback: USERS config (Overview / Revenue before CSV loads)
  getMyTLs().forEach(tl => {
    const block = document.createElement('div');
    block.className = 'team-tl-block';
    block.innerHTML = `
      <div class="team-tl-name">
        <span class="team-tl-dot"></span>
        TL ${tl.name}
      </div>
      <div class="team-tl-program">${tl.program}</div>
      <div class="team-bde-list">
        ${tl.bdes.map(b => `<span class="team-bde-pill">${b}</span>`).join('')}
      </div>
    `;
    teamList.appendChild(block);
  });
}

// ==========================================
// DATA GENERATION (procedural, seeded)
// ==========================================

// All possible managers & BDEs (combined for both GMs)
const ALL_TLS = [
  { name: 'Rahul',  program: 'Online MBA',              target: 12000000, bdes: ['Aditi', 'Vikram', 'Kunal'] },
  { name: 'Priya',  program: 'Advanced AI/ML',          target: 8000000,  bdes: ['Riya', 'Arjun', 'Vivek'] },
  { name: 'Amit',   program: 'M.Tech Data Science',     target: 10000000, bdes: ['Neha', 'Rohan'] },
  { name: 'Sneha',  program: 'Executive Cybersecurity',  target: 6000000,  bdes: ['Sameer', 'Pooja'] }
];

function generateDatabase() {
  const calls = [];
  const leads = [];
  const payments = [];

  const startDate = new Date('2026-05-01');
  const endDate   = new Date('2026-05-28');

  let seed = 987654;
  function rand() {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }
  function randInt(min, max) { return Math.floor(rand() * (max - min + 1)) + min; }
  function randItem(arr) { return arr[Math.floor(rand() * arr.length)]; }

  const stages    = ['Interested', 'Follow Up', 'Not Connected', 'Invalid', 'Enrolled'];
  const weights   = [0.25, 0.35, 0.20, 0.10, 0.10];
  const sources   = ['Google Search', 'LinkedIn Ad', 'Meta Ads', 'Organic Referral', 'Direct Visit'];
  const campaigns = ['Summer Push 2026', 'MBA Awareness', 'AI Masters Q2', 'Referral Boost', 'Remarketing Wave'];

  const payAmounts = {
    'Online MBA':              { full: 120000, token: 25000 },
    'Advanced AI/ML':          { full: 75000,  token: 15000 },
    'M.Tech Data Science':     { full: 100000, token: 20000 },
    'Executive Cybersecurity': { full: 60000,  token: 10000 }
  };

  ALL_TLS.forEach(tl => {
    tl.bdes.forEach(bde => {

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];

        // --- Calls ---
        const avgCalls = tl.name === 'Rahul' ? 65 : tl.name === 'Priya' ? 72 : 58;
        const dailyCalls     = randInt(avgCalls - 15, avgCalls + 15);
        const dailyConnected = Math.floor(dailyCalls * randInt(25, 42) / 100);
        const dailyTalkSec   = dailyConnected * randInt(90, 180);

        calls.push({
          date:      dateStr,
          bde:       bde,
          tl:        tl.name,
          program:   tl.program,
          calls:     dailyCalls,
          connected: dailyConnected,
          talkTimeMin: Math.round(dailyTalkSec / 60)
        });

        // --- Leads (2-4 per BDE per day) ---
        const dailyLeadsCount = randInt(2, 4);
        for (let i = 0; i < dailyLeadsCount; i++) {
          let stageRand = rand();
          let stage = stages[0];
          let cum = 0;
          for (let s = 0; s < stages.length; s++) {
            cum += weights[s];
            if (stageRand <= cum) { stage = stages[s]; break; }
          }
          leads.push({
            date:     dateStr,
            bde:      bde,
            tl:       tl.name,
            program:  tl.program,
            stage:    stage,
            source:   randItem(sources),
            campaign: randItem(campaigns)
          });
        }

        // --- Payments (occasional) ---
        const dayOfWeek    = d.getDay();
        const paymentChance = dayOfWeek === 0 ? 0.05 : 0.22;
        if (rand() < paymentChance) {
          const isFullPay = rand() > 0.6;
          const amts      = payAmounts[tl.program];
          payments.push({
            date:    dateStr,
            bde:     bde,
            tl:      tl.name,
            program: tl.program,
            amount:  isFullPay ? amts.full : amts.token,
            type:    isFullPay ? 'Full Enrollment' : 'Token Booking'
          });
        }
      }
    });
  });

  return { calls, leads, payments };
}

const DB = generateDatabase();

// ==========================================
// FORMAT HELPERS
// ==========================================
function fCurrency(n) {
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2) + ' Cr';
  if (n >= 100000)   return '₹' + (n / 100000).toFixed(2) + ' L';
  if (n >= 1000)     return '₹' + (n / 1000).toFixed(1) + ' K';
  return '₹' + n.toLocaleString('en-IN');
}

function fNum(n) { return n.toLocaleString('en-IN'); }

// ==========================================
// FILTER DATA HELPERS
// ==========================================
// Returns TLs for current user — filtered by active program if set
function getMyTLs() {
  let allTLs = [];
  if (activeFilters.gm === 'ALL') {
    Object.keys(USERS).forEach(username => {
      allTLs = allTLs.concat(USERS[username].tls);
    });
  } else {
    const gm = activeFilters.gm || currentUser || 'umang';
    allTLs = USERS[gm] ? USERS[gm].tls : [];
  }
  if (activeFilters.program !== 'ALL') {
    return allTLs.filter(tl => tl.program === activeFilters.program);
  }
  return allTLs;
}

function getMyTLNames() {
  return getMyTLs().map(t => t.name);
}

// Returns all BDEs for current user (or for a specific TL if provided)
function getMyBDEs(tlName = null) {
  const tls = getMyTLs();
  if (tlName && tlName !== 'ALL') {
    const tl = tls.find(t => t.name === tlName);
    return tl ? tl.bdes : [];
  }
  return tls.flatMap(t => t.bdes);
}

function filterData(arr) {
  const myTLNames = getMyTLNames();
  return arr.filter(item => {
    const inMyTeam = myTLNames.includes(item.tl);
    const inDate   = item.date >= activeFilters.dateFrom && item.date <= activeFilters.dateTo;
    const inTL     = activeFilters.tl  === 'ALL' || item.tl  === activeFilters.tl;
    const inBDE    = activeFilters.bde === 'ALL' || item.bde === activeFilters.bde;
    return inMyTeam && inDate && inTL && inBDE;
  });
}

function filteredCalls()    { return filterData(DB.calls);    }
function filteredLeads()    { return filterData(DB.leads);    }
function filteredPayments() { return filterData(DB.payments); }

// ==========================================
// AUTH
// ==========================================
function handleLogin() {
  const username = document.getElementById('login-username').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;
  const errorEl  = document.getElementById('login-error');

  if (USERS[username] && USERS[username].password === password) {
    errorEl.classList.remove('show');
    currentUser = username;
    initDashboard();
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app-layout').style.display = 'grid';
  } else {
    errorEl.classList.add('show');
    document.getElementById('login-password').value = '';
    document.getElementById('login-password').focus();
  }
}

function handleLogout() {
  // Destroy all charts
  Object.keys(charts).forEach(k => {
    if (charts[k]) { charts[k].destroy(); delete charts[k]; }
  });

  currentUser = null;
  activeFilters = { gm: 'ALL', program: 'ALL', tl: 'ALL', bde: 'ALL', dateFrom: '2026-05-01', dateTo: '2026-05-28' };

  document.getElementById('app-layout').style.display = 'none';
  const overlay = document.getElementById('login-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('login-error').classList.remove('show');
  }
}

// ==========================================
// DASHBOARD INIT (after login)
// ==========================================
function initDashboard() {
  const user = USERS[currentUser] || { displayName: 'Umang' };

  // Set GM name label in top navbar
  const currentGMName = activeFilters.gm === 'ALL' ? 'All GMs' : (USERS[activeFilters.gm]?.displayName || user.displayName);
  document.getElementById('gm-dashboard-label').textContent = currentGMName + "'s Dashboard";

  // Sidebar user info
  document.getElementById('sidebar-avatar').textContent = currentGMName.charAt(0).toUpperCase();
  document.getElementById('sidebar-username').textContent = currentGMName;

  renderSidebarTeam();

  // Reset all filters for clean state
  activeFilters.gm = 'ALL';
  activeFilters.program = 'ALL';
  activeFilters.tl = 'ALL';
  activeFilters.bde = 'ALL';

  if (document.getElementById('filter-gm')) {
    populateGMFilterFromUsers();
    document.getElementById('filter-gm').value = activeFilters.gm;
  }

  // Populate Program filter (all programs this GM manages)
  populateProgramFilter();

  // Populate TL filter (all TLs under this GM)
  populateTLFilter();

  // Populate BDE filter (all BDEs)
  populateBDEFilter('ALL');

  // Set dates
  document.getElementById('date-from').value = activeFilters.dateFrom;
  document.getElementById('date-to').value   = activeFilters.dateTo;

  // Preload CSVs for Overview + My Team
  if (!prodLoaded && !prodLoading) fetchProductivityCSV();
  if (!revLoaded && !revLoading) fetchRevenueCSV();
  if (!laLoaded && !laLoading) fetchLeadCSV();

  // Show overview
  switchView('overview');
}

// Restore GM dropdown to USERS-keyed options (for non-LA views)
function populateGMFilterFromUsers() {
  const gmSel = document.getElementById('filter-gm');
  if (!gmSel) return;
  const current = gmSel.value;
  gmSel.innerHTML = '<option value="ALL">All GMs</option>';
  Object.keys(USERS).forEach(key => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = USERS[key].displayName;
    gmSel.appendChild(opt);
  });
  gmSel.value = Object.keys(USERS).includes(current) ? current : 'ALL';
}

// Populate Program filter for logged-in GM
function populateProgramFilter() {
  const progSelect = document.getElementById('filter-program');
  progSelect.innerHTML = '<option value="ALL">All Programs</option>';
  
  let tls = [];
  if (activeFilters.gm === 'ALL') {
    Object.keys(USERS).forEach(username => {
      tls = tls.concat(USERS[username].tls);
    });
  } else {
    const gm = activeFilters.gm || currentUser || 'umang';
    tls = USERS[gm] ? USERS[gm].tls : [];
  }
  
  const uniquePrograms = [...new Set(tls.map(tl => tl.program))];
  uniquePrograms.forEach(prog => {
    const opt = document.createElement('option');
    opt.value = prog;
    opt.textContent = prog;
    progSelect.appendChild(opt);
  });
  progSelect.value = activeFilters.program;
}

// Populate TL filter — scoped to selected program
function populateTLFilter() {
  const tlSelect = document.getElementById('filter-tl');
  tlSelect.innerHTML = '<option value="ALL">All TLs</option>';
  
  let tls = [];
  if (activeFilters.gm === 'ALL') {
    Object.keys(USERS).forEach(username => {
      tls = tls.concat(USERS[username].tls);
    });
  } else {
    const gm = activeFilters.gm || currentUser || 'umang';
    tls = USERS[gm] ? USERS[gm].tls : [];
  }

  const scopedTLs = activeFilters.program === 'ALL'
    ? tls
    : tls.filter(tl => tl.program === activeFilters.program);
  scopedTLs.forEach(tl => {
    const opt = document.createElement('option');
    opt.value = tl.name;
    opt.textContent = `${tl.name} (${tl.program.split(' ')[0]})`;
    tlSelect.appendChild(opt);
  });
  tlSelect.value = activeFilters.tl;
}

// Populate BDE filter based on selected TL
function populateBDEFilter(tlName) {
  const bdeSelect = document.getElementById('filter-bde');
  bdeSelect.innerHTML = '<option value="ALL">All BDEs</option>';
  const bdes = getMyBDEs(tlName);
  bdes.forEach(bde => {
    const opt = document.createElement('option');
    opt.value = bde;
    opt.textContent = bde;
    bdeSelect.appendChild(opt);
  });
  bdeSelect.value = activeFilters.bde;
}

// ==========================================
// FILTER APPLY — cascades: Program → TL → BDE
// ==========================================
function applyFilters() {
  const prevGM      = activeFilters.gm;
  const prevProgram = activeFilters.program;
  const prevTL      = activeFilters.tl;

  if (document.getElementById('filter-gm')) {
    activeFilters.gm = document.getElementById('filter-gm').value;
  }
  activeFilters.program  = document.getElementById('filter-program').value;
  activeFilters.tl       = document.getElementById('filter-tl').value;
  activeFilters.bde      = document.getElementById('filter-bde').value;
  activeFilters.dateFrom = document.getElementById('date-from').value;
  activeFilters.dateTo   = document.getElementById('date-to').value;

  if (usesCSVProdData()) {
    if (activeFilters.gm !== prevGM) {
      activeFilters.program = 'ALL';
      activeFilters.tl      = 'ALL';
      activeFilters.bde     = 'ALL';
      populateProdPrograms();
      populateProdTLs();
      populateProdBDEs('ALL');
      document.getElementById('filter-program').value = 'ALL';
      document.getElementById('filter-tl').value      = 'ALL';
      document.getElementById('filter-bde').value     = 'ALL';
    } else if (activeFilters.program !== prevProgram) {
      activeFilters.tl  = 'ALL';
      activeFilters.bde = 'ALL';
      populateProdTLs();
      populateProdBDEs('ALL');
      document.getElementById('filter-tl').value  = 'ALL';
      document.getElementById('filter-bde').value = 'ALL';
    } else if (activeFilters.tl !== prevTL) {
      activeFilters.bde = 'ALL';
      populateProdBDEs(activeFilters.tl);
      document.getElementById('filter-bde').value = 'ALL';
    }
  } else if (usesCSVLeadData()) {
    // Lead Report / Lead Analysis: cascade using CSV data
    if (activeFilters.gm !== prevGM) {
      activeFilters.program = 'ALL';
      activeFilters.tl      = 'ALL';
      activeFilters.bde     = 'ALL';
      populateLAPrograms();
      populateLATLs();
      populateLABDEs('ALL');
      document.getElementById('filter-program').value = 'ALL';
      document.getElementById('filter-tl').value      = 'ALL';
      document.getElementById('filter-bde').value     = 'ALL';
    } else if (activeFilters.program !== prevProgram) {
      activeFilters.tl  = 'ALL';
      activeFilters.bde = 'ALL';
      populateLATLs();
      populateLABDEs('ALL');
      document.getElementById('filter-tl').value  = 'ALL';
      document.getElementById('filter-bde').value = 'ALL';
    } else if (activeFilters.tl !== prevTL) {
      activeFilters.bde = 'ALL';
      populateLABDEs(activeFilters.tl);
      document.getElementById('filter-bde').value = 'ALL';
    }
  } else if (usesCSVRevData()) {
    if (activeFilters.gm !== prevGM) {
      activeFilters.program = 'ALL';
      activeFilters.tl      = 'ALL';
      activeFilters.bde     = 'ALL';
      populateRevPrograms();
      populateRevTLs();
      populateRevBDEs('ALL');
      document.getElementById('filter-program').value = 'ALL';
      document.getElementById('filter-tl').value      = 'ALL';
      document.getElementById('filter-bde').value     = 'ALL';
    } else if (activeFilters.program !== prevProgram) {
      activeFilters.tl  = 'ALL';
      activeFilters.bde = 'ALL';
      populateRevTLs();
      populateRevBDEs('ALL');
      document.getElementById('filter-tl').value  = 'ALL';
      document.getElementById('filter-bde').value = 'ALL';
    } else if (activeFilters.tl !== prevTL) {
      activeFilters.bde = 'ALL';
      populateRevBDEs(activeFilters.tl);
      document.getElementById('filter-bde').value = 'ALL';
    }
  } else if (!isCSVFilterView(activeView)) {
    // Other views: cascade using USERS config data
    if (activeFilters.gm !== prevGM) {
      activeFilters.program = 'ALL';
      activeFilters.tl      = 'ALL';
      activeFilters.bde     = 'ALL';

      populateProgramFilter();
      populateTLFilter();
      populateBDEFilter('ALL');

      document.getElementById('filter-program').value = 'ALL';
      document.getElementById('filter-tl').value      = 'ALL';
      document.getElementById('filter-bde').value     = 'ALL';

      let gmLabel = 'All GMs';
      let avatarChar = 'A';
      if (activeFilters.gm !== 'ALL') {
        const user = USERS[activeFilters.gm];
        gmLabel = user.displayName;
        avatarChar = user.displayName.charAt(0).toUpperCase();
      }
      document.getElementById('gm-dashboard-label').textContent = gmLabel + "'s Dashboard";
      document.getElementById('sidebar-avatar').textContent = avatarChar;
      document.getElementById('sidebar-username').textContent = gmLabel;
    } else if (activeFilters.program !== prevProgram) {
      activeFilters.tl  = 'ALL';
      activeFilters.bde = 'ALL';
      populateTLFilter();
      populateBDEFilter('ALL');
      document.getElementById('filter-tl').value  = 'ALL';
      document.getElementById('filter-bde').value = 'ALL';
    } else if (activeFilters.tl !== prevTL) {
      activeFilters.bde = 'ALL';
      populateBDEFilter(activeFilters.tl);
      document.getElementById('filter-bde').value = 'ALL';
    }
  }

  renderSidebarTeam();
  renderActiveView();
}

// ==========================================
// NAVIGATION
// ==========================================
const VIEW_TITLES = {
  overview:       'Overview',
  revenue:        'Revenue',
  productivity:   'Productivity',
  leads:          'Lead Report',
  'lead-analysis':'Lead Analysis'
};

function switchView(viewId) {
  const prevView = activeView;
  activeView = viewId;

  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById(`nav-${viewId}`);
  if (navEl) navEl.classList.add('active');

  document.querySelectorAll('.viewport-section').forEach(el => el.classList.remove('active'));
  const sectionEl = document.getElementById(`view-${viewId}`);
  if (sectionEl) sectionEl.classList.add('active');

  document.getElementById('page-title').textContent = VIEW_TITLES[viewId] || viewId;
  document.getElementById('sidebar').classList.remove('mobile-open');

  const wasCSVView = isCSVFilterView(prevView);
  const isCSVView  = isCSVFilterView(viewId);

  // Restore USERS-based dropdowns when leaving CSV-powered views
  if (wasCSVView && !isCSVView) {
    populateGMFilterFromUsers();
    activeFilters.gm = 'ALL';
    document.getElementById('filter-gm').value = 'ALL';
    activeFilters.program = 'ALL';
    activeFilters.tl = 'ALL';
    activeFilters.bde = 'ALL';
    populateProgramFilter();
    populateTLFilter();
    populateBDEFilter('ALL');
    document.getElementById('filter-program').value = 'ALL';
    document.getElementById('filter-tl').value = 'ALL';
    document.getElementById('filter-bde').value = 'ALL';
  }

  if (CSV_LEAD_VIEWS.includes(viewId) && laLoaded) {
    populateLAGlobalFilters();
  }
  if (viewId === 'productivity' && prodLoaded) {
    populateProdGlobalFilters();
  }
  if ((viewId === 'revenue' || viewId === 'overview') && revLoaded) {
    populateRevGlobalFilters();
  }

  renderActiveView();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('mobile-open');
}

function renderActiveView() {
  switch (activeView) {
    case 'overview':       renderOverview();       break;
    case 'revenue':        renderRevenue();        break;
    case 'productivity':   renderProductivity();   break;
    case 'leads':          renderLeads();          break;
    case 'lead-analysis':  renderLeadAnalysis();   break;
  }
}

// Chart destroy helper
function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

// Chart.js default overrides for cleaner look
const CHART_DEFAULTS = {
  font: { family: 'Inter', size: 11 },
  color: '#64748b'
};

// ==========================================
// OVERVIEW VIEW — Revenue + Leads + Productivity CSVs
// ==========================================
function renderOverview() {
  if (!revLoaded) {
    fetchRevenueCSV();
    return;
  }
  if (!laLoaded && !laLoading) fetchLeadCSV();
  if (!prodLoaded && !prodLoading) fetchProductivityCSV();

  const tokenData = getBaseRevTokens();
  const fullData  = getBaseRevFullPayments();

  const tokenAgg   = revAggTokens(tokenData);
  const fullAgg    = revAggFull(fullData);
  const tokenRev   = tokenAgg.amount;
  const fullRev    = fullAgg.amount;
  const tokenCount = tokenAgg.count;
  const fullCount  = fullAgg.count;
  const totalRev   = tokenRev + fullRev;

  setText('ov-enrollments', fNum(fullCount));
  setText('ov-enrollments-sub', `${tokenCount} token booking${tokenCount !== 1 ? 's' : ''}`);
  setText('ov-tokens', fNum(tokenCount));
  setText('ov-revenue', fCurrency(totalRev));
  setText('ov-target-pct', '—');
  setText('ov-target-sub', 'No target in sheet');

  // Target (Unit wise) — grouped by Type (Program) from revenue sheets
  const targetUnitsContainer = document.getElementById('ov-target-units');
  targetUnitsContainer.innerHTML = '';
  const typeSet = new Set([
    ...tokenData.map(r => r.type).filter(Boolean),
    ...fullData.map(r => r.type).filter(Boolean)
  ]);
  const types = [...typeSet].sort();

  types.forEach((type, idx) => {
    const tRows = tokenData.filter(r => r.type === type);
    const fRows = fullData.filter(r => r.type === type);
    const achieved = revAggTokens(tRows).amount + revAggFull(fRows).amount;
    const accentClass = idx % 3 === 0 ? 'accent-indigo' : idx % 3 === 1 ? 'accent-emerald' : 'accent-purple';
    const card = document.createElement('div');
    card.className = `target-card ${accentClass}`;
    card.innerHTML = `
      <div class="target-card-header">
        <span class="target-card-title">${type}</span>
        <span class="target-card-sub">Token: ${fCurrency(revAggTokens(tRows).amount)} · Full: ${fCurrency(revAggFull(fRows).amount)}</span>
      </div>
      <div class="target-progress-wrap">
        <div class="target-progress-stats">
          <span>Total: ${fCurrency(achieved)}</span>
          <span>${fNum(tRows.length + fRows.length)} bookings</span>
        </div>
      </div>
    `;
    targetUnitsContainer.appendChild(card);
  });
  if (types.length === 0) {
    targetUnitsContainer.innerHTML = '<div class="empty-row" style="grid-column: 1/-1;">No revenue data for selected filters</div>';
  }

  // Lead Metrics — from leads CSV
  if (laLoaded) {
    const leadData = getBaseLAData();
    const totalLeads    = leadData.length;
    const leadTokens    = leadData.filter(r => isNonBlank(r.tokenDate)).length;
    const totalEnrolled = leadData.filter(r => isNonBlank(r.enrollmentDate)).length;
    const cvr           = totalLeads ? ((totalEnrolled / totalLeads) * 100).toFixed(2) : '0.00';
    setText('ov-lead-total', fNum(totalLeads));
    setText('ov-lead-tokens', fNum(leadTokens));
    setText('ov-lead-cvr', `${cvr}%`);
  } else {
    setText('ov-lead-total', '…');
    setText('ov-lead-tokens', '…');
    setText('ov-lead-cvr', '…');
  }

  // Input Metrics — from productivity CSV
  if (prodLoaded) {
    const cData = getOverviewProdData();
    const { calls, connects, talk, activeBdes } = prodAggregate(cData);
    const dateFrom  = new Date(activeFilters.dateFrom);
    const dateTo    = new Date(activeFilters.dateTo);
    const daysCount = Math.max(1, Math.round((dateTo - dateFrom) / (1000 * 60 * 60 * 24)) + 1);
    const denom     = Math.max(1, activeBdes * daysCount);
    const avgDialled    = (calls / denom).toFixed(1);
    const avgConnected  = (connects / denom).toFixed(1);
    const avgTalkSec    = connects ? Math.round((talk * 60) / connects) : 0;
    setText('ov-input-dialled', avgDialled);
    setText('ov-input-connected', avgConnected);
    setText('ov-input-talktime', formatAvgTalk(avgTalkSec));
  } else {
    setText('ov-input-dialled', '…');
    setText('ov-input-connected', '…');
    setText('ov-input-talktime', '…');
  }

  // Top 3 BDAs by total revenue
  const bdaPodiumContainer = document.getElementById('ov-podium-bdas');
  bdaPodiumContainer.innerHTML = '';
  const bdeMap = {};
  tokenData.forEach(r => {
    if (!r.bdMail) return;
    if (!bdeMap[r.bdMail]) bdeMap[r.bdMail] = { tokens: [], full: [], type: r.type };
    bdeMap[r.bdMail].tokens.push(r);
    if (r.type) bdeMap[r.bdMail].type = r.type;
  });
  fullData.forEach(r => {
    if (!r.bdMail) return;
    if (!bdeMap[r.bdMail]) bdeMap[r.bdMail] = { tokens: [], full: [], type: r.type };
    bdeMap[r.bdMail].full.push(r);
  });

  const bdaRankings = Object.keys(bdeMap).map(bd => {
    const tAmt = revAggTokens(bdeMap[bd].tokens).amount;
    const fAmt = revAggFull(bdeMap[bd].full).amount;
    return { bd, revenue: tAmt + fAmt, type: bdeMap[bd].type || '—' };
  }).sort((a, b) => b.revenue - a.revenue);

  const topBDAs = bdaRankings.filter(b => b.revenue > 0).slice(0, 3);
  if (topBDAs.length > 0) {
    topBDAs.forEach((bda, index) => {
      const card = document.createElement('div');
      card.className = `podium-card rank-${index + 1}`;
      card.innerHTML = `
        <div class="podium-card-head">
          <div class="podium-rank-badge">${index + 1}</div>
          <div class="podium-bda-name" title="${bda.bd}">${emailToDisplayName(bda.bd)}</div>
        </div>
        <div class="podium-bda-program">${bda.type}</div>
        <div class="podium-bda-rev">${fCurrency(bda.revenue)}</div>
      `;
      bdaPodiumContainer.appendChild(card);
    });
  } else {
    bdaPodiumContainer.innerHTML = '<div class="empty-row" style="width: 100%">No revenue data for BDAs in this period</div>';
  }

  // GM Performance
  const gmTbody = document.getElementById('ov-gm-table');
  gmTbody.innerHTML = '';
  const gmNames = activeFilters.gm === 'ALL'
    ? [...new Set([...tokenData, ...fullData].map(r => r.gm).filter(Boolean))].sort()
    : [activeFilters.gm];

  gmNames.forEach(gmName => {
    const gmTokens = revAggTokens(tokenData.filter(r => r.gm === gmName));
    const gmFull   = revAggFull(fullData.filter(r => r.gm === gmName));
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="bold">${gmName}</td>
      <td class="mono">—</td>
      <td class="mono">${fCurrency(gmTokens.amount)}</td>
      <td class="mono">${fCurrency(gmFull.amount)}</td>
    `;
    gmTbody.appendChild(tr);
  });
  if (gmTbody.innerHTML === '') emptyRow(gmTbody, 4);

  // TL Performance
  const tlTbody = document.getElementById('ov-tl-perf-table');
  tlTbody.innerHTML = '';
  const tlNames = [...new Set([...tokenData, ...fullData].map(r => r.tl).filter(Boolean))].sort();
  tlNames.forEach(tlName => {
    const tlTokens = revAggTokens(tokenData.filter(r => r.tl === tlName));
    const tlFull   = revAggFull(fullData.filter(r => r.tl === tlName));
    if (tlTokens.count === 0 && tlFull.count === 0) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="bold">${tlName}</td>
      <td class="mono">—</td>
      <td class="mono">${fCurrency(tlTokens.amount)}</td>
      <td class="mono">${fCurrency(tlFull.amount)}</td>
    `;
    tlTbody.appendChild(tr);
  });
  if (tlTbody.innerHTML === '') emptyRow(tlTbody, 4);

  // BDA Performance
  const bdaTbody = document.getElementById('ov-bda-table');
  bdaTbody.innerHTML = '';
  Object.keys(bdeMap).sort().forEach(bd => {
    const tAmt = revAggTokens(bdeMap[bd].tokens);
    const fAmt = revAggFull(bdeMap[bd].full);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="bold">${bd}</td>
      <td class="mono">—</td>
      <td class="mono">${fCurrency(tAmt.amount)}</td>
      <td class="mono">${fCurrency(fAmt.amount)}</td>
    `;
    bdaTbody.appendChild(tr);
  });
  if (bdaTbody.innerHTML === '') emptyRow(bdaTbody, 4);

  // Date-wise Token & Enrollment
  const dateTbody = document.getElementById('ov-date-table');
  dateTbody.innerHTML = '';
  const dateMap = {};
  let d = new Date(activeFilters.dateFrom);
  const end = new Date(activeFilters.dateTo);
  while (d <= end) {
    dateMap[d.toISOString().split('T')[0]] = { tokens: 0, tokenAmt: 0, enrolls: 0, enrollAmt: 0 };
    d.setDate(d.getDate() + 1);
  }

  tokenData.forEach(r => {
    if (dateMap[r.tokenDate]) {
      dateMap[r.tokenDate].tokens++;
      dateMap[r.tokenDate].tokenAmt += TOKEN_REVENUE_RATE;
    }
  });
  fullData.forEach(r => {
    if (dateMap[r.fullPayDate]) {
      dateMap[r.fullPayDate].enrolls++;
      dateMap[r.fullPayDate].enrollAmt += r.amountPaid;
    }
  });

  const sortedDates = Object.keys(dateMap).sort((a, b) => b.localeCompare(a));
  let hasDateData = false;
  sortedDates.forEach(dateStr => {
    const info = dateMap[dateStr];
    if (info.tokens > 0 || info.enrolls > 0) {
      hasDateData = true;
      const dateObj = new Date(dateStr);
      const formattedDate = dateObj.toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
      const tokenDisplay  = info.tokens > 0 ? `${info.tokens} (${fCurrency(info.tokenAmt)})` : '0';
      const enrollDisplay = info.enrolls > 0 ? `${info.enrolls} (${fCurrency(info.enrollAmt)})` : '0';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="bold">${formattedDate}</td>
        <td class="mono">${tokenDisplay}</td>
        <td class="mono">${enrollDisplay}</td>
      `;
      dateTbody.appendChild(tr);
    }
  });
  if (!hasDateData) emptyRow(dateTbody, 3);
}

// ==========================================
// REVENUE VIEW
// ==========================================
// ==========================================
// REVENUE VIEW — powered by Token + Full Payment CSVs
// ==========================================
function mapTokenRow(obj) {
  return {
    gm:          (obj['GM'] || '').trim(),
    type:        (obj['Type'] || '').trim(),
    tl:          (obj['TL Name'] || '').trim(),
    bdMail:      (obj['BD Mail'] || '').trim(),
    tokenDate:   parseSheetDate(obj['Token date']),
    tokenAmount: parseNum(obj['Token Amount']),
    candidate:   obj['Candidate name'] || '',
  };
}

function mapFullPayRow(obj) {
  return {
    gm:          (obj['GM'] || '').trim(),
    type:        (obj['Type'] || '').trim(),
    tl:          (obj['TL Name'] || '').trim(),
    bdMail:      (obj['BD Mail'] || '').trim(),
    fullPayDate: parseSheetDate(obj['Full payment date']),
    amountPaid:  parseNum(obj['Amount Paid']),
    candidate:   obj['Candidate name'] || '',
  };
}

function revMatchesFilters(row, dateField) {
  const dt = row[dateField];
  const inDate    = (!activeFilters.dateFrom || dt >= activeFilters.dateFrom) &&
                    (!activeFilters.dateTo   || dt <= activeFilters.dateTo);
  const inGM      = activeFilters.gm      === 'ALL' || row.gm      === activeFilters.gm;
  const inProgram = activeFilters.program === 'ALL' || row.type    === activeFilters.program;
  const inTL      = activeFilters.tl      === 'ALL' || row.tl      === activeFilters.tl;
  const inBDE     = activeFilters.bde     === 'ALL' || row.bdMail  === activeFilters.bde;
  return inDate && inGM && inProgram && inTL && inBDE;
}

function getRevTokenGlobalData() {
  return revTokenRows.filter(r => revMatchesFilters(r, 'tokenDate'));
}

function getRevFullGlobalData() {
  return revFullRows.filter(r => revMatchesFilters(r, 'fullPayDate'));
}

function getBaseRevTokens() {
  return getRevTokenGlobalData();
}

function getBaseRevFullPayments() {
  return getRevFullGlobalData();
}

function revAggTokens(rows) {
  const count = rows.length;
  return {
    count,
    amount: count * TOKEN_REVENUE_RATE
  };
}

function revAggFull(rows) {
  return {
    count: rows.length,
    amount: rows.reduce((s, r) => s + r.amountPaid, 0)
  };
}

function populateRevGlobalFilters() {
  const gmSel = document.getElementById('filter-gm');
  if (gmSel) {
    const current = activeFilters.gm;
    const gmNames = [...new Set(revTokenRows.map(r => r.gm).filter(Boolean))].sort();
    gmSel.innerHTML = '<option value="ALL">All GMs</option>';
    gmNames.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      gmSel.appendChild(opt);
    });
    activeFilters.gm = gmNames.includes(current) ? current : 'ALL';
    gmSel.value = activeFilters.gm;
  }
  populateRevPrograms();
  populateRevTLs();
  populateRevBDEs(activeFilters.tl);
}

function populateRevPrograms() {
  const sel = document.getElementById('filter-program');
  if (!sel) return;
  let pool = revTokenRows;
  if (activeFilters.gm !== 'ALL') pool = pool.filter(r => r.gm === activeFilters.gm);
  const types = [...new Set(pool.map(r => r.type).filter(Boolean))].sort();
  sel.innerHTML = '<option value="ALL">All Programs</option>';
  types.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    sel.appendChild(opt);
  });
  activeFilters.program = types.includes(activeFilters.program) ? activeFilters.program : 'ALL';
  sel.value = activeFilters.program;
}

function populateRevTLs() {
  const sel = document.getElementById('filter-tl');
  if (!sel) return;
  let pool = revTokenRows;
  if (activeFilters.gm !== 'ALL')      pool = pool.filter(r => r.gm === activeFilters.gm);
  if (activeFilters.program !== 'ALL') pool = pool.filter(r => r.type === activeFilters.program);
  const tls = [...new Set(pool.map(r => r.tl).filter(Boolean))].sort();
  sel.innerHTML = '<option value="ALL">All TLs</option>';
  tls.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    sel.appendChild(opt);
  });
  activeFilters.tl = tls.includes(activeFilters.tl) ? activeFilters.tl : 'ALL';
  sel.value = activeFilters.tl;
}

function populateRevBDEs(tlName) {
  const sel = document.getElementById('filter-bde');
  if (!sel) return;
  let pool = revTokenRows;
  if (activeFilters.gm !== 'ALL')      pool = pool.filter(r => r.gm === activeFilters.gm);
  if (activeFilters.program !== 'ALL') pool = pool.filter(r => r.type === activeFilters.program);
  if (tlName && tlName !== 'ALL')      pool = pool.filter(r => r.tl === tlName);
  const bdes = [...new Set(pool.map(r => r.bdMail).filter(Boolean))].sort();
  sel.innerHTML = '<option value="ALL">All BDEs</option>';
  bdes.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b;
    opt.textContent = b;
    sel.appendChild(opt);
  });
  activeFilters.bde = bdes.includes(activeFilters.bde) ? activeFilters.bde : 'ALL';
  sel.value = activeFilters.bde;
}

async function fetchRevenueCSV() {
  if (revLoading) return;
  revLoading = true;
  setText('rev-total', '…');
  if (activeView === 'overview') setText('ov-revenue', '…');
  try {
    const [tokenResp, fullResp] = await Promise.all([
      fetch(SHEETS_API.revenueToken),
      fetch(SHEETS_API.revenueFull)
    ]);
    if (!tokenResp.ok) throw new Error(`Token CSV HTTP ${tokenResp.status}`);
    if (!fullResp.ok)  throw new Error(`Full Payment CSV HTTP ${fullResp.status}`);

    const tokenRaw = parseCSV(await tokenResp.text());
    const fullRaw  = parseCSV(await fullResp.text());
    revTokenRows = tokenRaw.map(mapTokenRow).filter(r => r.tokenDate);
    revFullRows  = fullRaw.map(mapFullPayRow).filter(r => r.fullPayDate || r.amountPaid > 0);
    revLoaded = true;

    if (activeView === 'revenue' || activeView === 'overview') {
      const dates = revTokenRows.map(r => r.tokenDate).filter(Boolean).sort();
      if (dates.length) {
        activeFilters.dateFrom = dates[0];
        activeFilters.dateTo   = dates[dates.length - 1];
        const dateFromEl = document.getElementById('date-from');
        const dateToEl   = document.getElementById('date-to');
        if (dateFromEl) dateFromEl.value = activeFilters.dateFrom;
        if (dateToEl)   dateToEl.value   = activeFilters.dateTo;
      }
      populateRevGlobalFilters();
      renderActiveView();
    }
  } catch (err) {
    console.error('Revenue CSV load error:', err);
    setText('rev-total', 'Error');
    if (activeView === 'overview') setText('ov-revenue', 'Error');
  } finally {
    revLoading = false;
  }
}

function renderRevenue() {
  if (!revLoaded) {
    fetchRevenueCSV();
    return;
  }

  const tokenData = getBaseRevTokens();
  const fullData  = getBaseRevFullPayments();

  const tokenAgg = revAggTokens(tokenData);
  const fullAgg  = revAggFull(fullData);
  const tokenRev  = tokenAgg.amount;
  const fullRev   = fullAgg.amount;
  const tokenCount = tokenAgg.count;
  const fullCount  = fullAgg.count;
  const totalRev   = tokenRev + fullRev;

  setText('rev-total', fCurrency(totalRev));
  setText('rev-total-sub', 'collected');
  setText('rev-full',  fCurrency(fullRev));
  setText('rev-full-sub', `${fullCount} full payment${fullCount !== 1 ? 's' : ''}`);
  setText('rev-tokens', fCurrency(tokenRev));
  setText('rev-tokens-sub', `${tokenCount} token booking${tokenCount !== 1 ? 's' : ''}`);
  setText('rev-target-pct', '—');
  setText('rev-target-sub', 'No target in sheet');

  // Target (Unit wise) — grouped by Type (Program)
  const targetUnitsContainer = document.getElementById('rev-target-units');
  targetUnitsContainer.innerHTML = '';
  const typeSet = new Set([
    ...tokenData.map(r => r.type).filter(Boolean),
    ...fullData.map(r => r.type).filter(Boolean)
  ]);
  const types = [...typeSet].sort();

  types.forEach((type, idx) => {
    const tRows = tokenData.filter(r => r.type === type);
    const fRows = fullData.filter(r => r.type === type);
    const achieved = revAggTokens(tRows).amount + revAggFull(fRows).amount;
    const accentClass = idx % 3 === 0 ? 'accent-indigo' : idx % 3 === 1 ? 'accent-emerald' : 'accent-purple';
    const card = document.createElement('div');
    card.className = `target-card ${accentClass}`;
    card.innerHTML = `
      <div class="target-card-header">
        <span class="target-card-title">${type}</span>
        <span class="target-card-sub">Token: ${fCurrency(revAggTokens(tRows).amount)} · Full: ${fCurrency(revAggFull(fRows).amount)}</span>
      </div>
      <div class="target-progress-wrap">
        <div class="target-progress-stats">
          <span>Total: ${fCurrency(achieved)}</span>
          <span>${fNum(tRows.length + fRows.length)} bookings</span>
        </div>
      </div>
    `;
    targetUnitsContainer.appendChild(card);
  });
  if (types.length === 0) {
    targetUnitsContainer.innerHTML = '<div class="empty-row" style="grid-column: 1/-1;">No revenue data for selected filters</div>';
  }

  setText('rev-lead-tokens', fCurrency(tokenRev));
  setText('rev-lead-enrollments', fCurrency(fullRev));

  // Input efficiency — use productivity CSV if available
  let totalCalls = 0;
  let talkMins = 0;
  if (prodLoaded) {
    const cData = getBaseProdData();
    totalCalls = cData.reduce((s, r) => s + r.calls, 0);
    talkMins   = cData.reduce((s, r) => s + r.talkTimeMin, 0);
  }
  const activeBdesCount = new Set([
    ...tokenData.map(r => r.bdMail),
    ...fullData.map(r => r.bdMail)
  ].filter(Boolean)).size;
  setText('rev-input-rev-bde',  fCurrency(activeBdesCount ? Math.round(totalRev / activeBdesCount) : 0));
  setText('rev-input-rev-dial',  fCurrency(totalCalls ? Math.round(totalRev / totalCalls) : 0));
  setText('rev-input-rev-talk',  fCurrency(talkMins ? Math.round(totalRev / talkMins) : 0));

  // Top 3 BDAs by total revenue
  const bdaPodiumContainer = document.getElementById('rev-podium-bdas');
  bdaPodiumContainer.innerHTML = '';
  const bdeMap = {};
  tokenData.forEach(r => {
    if (!r.bdMail) return;
    if (!bdeMap[r.bdMail]) bdeMap[r.bdMail] = { tokens: [], full: [], type: r.type };
    bdeMap[r.bdMail].tokens.push(r);
    if (r.type) bdeMap[r.bdMail].type = r.type;
  });
  fullData.forEach(r => {
    if (!r.bdMail) return;
    if (!bdeMap[r.bdMail]) bdeMap[r.bdMail] = { tokens: [], full: [], type: r.type };
    bdeMap[r.bdMail].full.push(r);
  });

  const bdaRankings = Object.keys(bdeMap).map(bd => {
    const tAmt = revAggTokens(bdeMap[bd].tokens).amount;
    const fAmt = revAggFull(bdeMap[bd].full).amount;
    return { bd, revenue: tAmt + fAmt, type: bdeMap[bd].type || '—' };
  }).sort((a, b) => b.revenue - a.revenue);

  const topBDAs = bdaRankings.filter(b => b.revenue > 0).slice(0, 3);
  if (topBDAs.length > 0) {
    topBDAs.forEach((bda, index) => {
      const card = document.createElement('div');
      card.className = `podium-card rank-${index + 1}`;
      card.innerHTML = `
        <div class="podium-card-head">
          <div class="podium-rank-badge">${index + 1}</div>
          <div class="podium-bda-name" title="${bda.bd}">${emailToDisplayName(bda.bd)}</div>
        </div>
        <div class="podium-bda-program">${bda.type}</div>
        <div class="podium-bda-rev">${fCurrency(bda.revenue)}</div>
      `;
      bdaPodiumContainer.appendChild(card);
    });
  } else {
    bdaPodiumContainer.innerHTML = '<div class="empty-row" style="width: 100%">No revenue data for BDAs in this period</div>';
  }

  // GM Performance
  const gmTbody = document.getElementById('rev-gm-table');
  gmTbody.innerHTML = '';
  const gmNames = activeFilters.gm === 'ALL'
    ? [...new Set([...tokenData, ...fullData].map(r => r.gm).filter(Boolean))].sort()
    : [activeFilters.gm];

  gmNames.forEach(gmName => {
    const gmTokens = revAggTokens(tokenData.filter(r => r.gm === gmName));
    const gmFull   = revAggFull(fullData.filter(r => r.gm === gmName));
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="bold">${gmName}</td>
      <td class="mono">—</td>
      <td class="mono">${fCurrency(gmTokens.amount)}</td>
      <td class="mono">${fCurrency(gmFull.amount)}</td>
    `;
    gmTbody.appendChild(tr);
  });
  if (gmTbody.innerHTML === '') emptyRow(gmTbody, 4);

  // TL Performance
  const tlTbody = document.getElementById('rev-tl-perf-table');
  tlTbody.innerHTML = '';
  const tlNames = [...new Set([...tokenData, ...fullData].map(r => r.tl).filter(Boolean))].sort();
  tlNames.forEach(tlName => {
    const tlTokens = revAggTokens(tokenData.filter(r => r.tl === tlName));
    const tlFull   = revAggFull(fullData.filter(r => r.tl === tlName));
    if (tlTokens.count === 0 && tlFull.count === 0) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="bold">${tlName}</td>
      <td class="mono">—</td>
      <td class="mono">${fCurrency(tlTokens.amount)}</td>
      <td class="mono">${fCurrency(tlFull.amount)}</td>
    `;
    tlTbody.appendChild(tr);
  });
  if (tlTbody.innerHTML === '') emptyRow(tlTbody, 4);

  // BDA Performance
  const bdaTbody = document.getElementById('rev-bda-table');
  bdaTbody.innerHTML = '';
  Object.keys(bdeMap).sort().forEach(bd => {
    const tAmt = revAggTokens(bdeMap[bd].tokens);
    const fAmt = revAggFull(bdeMap[bd].full);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="bold">${bd}</td>
      <td class="mono">—</td>
      <td class="mono">${fCurrency(tAmt.amount)}</td>
      <td class="mono">${fCurrency(fAmt.amount)}</td>
    `;
    bdaTbody.appendChild(tr);
  });
  if (bdaTbody.innerHTML === '') emptyRow(bdaTbody, 4);

  // Date-wise Token & Enrollment
  const dateTbody = document.getElementById('rev-date-table');
  dateTbody.innerHTML = '';
  const dateMap = {};
  let d = new Date(activeFilters.dateFrom);
  const end = new Date(activeFilters.dateTo);
  while (d <= end) {
    dateMap[d.toISOString().split('T')[0]] = { tokens: 0, tokenAmt: 0, enrolls: 0, enrollAmt: 0 };
    d.setDate(d.getDate() + 1);
  }

  tokenData.forEach(r => {
    if (dateMap[r.tokenDate]) {
      dateMap[r.tokenDate].tokens++;
      dateMap[r.tokenDate].tokenAmt += TOKEN_REVENUE_RATE;
    }
  });
  fullData.forEach(r => {
    if (dateMap[r.fullPayDate]) {
      dateMap[r.fullPayDate].enrolls++;
      dateMap[r.fullPayDate].enrollAmt += r.amountPaid;
    }
  });

  const sortedDates = Object.keys(dateMap).sort((a, b) => b.localeCompare(a));
  let hasDateData = false;
  sortedDates.forEach(dateStr => {
    const info = dateMap[dateStr];
    if (info.tokens > 0 || info.enrolls > 0) {
      hasDateData = true;
      const formattedDate = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
      const tokenDisplay  = info.tokens  > 0 ? `${info.tokens} (${fCurrency(info.tokenAmt)})`  : '0';
      const enrollDisplay = info.enrolls > 0 ? `${info.enrolls} (${fCurrency(info.enrollAmt)})` : '0';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="bold">${formattedDate}</td>
        <td class="mono">${tokenDisplay}</td>
        <td class="mono">${enrollDisplay}</td>
      `;
      dateTbody.appendChild(tr);
    }
  });
  if (!hasDateData) emptyRow(dateTbody, 3);
}

// ==========================================
// PRODUCTIVITY VIEW — powered by live CSV
// ==========================================
function mapProdRow(obj) {
  return {
    owner:     obj['Owner Name'] || '',
    date:      (obj['Date'] || '').substring(0, 10),
    calls:       parseNum(obj['# Calls']),
    connected:   parseNum(obj['# Calls Connected']),
    uniqueLeads: parseNum(obj['# Unique Leads']),
    talkTimeMin: parseNum(obj['Total Call Duration']),
    manager:   (obj['Manager Name'] || '').trim(),
    gm:        (obj['GM Name'] || '').trim(),
  };
}

function getProdOwnersForProgram() {
  if (activeFilters.program === 'ALL' || !laLoaded) return null;
  const owners = new Set(
    laAllRows
      .filter(r => {
        const inGM = activeFilters.gm === 'ALL' || r.gm === activeFilters.gm;
        return inGM && r.program === activeFilters.program;
      })
      .map(r => r.owner)
      .filter(Boolean)
  );
  return owners;
}

function getProdGlobalData() {
  return prodAllRows.filter(r => {
    const inDate = (!activeFilters.dateFrom || r.date >= activeFilters.dateFrom) &&
                   (!activeFilters.dateTo   || r.date <= activeFilters.dateTo);
    const inGM   = activeFilters.gm === 'ALL' || r.gm === activeFilters.gm;
    return inDate && inGM && r.owner;
  });
}

function getBaseProdData() {
  let pool = getProdGlobalData();
  const programOwners = getProdOwnersForProgram();
  if (programOwners) pool = pool.filter(r => programOwners.has(r.owner));
  if (activeFilters.tl !== 'ALL')  pool = pool.filter(r => r.manager === activeFilters.tl);
  if (activeFilters.bde !== 'ALL') pool = pool.filter(r => r.owner === activeFilters.bde);
  return pool;
}

function populateProdGlobalFilters() {
  const gmSel = document.getElementById('filter-gm');
  if (gmSel) {
    const current = activeFilters.gm;
    const gmNames = [...new Set(prodAllRows.map(r => r.gm).filter(Boolean))].sort();
    gmSel.innerHTML = '<option value="ALL">All GMs</option>';
    gmNames.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      gmSel.appendChild(opt);
    });
    activeFilters.gm = gmNames.includes(current) ? current : 'ALL';
    gmSel.value = activeFilters.gm;
  }
  populateProdPrograms();
  populateProdTLs();
  populateProdBDEs(activeFilters.tl);
}

function populateProdPrograms() {
  const sel = document.getElementById('filter-program');
  if (!sel) return;
  sel.innerHTML = '<option value="ALL">All Programs</option>';
  if (!laLoaded) {
    sel.value = 'ALL';
    activeFilters.program = 'ALL';
    return;
  }
  let pool = laAllRows;
  if (activeFilters.gm !== 'ALL') pool = pool.filter(r => r.gm === activeFilters.gm);
  const programs = [...new Set(pool.map(r => r.program).filter(Boolean))].sort();
  programs.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    sel.appendChild(opt);
  });
  activeFilters.program = programs.includes(activeFilters.program) ? activeFilters.program : 'ALL';
  sel.value = activeFilters.program;
}

function populateProdTLs() {
  const sel = document.getElementById('filter-tl');
  if (!sel) return;
  let pool = getProdGlobalData();
  const programOwners = getProdOwnersForProgram();
  if (programOwners) pool = pool.filter(r => programOwners.has(r.owner));
  const tls = [...new Set(pool.map(r => r.manager).filter(Boolean))].sort();
  sel.innerHTML = '<option value="ALL">All TLs</option>';
  tls.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    sel.appendChild(opt);
  });
  activeFilters.tl = tls.includes(activeFilters.tl) ? activeFilters.tl : 'ALL';
  sel.value = activeFilters.tl;
}

function populateProdBDEs(tlName) {
  const sel = document.getElementById('filter-bde');
  if (!sel) return;
  let pool = getProdGlobalData();
  const programOwners = getProdOwnersForProgram();
  if (programOwners) pool = pool.filter(r => programOwners.has(r.owner));
  if (tlName && tlName !== 'ALL') pool = pool.filter(r => r.manager === tlName);
  const bdes = [...new Set(pool.map(r => r.owner).filter(Boolean))].sort();
  sel.innerHTML = '<option value="ALL">All BDEs</option>';
  bdes.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b;
    opt.textContent = b;
    sel.appendChild(opt);
  });
  activeFilters.bde = bdes.includes(activeFilters.bde) ? activeFilters.bde : 'ALL';
  sel.value = activeFilters.bde;
}

async function fetchProductivityCSV() {
  if (prodLoading) return;
  prodLoading = true;
  setText('prod-calls', '…');
  try {
    const resp = await fetch(SHEETS_API.productivity);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    const raw = parseCSV(text);
    prodAllRows = raw.map(mapProdRow).filter(r => r.owner && r.date);
    prodLoaded = true;

    if (activeView === 'productivity') {
      const dates = prodAllRows.map(r => r.date).filter(Boolean).sort();
      if (dates.length) {
        activeFilters.dateFrom = dates[0];
        activeFilters.dateTo   = dates[dates.length - 1];
        const dateFromEl = document.getElementById('date-from');
        const dateToEl   = document.getElementById('date-to');
        if (dateFromEl) dateFromEl.value = activeFilters.dateFrom;
        if (dateToEl)   dateToEl.value   = activeFilters.dateTo;
      }
      populateProdGlobalFilters();
      renderActiveView();
    } else if (activeView === 'overview') {
      renderActiveView();
    } else {
      renderSidebarTeam();
    }

    if (!laLoaded && !laLoading) fetchLeadCSV();
  } catch (err) {
    console.error('Productivity CSV load error:', err);
    setText('prod-calls', 'Error');
  } finally {
    prodLoading = false;
  }
}

function prodAggregate(rows) {
  const calls = rows.reduce((s, r) => s + r.calls, 0);
  const connects = rows.reduce((s, r) => s + r.connected, 0);
  const uniqueDialled = rows.reduce((s, r) => s + r.uniqueLeads, 0);
  const talk = rows.reduce((s, r) => s + r.talkTimeMin, 0);
  const activeBdes = new Set(rows.map(r => r.owner).filter(Boolean)).size;
  return { calls, connects, uniqueDialled, talk, activeBdes };
}

function prodCPL(totalCalls, uniqueDialled) {
  return uniqueDialled ? (totalCalls / uniqueDialled).toFixed(2) : '—';
}

function formatAvgTalk(sec) {
  if (sec >= 60) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${sec}s`;
}

function formatTalkHrs(minutes) {
  return `${(minutes / 60).toFixed(1)}h`;
}

function renderProductivity() {
  if (!prodLoaded) {
    fetchProductivityCSV();
    return;
  }

  const cData = getBaseProdData();
  const { calls: totalCalls, connects: connected, talk: talkMins, activeBdes: activeBDEs } = prodAggregate(cData);

  const connectRate = totalCalls ? ((connected / totalCalls) * 100).toFixed(1) : 0;
  const talkHrs     = (talkMins / 60).toFixed(1);
  const avgTalkSec  = connected ? Math.round((talkMins * 60) / connected) : 0;

  const allOwnersInScope = new Set(getProdGlobalData().map(r => r.owner));
  const programOwners = getProdOwnersForProgram();
  const totalBDEs = programOwners
    ? [...programOwners].filter(o => allOwnersInScope.has(o)).length
    : allOwnersInScope.size;

  setText('prod-calls',       fNum(totalCalls));
  setText('prod-calls-sub',   `${fNum(connected)} connected`);
  setText('prod-connect',     `${connectRate}%`);
  setText('prod-connect-sub', `${fNum(connected)} connected calls`);
  setText('prod-talk',        `${talkHrs}h`);
  setText('prod-talk-sub',    `Avg ${avgTalkSec}s per connect`);
  setText('prod-active',      `${activeBDEs}/${totalBDEs || activeBDEs}`);
  setText('prod-active-sub',  `active in period`);

  const dateFrom  = new Date(activeFilters.dateFrom);
  const dateTo    = new Date(activeFilters.dateTo);
  const daysCount = Math.max(1, Math.round((dateTo - dateFrom) / (1000 * 60 * 60 * 24)) + 1);

  // Top 3 BDAs by Total Talk Time (TT)
  const bdaPodiumContainer = document.getElementById('prod-podium-bdas');
  bdaPodiumContainer.innerHTML = '';

  const bdeMap = {};
  cData.forEach(r => {
    if (!bdeMap[r.owner]) bdeMap[r.owner] = [];
    bdeMap[r.owner].push(r);
  });

  const bdaRankings = Object.keys(bdeMap).map(owner => {
    const agg = prodAggregate(bdeMap[owner]);
    const manager = bdeMap[owner][0]?.manager || '—';
    return { name: owner, manager, talkTime: agg.talk, ...agg };
  }).sort((a, b) => b.talkTime - a.talkTime);

  const topBDAs = bdaRankings.filter(b => b.talkTime > 0).slice(0, 3);

  if (topBDAs.length > 0) {
    topBDAs.forEach((bda, index) => {
      const rank = index + 1;
      const card = document.createElement('div');
      card.className = `podium-card rank-${rank}`;
      card.innerHTML = `
        <div class="podium-card-head">
          <div class="podium-rank-badge">${rank}</div>
          <div class="podium-bda-name" title="${bda.name}">${bda.name}</div>
        </div>
        <div class="podium-bda-program">TL ${bda.manager}</div>
        <div class="podium-bda-rev" style="color: var(--purple);">${formatTalkHrs(bda.talkTime)}</div>
      `;
      bdaPodiumContainer.appendChild(card);
    });
  } else {
    bdaPodiumContainer.innerHTML = '<div class="empty-row" style="width: 100%">No talk time data for BDAs in this period</div>';
  }

  // GM Performance ← GM Name
  const gmTbody = document.getElementById('prod-gm-table');
  gmTbody.innerHTML = '';
  const gmNames = activeFilters.gm === 'ALL'
    ? [...new Set(cData.map(r => r.gm).filter(Boolean))].sort()
    : [activeFilters.gm];

  gmNames.forEach(gmName => {
    const gmRows = cData.filter(r => r.gm === gmName);
    if (gmRows.length === 0) return;
    const { calls: gmDials, connects: gmConnects, uniqueDialled: gmUnique, talk: gmTalk, activeBdes: gmActiveBdes } = prodAggregate(gmRows);
    const denom = Math.max(1, gmActiveBdes * daysCount);
    const gmAvgCall = (gmDials / denom).toFixed(1);
    const gmAvgCC   = (gmConnects / denom).toFixed(1);
    const gmAvgSec  = gmConnects ? Math.round((gmTalk * 60) / gmConnects) : 0;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="bold">${gmName}</td>
      <td class="mono">${fNum(gmDials)}</td>
      <td class="mono">${fNum(gmConnects)}</td>
      <td class="mono">${fNum(gmUnique)}</td>
      <td class="mono">${prodCPL(gmDials, gmUnique)}</td>
      <td class="mono">${formatTalkHrs(gmTalk)}</td>
      <td class="mono">${gmAvgCall}</td>
      <td class="mono">${gmAvgCC}</td>
      <td class="mono">${formatAvgTalk(gmAvgSec)}</td>
    `;
    gmTbody.appendChild(tr);
  });
  if (gmTbody.innerHTML === '') emptyRow(gmTbody, 9);

  // TL Performance ← Manager Name
  const tlTbody = document.getElementById('prod-tl-perf-table');
  tlTbody.innerHTML = '';
  const tlMap = {};
  cData.forEach(r => {
    if (!r.manager) return;
    if (!tlMap[r.manager]) tlMap[r.manager] = [];
    tlMap[r.manager].push(r);
  });

  Object.keys(tlMap).sort().forEach(tlName => {
    const tlRows = tlMap[tlName];
    const { calls: tlDials, connects: tlConnects, uniqueDialled: tlUnique, talk: tlTalk, activeBdes: tlActiveBdes } = prodAggregate(tlRows);
    const denom = Math.max(1, tlActiveBdes * daysCount);
    const tlAvgCall = (tlDials / denom).toFixed(1);
    const tlAvgCC   = (tlConnects / denom).toFixed(1);
    const tlAvgSec  = tlConnects ? Math.round((tlTalk * 60) / tlConnects) : 0;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="bold">${tlName}</td>
      <td class="mono">${fNum(tlDials)}</td>
      <td class="mono">${fNum(tlConnects)}</td>
      <td class="mono">${fNum(tlUnique)}</td>
      <td class="mono">${prodCPL(tlDials, tlUnique)}</td>
      <td class="mono">${formatTalkHrs(tlTalk)}</td>
      <td class="mono">${tlAvgCall}</td>
      <td class="mono">${tlAvgCC}</td>
      <td class="mono">${formatAvgTalk(tlAvgSec)}</td>
    `;
    tlTbody.appendChild(tr);
  });
  if (tlTbody.innerHTML === '') emptyRow(tlTbody, 9);

  // BDA Performance ← Owner Name
  const bdaTbody = document.getElementById('prod-bda-perf-table');
  bdaTbody.innerHTML = '';

  Object.keys(bdeMap).sort().forEach(owner => {
    const bdeRows = bdeMap[owner];
    const { calls: dials, connects, uniqueDialled, talk } = prodAggregate(bdeRows);
    const bdeAvgCall = (dials / daysCount).toFixed(1);
    const bdeAvgCC   = (connects / daysCount).toFixed(1);
    const bdeAvgSec  = connects ? Math.round((talk * 60) / connects) : 0;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="bold">${owner}</td>
      <td class="mono">${fNum(dials)}</td>
      <td class="mono">${fNum(connects)}</td>
      <td class="mono">${fNum(uniqueDialled)}</td>
      <td class="mono">${prodCPL(dials, uniqueDialled)}</td>
      <td class="mono">${formatTalkHrs(talk)}</td>
      <td class="mono">${bdeAvgCall}</td>
      <td class="mono">${bdeAvgCC}</td>
      <td class="mono">${formatAvgTalk(bdeAvgSec)}</td>
    `;
    bdaTbody.appendChild(tr);
  });
  if (bdaTbody.innerHTML === '') emptyRow(bdaTbody, 9);
}

// ==========================================
// LEAD REPORT VIEW
// ==========================================
// --- Lead Report helpers (CSV Final Stage / Enrollment Date) ---
function lrCountInterested(rows) {
  return rows.filter(r => /^Interested/i.test(r.finalStage || '')).length;
}
function lrCountFollowUp(rows) {
  return rows.filter(r => {
    const fs = r.finalStage || '';
    return fs === 'Follow_Up' || fs === 'Call_Back_Later';
  }).length;
}
function lrCountEnrolled(rows) {
  return rows.filter(r => isNonBlank(r.enrollmentDate)).length;
}
function lrCountNotConnected(rows) {
  return rows.filter(r => (r.finalStage || '') === 'Not_Connected').length;
}
function lrCountInvalid(rows) {
  return rows.filter(r => (r.finalStage || '') === 'Invalid').length;
}
function lrConvPct(enrolled, total) {
  return total ? ((enrolled / total) * 100).toFixed(2) : '0.00';
}

// Program with the highest lead count for this TL (within current filters)
function lrDominantProgram(rows) {
  const progMap = {};
  rows.forEach(r => {
    const p = (r.program || '').trim() || '(blank)';
    progMap[p] = (progMap[p] || 0) + 1;
  });
  let top = '', max = 0;
  for (const [p, c] of Object.entries(progMap)) {
    if (c > max) { max = c; top = p; }
  }
  return top === '(blank)' ? '—' : top;
}

function renderLeads() {
  if (!laLoaded) {
    fetchLeadCSV();
    return;
  }

  const lData = getBaseLAData();

  const total      = lData.length;
  const interested = lrCountInterested(lData);
  const followup   = lrCountFollowUp(lData);
  const enrolled   = lrCountEnrolled(lData);
  const convRate   = lrConvPct(enrolled, total);

  setText('lead-total',          fNum(total));
  setText('lead-interested',     fNum(interested));
  setText('lead-interested-sub', `${total ? ((interested / total) * 100).toFixed(0) : 0}% of total`);
  setText('lead-followup',       fNum(followup));
  setText('lead-enrolled',       fNum(enrolled));
  setText('lead-enrolled-sub',   `${convRate}% conversion`);

  destroyChart('leadStage');
  destroyChart('leadSource');

  // Lead Stage Funnel ← each unique Final Stage value from sheet
  const funnelContainer = document.getElementById('lead-stage-funnel');
  funnelContainer.innerHTML = '';

  const stageMap = {};
  lData.forEach(r => {
    const stage = (r.finalStage || '').trim() || '(blank)';
    stageMap[stage] = (stageMap[stage] || 0) + 1;
  });

  const funnelColors = {
    'Full_Payment_Done': 'var(--emerald)',
    'Token_Paid': 'var(--emerald)',
    'Interested': 'var(--indigo)',
    'Interested-Test': 'var(--indigo)',
    'Interested-Interview': 'var(--indigo)',
    'Follow_Up': 'var(--amber)',
    'Call_Back_Later': 'var(--amber)',
    'Fresh_Lead': 'var(--cyan)',
    'Not_Connected': 'var(--text-muted)',
    'Invalid': 'var(--danger)',
    'Not_Interested': 'var(--danger)'
  };
  const defaultFunnelColor = 'var(--purple)';

  const funnelStages = Object.keys(stageMap)
    .map(name => ({ name, count: stageMap[name] }))
    .sort((a, b) => b.count - a.count);

  funnelStages.forEach(s => {
    const pct = total ? ((s.count / total) * 100) : 0;
    const label = s.name.replace(/_/g, ' ');
    const color = funnelColors[s.name] || defaultFunnelColor;
    const row = document.createElement('div');
    row.className = 'funnel-stage-row';
    row.style = 'display: flex; flex-direction: column; gap: 4px;';
    row.innerHTML = `
      <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600;">
        <span style="color: var(--text);">${label}: ${fNum(s.count)}</span>
        <span style="color: var(--text-secondary);">${pct.toFixed(1)}%</span>
      </div>
      <div style="height: 6px; background: var(--border); border-radius: 3px; overflow: hidden;">
        <div style="height: 100%; width: ${pct}%; background: ${color}; border-radius: 3px;"></div>
      </div>
    `;
    funnelContainer.appendChild(row);
  });

  if (funnelStages.length === 0) {
    funnelContainer.innerHTML = '<div class="empty-row">No final stage data available</div>';
  }

  // Sub Source Mix ← Sub Source column
  const sourcesContainer = document.getElementById('lead-sources-list');
  sourcesContainer.innerHTML = '';

  const srcMap = {};
  lData.forEach(r => {
    const src = (r.subSource || '').trim() || '(blank)';
    srcMap[src] = (srcMap[src] || 0) + 1;
  });

  const sortedSources = Object.keys(srcMap).map(src => ({
    name: src,
    count: srcMap[src]
  })).sort((a, b) => b.count - a.count);

  const colors = ['var(--indigo)', 'var(--emerald)', 'var(--purple)', 'var(--amber)', 'var(--cyan)'];

  sortedSources.forEach((src, idx) => {
    const pct = total ? ((src.count / total) * 100) : 0;
    const color = colors[idx % colors.length];
    const row = document.createElement('div');
    row.className = 'source-mix-row';
    row.style = 'display: flex; flex-direction: column; gap: 4px;';
    row.innerHTML = `
      <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600;">
        <span style="color: var(--text);">${src.name}: ${fNum(src.count)}</span>
        <span style="color: var(--text-secondary);">${pct.toFixed(1)}%</span>
      </div>
      <div style="height: 6px; background: var(--border); border-radius: 3px; overflow: hidden;">
        <div style="height: 100%; width: ${pct}%; background: ${color}; border-radius: 3px;"></div>
      </div>
    `;
    sourcesContainer.appendChild(row);
  });

  if (sortedSources.length === 0) {
    sourcesContainer.innerHTML = '<div class="empty-row">No sub source data available</div>';
  }

  // GM-wise table ← GM NAME column
  const gmTbody = document.getElementById('lead-gm-table');
  gmTbody.innerHTML = '';
  const gmNames = activeFilters.gm === 'ALL'
    ? [...new Set(lData.map(r => r.gm).filter(Boolean))].sort()
    : [activeFilters.gm];

  gmNames.forEach(gmName => {
    const gmLeads = lData.filter(r => r.gm === gmName);
    if (gmLeads.length === 0) return;
    const gmTotal = gmLeads.length;
    const gmInt   = lrCountInterested(gmLeads);
    const gmFU    = lrCountFollowUp(gmLeads);
    const gmEnr   = lrCountEnrolled(gmLeads);
    const gmConv  = lrConvPct(gmEnr, gmTotal);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="bold">${gmName}</td>
      <td class="mono">${fNum(gmTotal)}</td>
      <td class="mono">${fNum(gmInt)}</td>
      <td class="mono">${fNum(gmFU)}</td>
      <td class="mono">${fNum(gmEnr)}</td>
      <td>${rateBadge(parseFloat(gmConv))}</td>
    `;
    gmTbody.appendChild(tr);
  });
  if (gmTbody.innerHTML === '') emptyRow(gmTbody, 6);

  // TL-wise table ← TL Name + Program
  const tlTbody = document.getElementById('lead-tl-table');
  tlTbody.innerHTML = '';

  const tlMap = {};
  lData.forEach(r => {
    if (!r.tl) return;
    const key = r.tl;
    if (!tlMap[key]) tlMap[key] = [];
    tlMap[key].push(r);
  });

  Object.keys(tlMap).sort().forEach(tlName => {
    const tlLeads = tlMap[tlName];
    const program = lrDominantProgram(tlLeads);
    const tlTotal = tlLeads.length;
    const tlInt   = lrCountInterested(tlLeads);
    const tlFU    = lrCountFollowUp(tlLeads);
    const tlEnr   = lrCountEnrolled(tlLeads);
    const tlConv  = lrConvPct(tlEnr, tlTotal);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="bold">${tlName}</td>
      <td>${program || '—'}</td>
      <td class="mono">${fNum(tlTotal)}</td>
      <td class="mono">${fNum(tlInt)}</td>
      <td class="mono">${fNum(tlFU)}</td>
      <td class="mono">${fNum(tlEnr)}</td>
      <td>${rateBadge(parseFloat(tlConv))}</td>
    `;
    tlTbody.appendChild(tr);
  });
  if (tlTbody.innerHTML === '') emptyRow(tlTbody, 7);

  // BDE-wise table ← Owner (User Email) + TL Name
  const tbody = document.getElementById('lead-bde-table');
  tbody.innerHTML = '';

  const bdeMap = {};
  lData.forEach(r => {
    if (!r.owner) return;
    const key = r.owner + '||' + (r.tl || '');
    if (!bdeMap[key]) bdeMap[key] = { owner: r.owner, tl: r.tl, rows: [] };
    bdeMap[key].rows.push(r);
  });

  Object.values(bdeMap)
    .sort((a, b) => a.owner.localeCompare(b.owner))
    .forEach(({ owner, tl, rows: bdeLeads }) => {
      const bTotal = bdeLeads.length;
      const bInt   = lrCountInterested(bdeLeads);
      const bFU    = lrCountFollowUp(bdeLeads);
      const bEnr   = lrCountEnrolled(bdeLeads);
      const bConv  = lrConvPct(bEnr, bTotal);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="bold">${owner}</td>
        <td>${tl || '—'}</td>
        <td class="mono">${fNum(bTotal)}</td>
        <td class="mono">${fNum(bInt)}</td>
        <td class="mono">${fNum(bFU)}</td>
        <td class="mono">${fNum(bEnr)}</td>
        <td>${rateBadge(parseFloat(bConv))}</td>
      `;
      tbody.appendChild(tr);
    });

  if (tbody.innerHTML === '') emptyRow(tbody, 7);
}

// ==========================================
// LEAD ANALYSIS VIEW — powered by live CSV
// ==========================================

// --- CSV parsing helpers ---
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCSV(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const vals = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h.trim()] = (vals[idx] !== undefined ? vals[idx] : '').trim();
    });
    rows.push(obj);
  }
  return rows;
}

function mapCSVRow(obj) {
  return {
    email:          obj['Email Address'] || '',
    source:         obj['Lead Source'] || '',
    subSource:      obj['Sub Source'] || '',
    createdOn:      (obj['Created On'] || '').substring(0, 10),
    program:        obj['Program'] || '',
    owner:          obj['Owner (User Email)'] || '',
    status:         obj['Status'] || '',
    stage:          obj['Stage'] || '',
    campaign:       obj['Campaign'] || '',
    tl:             (obj['TL Name '] || obj['TL Name'] || '').trim(),
    gm:             (obj['GM NAME'] || '').trim(),
    finalStage:     obj['Final Stage'] || '',
    tokenDate:      obj['Token Date'] || '',
    enrollmentDate: obj['Enrollment Date'] || '',
  };
}

async function fetchLeadCSV() {
  if (laLoading) return;
  laLoading = true;
  setText('la-kpi-leads', '…');
  setText('la-kpi-tokens', '…');
  setText('la-kpi-enrolled', '…');
  setText('la-kpi-cvr', '…');
  setText('lead-total', '…');
  try {
    const config = await loadSheetConfig();
    const resp = await fetch(config.leads);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    const raw = parseCSV(text);
    laAllRows = raw.map(mapCSVRow).filter(r => r.email || r.createdOn);
    laLoaded  = true;

    if (CSV_LEAD_VIEWS.includes(activeView)) {
      const dates = laAllRows.map(r => r.createdOn).filter(Boolean).sort();
      if (dates.length) {
        activeFilters.dateFrom = dates[0];
        activeFilters.dateTo   = dates[dates.length - 1];
        const dateFromEl = document.getElementById('date-from');
        const dateToEl   = document.getElementById('date-to');
        if (dateFromEl) dateFromEl.value = activeFilters.dateFrom;
        if (dateToEl)   dateToEl.value   = activeFilters.dateTo;
      }
      populateLAGlobalFilters();
    }
    if (viewUsesLeadCSV()) {
      renderActiveView();
    }
    renderSidebarTeam();
  } catch (err) {
    console.error('CSV load error:', err);
    setText('la-kpi-leads', 'Error');
    setText('la-kpi-tokens', '—');
    setText('la-kpi-enrolled', '—');
    setText('la-kpi-cvr', '—');
    setText('lead-total', 'Error');
  } finally {
    laLoading = false;
  }
}

// --- Global top-bar filter population from CSV ---
function populateLAGlobalFilters() {
  const gmSel = document.getElementById('filter-gm');
  if (gmSel) {
    const current  = activeFilters.gm;
    const gmNames  = [...new Set(laAllRows.map(r => r.gm).filter(Boolean))].sort();
    gmSel.innerHTML = '<option value="ALL">All GMs</option>';
    gmNames.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      gmSel.appendChild(opt);
    });
    activeFilters.gm = gmNames.includes(current) ? current : 'ALL';
    gmSel.value = activeFilters.gm;
  }
  populateLAPrograms();
  populateLATLs();
  populateLABDEs(activeFilters.tl);
}

function populateLAPrograms() {
  const sel = document.getElementById('filter-program');
  if (!sel) return;
  let pool = laAllRows;
  if (activeFilters.gm !== 'ALL') pool = pool.filter(r => r.gm === activeFilters.gm);
  const programs = [...new Set(pool.map(r => r.program).filter(Boolean))].sort();
  sel.innerHTML = '<option value="ALL">All Programs</option>';
  programs.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    sel.appendChild(opt);
  });
  activeFilters.program = programs.includes(activeFilters.program) ? activeFilters.program : 'ALL';
  sel.value = activeFilters.program;
}

function populateLATLs() {
  const sel = document.getElementById('filter-tl');
  if (!sel) return;
  let pool = laAllRows;
  if (activeFilters.gm !== 'ALL')      pool = pool.filter(r => r.gm === activeFilters.gm);
  if (activeFilters.program !== 'ALL') pool = pool.filter(r => r.program === activeFilters.program);
  const tls = [...new Set(pool.map(r => r.tl).filter(Boolean))].sort();
  sel.innerHTML = '<option value="ALL">All TLs</option>';
  tls.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    sel.appendChild(opt);
  });
  activeFilters.tl = tls.includes(activeFilters.tl) ? activeFilters.tl : 'ALL';
  sel.value = activeFilters.tl;
}

function populateLABDEs(tlName) {
  const sel = document.getElementById('filter-bde');
  if (!sel) return;
  let pool = laAllRows;
  if (activeFilters.gm !== 'ALL')      pool = pool.filter(r => r.gm === activeFilters.gm);
  if (activeFilters.program !== 'ALL') pool = pool.filter(r => r.program === activeFilters.program);
  if (tlName && tlName !== 'ALL')      pool = pool.filter(r => r.tl === tlName);
  const bdes = [...new Set(pool.map(r => r.owner).filter(Boolean))].sort();
  sel.innerHTML = '<option value="ALL">All BDEs</option>';
  bdes.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b;
    opt.textContent = b;
    sel.appendChild(opt);
  });
  activeFilters.bde = bdes.includes(activeFilters.bde) ? activeFilters.bde : 'ALL';
  sel.value = activeFilters.bde;
}

// Global filters: GM, Program, Date (used for T1 dropdown options)
function getLAGlobalData() {
  return laAllRows.filter(r => {
    const inDate    = (!activeFilters.dateFrom || r.createdOn >= activeFilters.dateFrom) &&
                      (!activeFilters.dateTo   || r.createdOn <= activeFilters.dateTo);
    const inGM      = activeFilters.gm      === 'ALL' || r.gm      === activeFilters.gm;
    const inProgram = activeFilters.program === 'ALL' || r.program === activeFilters.program;
    return inDate && inGM && inProgram;
  });
}

// --- Base data filtered by all global filters ---
function getBaseLAData() {
  return getLAGlobalData().filter(r => {
    const inTL  = activeFilters.tl  === 'ALL' || r.tl    === activeFilters.tl;
    const inBDE = activeFilters.bde === 'ALL' || r.owner === activeFilters.bde;
    return inTL && inBDE;
  });
}

// --- Main render ---
function renderLeadAnalysis() {
  if (!laLoaded) {
    fetchLeadCSV();
    return;
  }

  const base = getBaseLAData();

  // T1 dropdowns: TL Name + Owner (User Email) from GM/Program/Date filtered pool
  populateT1Dropdowns();
  populateTableTLAndBDE('t2-filter-tl', 't2-filter-bde', base);
  populateTableTLAndBDE('t3-filter-tl', 't3-filter-bde', base);
  populateTableSourceDropdown('t2-filter-source', base, 'subSource');
  populateTableSourceDropdown('t3-filter-source', base, 'source');
  populateTableCampaignDropdown('t3-filter-campaign', base);

  // KPI strip
  const totalLeads    = base.length;
  const totalTokens   = base.filter(r => isNonBlank(r.tokenDate)).length;
  const totalEnrolled = base.filter(r => isNonBlank(r.enrollmentDate)).length;
  setText('la-kpi-leads',    fNum(totalLeads));
  setText('la-kpi-tokens',   fNum(totalTokens));
  setText('la-kpi-enrolled', fNum(totalEnrolled));
  setText('la-kpi-cvr',      totalLeads ? ((totalEnrolled / totalLeads) * 100).toFixed(2) + '%' : '0.00%');

  renderTable1();
  renderTable2();
  renderTable3();
}

// --- Table-level dropdown helpers (use live base pool) ---
function populateTableTLAndBDE(tlSelId, bdeSelId, basePool) {
  const tlSel  = document.getElementById(tlSelId);
  const bdeSel = document.getElementById(bdeSelId);
  if (!tlSel || !bdeSel) return;

  const selectedTL = tlSel.value || 'ALL';
  const tls = [...new Set(basePool.map(r => r.tl).filter(Boolean))].sort();
  tlSel.innerHTML = '<option value="ALL">All TLs</option>';
  tls.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    tlSel.appendChild(opt);
  });
  tlSel.value = tls.includes(selectedTL) ? selectedTL : 'ALL';

  const currentTL = tlSel.value;
  const bdePool = currentTL === 'ALL' ? basePool : basePool.filter(r => r.tl === currentTL);
  const bdes = [...new Set(bdePool.map(r => r.owner).filter(Boolean))].sort();
  const selectedBDE = bdeSel.value || 'ALL';
  bdeSel.innerHTML = '<option value="ALL">All BDEs</option>';
  bdes.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    bdeSel.appendChild(opt);
  });
  bdeSel.value = bdes.includes(selectedBDE) ? selectedBDE : 'ALL';
}

function populateTableSourceDropdown(selId, basePool, field = 'source') {
  const sel = document.getElementById(selId);
  if (!sel) return;
  const selected = sel.value || 'ALL';
  const sources = [...new Set(basePool.map(r => r[field]).filter(Boolean))].sort();
  const allLabel = field === 'subSource' ? 'All Sub Sources' : 'All Sources';
  sel.innerHTML = `<option value="ALL">${allLabel}</option>`;
  sources.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    sel.appendChild(opt);
  });
  sel.value = sources.includes(selected) ? selected : 'ALL';
}

function populateTableCampaignDropdown(selId, basePool) {
  const sel = document.getElementById(selId);
  if (!sel) return;
  const selected = sel.value || 'ALL';
  const campaigns = [...new Set(basePool.map(r => r.campaign).filter(Boolean))].sort();
  sel.innerHTML = '<option value="ALL">All Campaigns</option>';
  campaigns.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  });
  sel.value = campaigns.includes(selected) ? selected : 'ALL';
}

// --- Table 1: Date-wise (Created On) ---
function populateT1Dropdowns() {
  const tlSel  = document.getElementById('t1-filter-tl');
  const bdeSel = document.getElementById('t1-filter-bde');
  if (!tlSel || !bdeSel) return;

  const pool = getLAGlobalData();
  const selectedTL = tlSel.value || 'ALL';

  // TL dropdown ← TL Name column
  const tls = [...new Set(pool.map(r => r.tl).filter(Boolean))].sort();
  tlSel.innerHTML = '<option value="ALL">All TLs</option>';
  tls.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    tlSel.appendChild(opt);
  });
  tlSel.value = tls.includes(selectedTL) ? selectedTL : 'ALL';

  // BDE dropdown ← Owner (User Email) column, scoped to selected TL
  const currentTL = tlSel.value;
  const bdePool = currentTL === 'ALL' ? pool : pool.filter(r => r.tl === currentTL);
  const selectedBDE = bdeSel.value || 'ALL';
  const bdes = [...new Set(bdePool.map(r => r.owner).filter(Boolean))].sort();
  bdeSel.innerHTML = '<option value="ALL">All BDEs</option>';
  bdes.forEach(email => {
    const opt = document.createElement('option');
    opt.value = email;
    opt.textContent = email;
    bdeSel.appendChild(opt);
  });
  bdeSel.value = bdes.includes(selectedBDE) ? selectedBDE : 'ALL';
}

function onT1TLChange() {
  const tlSel  = document.getElementById('t1-filter-tl');
  const bdeSel = document.getElementById('t1-filter-bde');
  if (tlSel && bdeSel) {
    const pool = getLAGlobalData().filter(r => tlSel.value === 'ALL' || r.tl === tlSel.value);
    const bdes = [...new Set(pool.map(r => r.owner).filter(Boolean))].sort();
    bdeSel.innerHTML = '<option value="ALL">All BDEs</option>';
    bdes.forEach(email => {
      const opt = document.createElement('option');
      opt.value = email;
      opt.textContent = email;
      bdeSel.appendChild(opt);
    });
    bdeSel.value = 'ALL';
  }
  renderTable1();
}

function renderTable1() {
  const tlVal  = document.getElementById('t1-filter-tl')?.value  || 'ALL';
  const bdeVal = document.getElementById('t1-filter-bde')?.value || 'ALL';

  // Start from global GM/Program/Date/TL/BDE filters, then apply T1 TL + BDE
  const pool = getBaseLAData().filter(r =>
    (tlVal  === 'ALL' || r.tl    === tlVal) &&
    (bdeVal === 'ALL' || r.owner === bdeVal)
  );

  const tbody = document.getElementById('la-table1-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  // Group by Created On date
  const map = {};
  pool.forEach(r => {
    const dateKey = r.createdOn || '(unknown)';
    if (!map[dateKey]) map[dateKey] = { leads: 0, tokens: 0, enrolled: 0 };
    map[dateKey].leads++;
    if (isNonBlank(r.tokenDate))      map[dateKey].tokens++;
    if (isNonBlank(r.enrollmentDate)) map[dateKey].enrolled++;
  });

  const dates = Object.keys(map).sort();
  let hasData = false;

  dates.forEach(date => {
    const row = map[date];
    if (row.leads === 0) return;
    hasData = true;
    const cvr = ((row.enrolled / row.leads) * 100).toFixed(2);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="mono">${date}</td>
      <td class="mono">${fNum(row.leads)}</td>
      <td class="mono">${fNum(row.tokens)}</td>
      <td class="mono">${fNum(row.enrolled)}</td>
      <td class="mono">${cvr}%</td>
    `;
    tbody.appendChild(tr);
  });

  if (!hasData) emptyRow(tbody, 5);
}

function resetT1() {
  const tlSel  = document.getElementById('t1-filter-tl');
  const bdeSel = document.getElementById('t1-filter-bde');
  if (tlSel)  tlSel.value  = 'ALL';
  if (bdeSel) bdeSel.value = 'ALL';
  populateT1Dropdowns();
  renderTable1();
}

// --- Table 2: Source-wise ---
function onT2TLChange() {
  const tlSel  = document.getElementById('t2-filter-tl');
  const bdeSel = document.getElementById('t2-filter-bde');
  if (tlSel && bdeSel) {
    const pool = getBaseLAData().filter(r => tlSel.value === 'ALL' || r.tl === tlSel.value);
    const bdes = [...new Set(pool.map(r => r.owner).filter(Boolean))].sort();
    bdeSel.innerHTML = '<option value="ALL">All BDEs</option>';
    bdes.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      bdeSel.appendChild(opt);
    });
    bdeSel.value = 'ALL';
  }
  renderTable2();
}

function renderTable2() {
  const base   = getBaseLAData();
  const srcVal = document.getElementById('t2-filter-source')?.value || 'ALL';
  const tlVal  = document.getElementById('t2-filter-tl')?.value    || 'ALL';
  const bdeVal = document.getElementById('t2-filter-bde')?.value   || 'ALL';
  const pool   = base.filter(r =>
    (srcVal === 'ALL' || r.subSource === srcVal) &&
    (tlVal  === 'ALL' || r.tl        === tlVal)  &&
    (bdeVal === 'ALL' || r.owner     === bdeVal)
  );
  renderLATable('la-table2-body', pool, 'subSource');
}

function resetT2() {
  const srcSel = document.getElementById('t2-filter-source');
  const tlSel  = document.getElementById('t2-filter-tl');
  const bdeSel = document.getElementById('t2-filter-bde');
  if (srcSel) srcSel.value = 'ALL';
  if (tlSel)  tlSel.value  = 'ALL';
  if (bdeSel) bdeSel.value = 'ALL';
  const base = getBaseLAData();
  populateTableSourceDropdown('t2-filter-source', base, 'subSource');
  populateTableTLAndBDE('t2-filter-tl', 't2-filter-bde', base);
  renderTable2();
}

// --- Table 3: Campaign-wise ---
function onT3TLChange() {
  const tlSel  = document.getElementById('t3-filter-tl');
  const bdeSel = document.getElementById('t3-filter-bde');
  if (tlSel && bdeSel) {
    const pool = getBaseLAData().filter(r => tlSel.value === 'ALL' || r.tl === tlSel.value);
    const bdes = [...new Set(pool.map(r => r.owner).filter(Boolean))].sort();
    bdeSel.innerHTML = '<option value="ALL">All BDEs</option>';
    bdes.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      bdeSel.appendChild(opt);
    });
    bdeSel.value = 'ALL';
  }
  renderTable3();
}

function renderTable3() {
  const base   = getBaseLAData();
  const cmpVal = document.getElementById('t3-filter-campaign')?.value || 'ALL';
  const srcVal = document.getElementById('t3-filter-source')?.value   || 'ALL';
  const tlVal  = document.getElementById('t3-filter-tl')?.value       || 'ALL';
  const bdeVal = document.getElementById('t3-filter-bde')?.value      || 'ALL';
  const pool   = base.filter(r =>
    (cmpVal === 'ALL' || r.campaign === cmpVal) &&
    (srcVal === 'ALL' || r.source   === srcVal) &&
    (tlVal  === 'ALL' || r.tl       === tlVal)  &&
    (bdeVal === 'ALL' || r.owner    === bdeVal)
  );
  renderLATable('la-table3-body', pool, 'campaign');
}

function resetT3() {
  const cmpSel = document.getElementById('t3-filter-campaign');
  const srcSel = document.getElementById('t3-filter-source');
  const tlSel  = document.getElementById('t3-filter-tl');
  const bdeSel = document.getElementById('t3-filter-bde');
  if (cmpSel) cmpSel.value = 'ALL';
  if (srcSel) srcSel.value = 'ALL';
  if (tlSel)  tlSel.value  = 'ALL';
  if (bdeSel) bdeSel.value = 'ALL';
  const base = getBaseLAData();
  populateTableCampaignDropdown('t3-filter-campaign', base);
  populateTableSourceDropdown('t3-filter-source', base);
  populateTableTLAndBDE('t3-filter-tl', 't3-filter-bde', base);
  renderTable3();
}

// --- Aggregate + render helper for LA tables ---
// groupBy: 'date' | 'source' | 'subSource' | 'campaign'
function renderLATable(tbodyId, pool, groupBy) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = '';

  const map = {};
  pool.forEach(r => {
    let key;
    if      (groupBy === 'source')    key = r.source    || '(unknown)';
    else if (groupBy === 'subSource') key = r.subSource || '(unknown)';
    else if (groupBy === 'campaign')  key = r.campaign  || '(unknown)';
    else                               key = r.createdOn || '(unknown)';

    if (!map[key]) map[key] = { leads: 0, tokens: 0, enrolled: 0 };
    map[key].leads++;
    if (isNonBlank(r.tokenDate))      map[key].tokens++;
    if (isNonBlank(r.enrollmentDate)) map[key].enrolled++;
  });

  const keys = Object.keys(map).sort();
  let hasData = false;

  keys.forEach(key => {
    const row = map[key];
    if (row.leads === 0) return;
    hasData = true;
    const cvr = ((row.enrolled / row.leads) * 100).toFixed(2);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="mono">${key}</td>
      <td class="mono">${fNum(row.leads)}</td>
      <td class="mono">${fNum(row.tokens)}</td>
      <td class="mono">${fNum(row.enrolled)}</td>
      <td class="mono">${cvr}%</td>
    `;
    tbody.appendChild(tr);
  });

  if (!hasData) emptyRow(tbody, 5);
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function buildDailyMap(data, field) {
  const map = {};
  let d = new Date(activeFilters.dateFrom);
  const end = new Date(activeFilters.dateTo);
  while (d <= end) {
    map[d.toISOString().split('T')[0]] = 0;
    d.setDate(d.getDate() + 1);
  }
  data.forEach(item => {
    if (map[item.date] !== undefined) {
      map[item.date] += (field === 'count' ? 1 : item[field]);
    }
  });
  return map;
}

function chartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 10, family: 'Inter' }, color: '#94a3b8', maxTicksLimit: 10 }
      },
      y: {
        beginAtZero: true,
        grid: { color: '#f1f5f9' },
        ticks: { font: { size: 10, family: 'Inter' }, color: '#94a3b8' }
      }
    }
  };
}

function achieveBadge(pct) {
  if (pct >= 65) return `<span class="badge badge-green">${pct}% ✓</span>`;
  if (pct >= 35) return `<span class="badge badge-amber">${pct}%</span>`;
  return `<span class="badge badge-red">${pct}%</span>`;
}

function rateBadge(pct) {
  if (pct >= 38) return `<span class="badge badge-green">${pct}%</span>`;
  if (pct >= 25) return `<span class="badge badge-amber">${pct}%</span>`;
  return `<span class="badge badge-red">${pct}%</span>`;
}

function emptyRow(tbody, cols) {
  tbody.innerHTML = `<tr class="empty-row"><td colspan="${cols}">No data for selected filters</td></tr>`;
}

// ==========================================
// INIT
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  // Show login, hide dashboard
  /*
  document.getElementById('app-layout').style.display = 'none';
  document.getElementById('login-overlay').style.display = 'flex';
  document.getElementById('login-username').focus();
  */

  // Directly open main dashboard
  currentUser = 'umang'; // Default GM session
  activeFilters.gm = 'ALL'; // Start with All GMs view
  initDashboard();
  document.getElementById('app-layout').style.display = 'grid';
  const overlay = document.getElementById('login-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
});
