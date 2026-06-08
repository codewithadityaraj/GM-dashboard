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
// GM CREDENTIALS & ACCESS CONTROL
// ==========================================
const GM_USERS = {
  syed: {
    password: 'Syed@8743',
    displayName: 'Syed',
    access: 'ALL'
  },
  anshul: {
    password: 'Anshul@4241',
    displayName: 'Anshul',
    access: ['Anshul', 'Umang', 'Rekha', 'Ajay']
  },
  siddhartha: {
    password: 'Siddharth@3543',
    displayName: 'Siddhartha',
    access: ['Siddhartha']
  },
  siddharth: {
    password: 'Siddharth@3543',
    displayName: 'Siddhartha',
    access: ['Siddhartha']
  },
  rekha: {
    password: 'Rekha@4524',
    displayName: 'Rekha',
    access: ['Rekha']
  },
  shringarika: {
    password: 'Shringarika@4324',
    displayName: 'Shringarika',
    access: ['Shringarika']
  },
  umang: {
    password: 'Umang@y6362',
    displayName: 'Umang',
    access: ['Umang']
  },
  sowmya: {
    password: 'Sowmya@2432',
    displayName: 'Sowmya',
    access: ['Sowmya']
  },
  anshuman: {
    password: 'Anshuman@4655',
    displayName: 'Anshuman',
    access: ['Anshuman']
  },
  kavish: {
    password: 'Kavish@6463',
    displayName: 'Kavish',
    access: ['Kavish']
  },
  ajay: {
    password: 'Ajay@8248',
    displayName: 'Ajay',
    access: ['Ajay']
  }
};

function getAllowedGMs() {
  if (!currentUser) return [];
  const userConfig = GM_USERS[currentUser.toLowerCase()];
  if (!userConfig) return [];
  if (userConfig.access === 'ALL') {
    if (allowedGMsCache) return allowedGMsCache;
    const gms = new Set();
    if (prodLoaded) prodAllRows.forEach(r => { if (r.gm) gms.add(r.gm); });
    if (laLoaded) laAllRows.forEach(r => { if (r.gm) gms.add(r.gm); });
    if (revLoaded) {
      revTokenRows.forEach(r => { if (r.gm) gms.add(r.gm); });
      revFullRows.forEach(r => { if (r.gm) gms.add(r.gm); });
    }
    if (gms.size === 0) {
      return ['Anshul', 'Umang', 'Anshuman', 'Rekha', 'Kavish', 'Siddhartha', 'Sowmya', 'Shringarika', 'Ajay'];
    }
    allowedGMsCache = [...gms].sort();
    return allowedGMsCache;
  }
  return userConfig.access;
}

function isGMAllowed(gmName) {
  if (!gmName) return false;
  const allowed = getAllowedGMs();
  return allowed.includes(gmName);
}

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
let allowedGMsCache = null;
let userSelectedDate = false;
let lastAppliedDateOption = 'custom';

// ==========================================
// LEAD ANALYSIS — CSV STATE
// ==========================================
const SHEETS_API = {
  productivity: '/api/sheets?sheet=productivity',
  revenueToken: '/api/sheets?sheet=revenue-token',
  revenueFull: '/api/sheets?sheet=revenue-full',
  cohortTargets: '/api/sheets?sheet=cohort-targets',
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
let laAllRows = [];   // parsed CSV rows
let laLoaded = false;
let laLoading = false;

const CSV_LEAD_VIEWS = ['lead-analysis', 'leads'];
const TOKEN_REVENUE_RATE = 5000;
let prodAllRows = [];
let prodLoaded = false;
let prodLoading = false;
let revTokenRows = [];
let revFullRows = [];
let revLoaded = false;
let revLoading = false;
let cohortTargetRows = [];
let cohortLoaded = false;

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
  if (laLoaded) laAllRows.forEach(r => add(r.gm, r.tl, r.owner));
  return tree;
}

function renderSidebarTeam() {
  const teamList = document.getElementById('sidebar-team-list');
  if (!teamList) return;
  teamList.innerHTML = '';

  if (prodLoaded || laLoaded) {
    const tree = buildTeamTreeFromCSV();
    let gmNames = Object.keys(tree).filter(g => isGMAllowed(g)).sort();
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
  { name: 'Rahul', program: 'Online MBA', target: 12000000, bdes: ['Aditi', 'Vikram', 'Kunal'] },
  { name: 'Priya', program: 'Advanced AI/ML', target: 8000000, bdes: ['Riya', 'Arjun', 'Vivek'] },
  { name: 'Amit', program: 'M.Tech Data Science', target: 10000000, bdes: ['Neha', 'Rohan'] },
  { name: 'Sneha', program: 'Executive Cybersecurity', target: 6000000, bdes: ['Sameer', 'Pooja'] }
];

function generateDatabase() {
  const calls = [];
  const leads = [];
  const payments = [];

  const startDate = new Date('2026-05-01');
  const endDate = new Date('2026-05-28');

  let seed = 987654;
  function rand() {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }
  function randInt(min, max) { return Math.floor(rand() * (max - min + 1)) + min; }
  function randItem(arr) { return arr[Math.floor(rand() * arr.length)]; }

  const stages = ['Interested', 'Follow Up', 'Not Connected', 'Invalid', 'Enrolled'];
  const weights = [0.25, 0.35, 0.20, 0.10, 0.10];
  const sources = ['Google Search', 'LinkedIn Ad', 'Meta Ads', 'Organic Referral', 'Direct Visit'];
  const campaigns = ['Summer Push 2026', 'MBA Awareness', 'AI Masters Q2', 'Referral Boost', 'Remarketing Wave'];

  const payAmounts = {
    'Online MBA': { full: 120000, token: 25000 },
    'Advanced AI/ML': { full: 75000, token: 15000 },
    'M.Tech Data Science': { full: 100000, token: 20000 },
    'Executive Cybersecurity': { full: 60000, token: 10000 }
  };

  ALL_TLS.forEach(tl => {
    tl.bdes.forEach(bde => {

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];

        // --- Calls ---
        const avgCalls = tl.name === 'Rahul' ? 65 : tl.name === 'Priya' ? 72 : 58;
        const dailyCalls = randInt(avgCalls - 15, avgCalls + 15);
        const dailyConnected = Math.floor(dailyCalls * randInt(25, 42) / 100);
        const dailyTalkSec = dailyConnected * randInt(90, 180);

        calls.push({
          date: dateStr,
          bde: bde,
          tl: tl.name,
          program: tl.program,
          calls: dailyCalls,
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
            date: dateStr,
            bde: bde,
            tl: tl.name,
            program: tl.program,
            stage: stage,
            source: randItem(sources),
            campaign: randItem(campaigns)
          });
        }

        // --- Payments (occasional) ---
        const dayOfWeek = d.getDay();
        const paymentChance = dayOfWeek === 0 ? 0.05 : 0.22;
        if (rand() < paymentChance) {
          const isFullPay = rand() > 0.6;
          const amts = payAmounts[tl.program];
          payments.push({
            date: dateStr,
            bde: bde,
            tl: tl.name,
            program: tl.program,
            amount: isFullPay ? amts.full : amts.token,
            type: isFullPay ? 'Full Enrollment' : 'Token Booking'
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
  if (n >= 100000) return '₹' + (n / 100000).toFixed(2) + ' L';
  if (n >= 1000) return '₹' + (n / 1000).toFixed(1) + ' K';
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
    const allowed = getAllowedGMs();
    allowed.forEach(gmName => {
      const gmKey = gmName.toLowerCase();
      if (USERS[gmKey]) {
        allTLs = allTLs.concat(USERS[gmKey].tls);
      }
    });
  } else {
    const gm = (activeFilters.gm || currentUser || 'umang').toLowerCase();
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
    const inDate = item.date >= activeFilters.dateFrom && item.date <= activeFilters.dateTo;
    const inTL = activeFilters.tl === 'ALL' || item.tl === activeFilters.tl;
    const inBDE = activeFilters.bde === 'ALL' || item.bde === activeFilters.bde;
    return inMyTeam && inDate && inTL && inBDE;
  });
}

function filteredCalls() { return filterData(DB.calls); }
function filteredLeads() { return filterData(DB.leads); }
function filteredPayments() { return filterData(DB.payments); }

// ==========================================
// AUTH
// ==========================================
const SESSION_KEY = 'gm_dashboard_user';

function saveSession(username) {
  localStorage.setItem(SESSION_KEY, username);
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function getSavedSession() {
  const username = localStorage.getItem(SESSION_KEY);
  if (!username) return null;
  const key = username.trim().toLowerCase();
  return GM_USERS[key] ? key : null;
}

function showDashboard() {
  document.getElementById('login-overlay').style.display = 'none';
  document.getElementById('app-layout').style.display = 'grid';
}

function showLoginScreen() {
  document.getElementById('app-layout').style.display = 'none';
  const overlay = document.getElementById('login-overlay');
  if (overlay) overlay.style.display = 'flex';
}

function handleLogin() {
  const username = document.getElementById('login-username').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');

  if (GM_USERS[username] && GM_USERS[username].password === password) {
    errorEl.classList.remove('show');
    currentUser = username;
    saveSession(username);
    initDashboard();
    showDashboard();
  } else {
    errorEl.classList.add('show');
    document.getElementById('login-password').value = '';
    document.getElementById('login-password').focus();
  }
}

function handleLogout() {
  clearSession();
  window.location.reload();
}

function restoreSession() {
  const username = getSavedSession();
  if (!username) return false;
  currentUser = username;
  initDashboard();
  showDashboard();
  return true;
}

// ==========================================
// DASHBOARD INIT (after login)
// ==========================================
function initDashboard() {
  allowedGMsCache = null;
  const allowed = getAllowedGMs();
  const userDisplayName = GM_USERS[currentUser]?.displayName || 'GM';

  // Set GM name label in top navbar
  document.getElementById('gm-dashboard-label').textContent = userDisplayName + "'s Dashboard";

  // Sidebar user info
  document.getElementById('sidebar-avatar').textContent = userDisplayName.charAt(0).toUpperCase();
  document.getElementById('sidebar-username').textContent = userDisplayName;

  renderSidebarTeam();

  // Reset all filters for clean state
  activeFilters.gm = allowed.length === 1 ? allowed[0] : 'ALL';
  activeFilters.program = 'ALL';
  activeFilters.tl = 'ALL';
  activeFilters.bde = 'ALL';

  const gmFilterGroup = document.getElementById('gm-filter-group');
  if (gmFilterGroup) {
    gmFilterGroup.style.display = allowed.length <= 1 ? 'none' : 'flex';
  }

  if (document.getElementById('filter-gm')) {
    populateGMFilterFromUsers();
  }

  // Populate Program filter (all programs this GM manages)
  populateProgramFilter();

  // Populate TL filter (all TLs under this GM)
  populateTLFilter();

  // Populate BDE filter (all BDEs)
  populateBDEFilter('ALL');

  // Set dates
  userSelectedDate = true;
  lastAppliedDateOption = 'today';

  const today = new Date();
  const toISODate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const todayStr = toISODate(today);

  activeFilters.dateFrom = todayStr;
  activeFilters.dateTo = todayStr;

  document.getElementById('date-from').value = todayStr;
  document.getElementById('date-to').value = todayStr;

  const filterDateEl = document.getElementById('filter-date');
  if (filterDateEl) filterDateEl.value = 'today';
  updateDateDisplayLabel();

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
  gmSel.innerHTML = '';

  const allowed = getAllowedGMs();
  if (allowed.length > 1) {
    gmSel.innerHTML = '<option value="ALL">All GMs</option>';
  }
  allowed.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    gmSel.appendChild(opt);
  });

  if (allowed.length === 1) {
    activeFilters.gm = allowed[0];
  } else if (!allowed.includes(current)) {
    activeFilters.gm = 'ALL';
  } else {
    activeFilters.gm = current;
  }
  gmSel.value = activeFilters.gm;

  const gmFilterGroup = document.getElementById('gm-filter-group');
  if (gmFilterGroup) {
    gmFilterGroup.style.display = allowed.length <= 1 ? 'none' : 'flex';
  }
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
    opt.textContent = emailToDisplayName(bde);
    bdeSelect.appendChild(opt);
  });
  bdeSelect.value = activeFilters.bde;
}

// ==========================================
// FILTER APPLY — cascades: Program → TL → BDE
// ==========================================
function applyFilters() {
  const prevGM = activeFilters.gm;
  const prevProgram = activeFilters.program;
  const prevTL = activeFilters.tl;

  if (document.getElementById('filter-gm')) {
    activeFilters.gm = document.getElementById('filter-gm').value;
  }
  activeFilters.program = document.getElementById('filter-program').value;
  activeFilters.tl = document.getElementById('filter-tl').value;
  activeFilters.bde = document.getElementById('filter-bde').value;
  activeFilters.dateFrom = document.getElementById('date-from').value;
  activeFilters.dateTo = document.getElementById('date-to').value;

  if (usesCSVProdData()) {
    if (activeFilters.gm !== prevGM) {
      activeFilters.program = 'ALL';
      activeFilters.tl = 'ALL';
      activeFilters.bde = 'ALL';
      populateProdPrograms();
      populateProdTLs();
      populateProdBDEs('ALL');
      document.getElementById('filter-program').value = 'ALL';
      document.getElementById('filter-tl').value = 'ALL';
      document.getElementById('filter-bde').value = 'ALL';
    } else if (activeFilters.program !== prevProgram) {
      activeFilters.tl = 'ALL';
      activeFilters.bde = 'ALL';
      populateProdTLs();
      populateProdBDEs('ALL');
      document.getElementById('filter-tl').value = 'ALL';
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
      activeFilters.tl = 'ALL';
      activeFilters.bde = 'ALL';
      populateLAPrograms();
      populateLATLs();
      populateLABDEs('ALL');
      document.getElementById('filter-program').value = 'ALL';
      document.getElementById('filter-tl').value = 'ALL';
      document.getElementById('filter-bde').value = 'ALL';
    } else if (activeFilters.program !== prevProgram) {
      activeFilters.tl = 'ALL';
      activeFilters.bde = 'ALL';
      populateLATLs();
      populateLABDEs('ALL');
      document.getElementById('filter-tl').value = 'ALL';
      document.getElementById('filter-bde').value = 'ALL';
    } else if (activeFilters.tl !== prevTL) {
      activeFilters.bde = 'ALL';
      populateLABDEs(activeFilters.tl);
      document.getElementById('filter-bde').value = 'ALL';
    }
  } else if (usesCSVRevData()) {
    if (activeFilters.gm !== prevGM) {
      activeFilters.program = 'ALL';
      activeFilters.tl = 'ALL';
      activeFilters.bde = 'ALL';
      populateRevPrograms();
      populateRevTLs();
      populateRevBDEs('ALL');
      document.getElementById('filter-program').value = 'ALL';
      document.getElementById('filter-tl').value = 'ALL';
      document.getElementById('filter-bde').value = 'ALL';
      if (cohortLoaded) applyCohortDateRangeForFilters();
    } else if (activeFilters.program !== prevProgram) {
      activeFilters.tl = 'ALL';
      activeFilters.bde = 'ALL';
      populateRevTLs();
      populateRevBDEs('ALL');
      document.getElementById('filter-tl').value = 'ALL';
      document.getElementById('filter-bde').value = 'ALL';
      if (cohortLoaded) applyCohortDateRangeForFilters();
    } else if (activeFilters.tl !== prevTL) {
      activeFilters.bde = 'ALL';
      populateRevBDEs(activeFilters.tl);
      document.getElementById('filter-bde').value = 'ALL';
    }
  } else if (!isCSVFilterView(activeView)) {
    // Other views: cascade using USERS config data
    if (activeFilters.gm !== prevGM) {
      activeFilters.program = 'ALL';
      activeFilters.tl = 'ALL';
      activeFilters.bde = 'ALL';

      populateProgramFilter();
      populateTLFilter();
      populateBDEFilter('ALL');

      document.getElementById('filter-program').value = 'ALL';
      document.getElementById('filter-tl').value = 'ALL';
      document.getElementById('filter-bde').value = 'ALL';

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
      activeFilters.tl = 'ALL';
      activeFilters.bde = 'ALL';
      populateTLFilter();
      populateBDEFilter('ALL');
      document.getElementById('filter-tl').value = 'ALL';
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
  overview: 'Overview',
  revenue: 'Revenue',
  productivity: 'Productivity',
  leads: 'Lead Report',
  'lead-analysis': 'Lead Analysis'
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
  const isCSVView = isCSVFilterView(viewId);

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
    case 'overview': renderOverview(); break;
    case 'revenue': renderRevenue(); break;
    case 'productivity': renderProductivity(); break;
    case 'leads': renderLeads(); break;
    case 'lead-analysis': renderLeadAnalysis(); break;
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
  if (!revLoaded && !revLoading) fetchRevenueCSV();
  if (!laLoaded && !laLoading) fetchLeadCSV();
  if (!prodLoaded && !prodLoading) fetchProductivityCSV();

  // 1. Total Token & 2. Current Token
  // 3. Total Enrollment & 4. Current Enrollment
  if (revLoaded) {
    const currentTokens = revTokenRows.filter(r => revMatchesFilters(r, 'tokenDate'));
    const currentEnrollments = revFullRows.filter(r => revMatchesFilters(r, 'fullPayDate'));

    const totalTokens = revTokenRows.filter(r => {
      const inGM = activeFilters.gm === 'ALL' ? isGMAllowed(r.gm) : r.gm === activeFilters.gm;
      const inProgram = activeFilters.program === 'ALL' || r.type === activeFilters.program;
      const inTL = activeFilters.tl === 'ALL' || r.tl === activeFilters.tl;
      const inBDE = activeFilters.bde === 'ALL' || r.bdMail === activeFilters.bde;
      return inGM && inProgram && inTL && inBDE;
    });

    const totalEnrollments = revFullRows.filter(r => {
      const inGM = activeFilters.gm === 'ALL' ? isGMAllowed(r.gm) : r.gm === activeFilters.gm;
      const inProgram = activeFilters.program === 'ALL' || r.type === activeFilters.program;
      const inTL = activeFilters.tl === 'ALL' || r.tl === activeFilters.tl;
      const inBDE = activeFilters.bde === 'ALL' || r.bdMail === activeFilters.bde;
      return inGM && inProgram && inTL && inBDE;
    });

    setText('ov-total-tokens', fNum(totalTokens.length));
    setText('ov-current-tokens', fNum(currentTokens.length));
    setText('ov-total-enrollments', fNum(totalEnrollments.length));
    setText('ov-current-enrollments', fNum(currentEnrollments.length));
  } else {
    setText('ov-total-tokens', '…');
    setText('ov-current-tokens', '…');
    setText('ov-total-enrollments', '…');
    setText('ov-current-enrollments', '…');
  }

  // 5. Avg Dialled & 6. Avg CC & 7. Avg TT
  if (prodLoaded) {
    const cData = getOverviewProdData();
    const avgDialled = prodAvgCall(cData);
    const avgConnected = prodAvgCC(cData);
    const avgTT = prodAvgTT(cData);

    setText('ov-avg-dialled', avgDialled);
    setText('ov-avg-connected', avgConnected);
    setText('ov-avg-talktime', avgTT);
  } else {
    setText('ov-avg-dialled', '…');
    setText('ov-avg-connected', '…');
    setText('ov-avg-talktime', '…');
  }

  // 8. Total Lead (CVR) & 9. Duration Total Lead (CVR)
  if (laLoaded) {
    const durationLeads = getBaseLAData();
    const durationLeadsCount = durationLeads.length;
    const durationEnrolledCount = durationLeads.filter(r => isNonBlank(r.enrollmentDate)).length;
    const durationCVR = durationLeadsCount ? ((durationEnrolledCount / durationLeadsCount) * 100).toFixed(2) : '0.00';

    const totalLeads = laAllRows.filter(r => {
      const inGM = activeFilters.gm === 'ALL' ? isGMAllowed(r.gm) : r.gm === activeFilters.gm;
      const inProgram = activeFilters.program === 'ALL' || r.program === activeFilters.program;
      const inTL = activeFilters.tl === 'ALL' || r.tl === activeFilters.tl;
      const inBDE = activeFilters.bde === 'ALL' || r.owner === activeFilters.bde;
      return inGM && inProgram && inTL && inBDE;
    });
    const totalLeadsCount = totalLeads.length;
    const totalEnrolledCount = totalLeads.filter(r => isNonBlank(r.enrollmentDate)).length;
    const totalCVR = totalLeadsCount ? ((totalEnrolledCount / totalLeadsCount) * 100).toFixed(2) : '0.00';

    setText('ov-total-leads', fNum(totalLeadsCount));
    setText('ov-total-leads-cvr', `${totalCVR}%`);
    setText('ov-duration-leads', fNum(durationLeadsCount));
    setText('ov-duration-leads-cvr', `${durationCVR}%`);
  } else {
    setText('ov-total-leads', '…');
    setText('ov-total-leads-cvr', '…');
    setText('ov-duration-leads', '…');
    setText('ov-duration-leads-cvr', '…');
  }
}

// ==========================================
// REVENUE VIEW
// ==========================================
// ==========================================
// REVENUE VIEW — powered by Token + Full Payment CSVs
// ==========================================
function mapTokenRow(obj) {
  return {
    gm: (obj['GM'] || '').trim(),
    type: (obj['Type'] || '').trim(),
    cohortName: (obj['Cohort Name'] || '').trim(),
    tl: (obj['TL Name'] || '').trim(),
    bdMail: (obj['BD Mail'] || '').trim(),
    tokenDate: parseSheetDate(obj['Token date']),
    tokenAmount: parseNum(obj['Token Amount']),
    candidate: obj['Candidate name'] || '',
  };
}

function mapFullPayRow(obj) {
  return {
    gm: (obj['GM'] || '').trim(),
    type: (obj['Type'] || '').trim(),
    cohortName: (obj['Cohort Name'] || '').trim(),
    tl: (obj['TL Name'] || '').trim(),
    bdMail: (obj['BD Mail'] || '').trim(),
    fullPayDate: parseSheetDate(obj['Full payment date']),
    amountPaid: parseNum(obj['Amount Paid']),
    candidate: obj['Candidate name'] || '',
  };
}

function mapCohortRow(obj) {
  const tls = ['TL1', 'TL2', 'TL3', 'TL4', 'TL5']
    .map(k => (obj[k] || '').trim())
    .filter(Boolean);
  return {
    programName: (obj['Program Name'] || '').trim(),
    cohortName: (obj['Cohort Name'] || '').trim(),
    startDate: parseSheetDate(obj['Cohort Start Date']),
    endDate: parseSheetDate(obj['Cohort End Date']),
    cohortTarget: parseNum(obj['Cohort Target']),
    gmTarget: parseNum(obj['GM Target']),
    gm: (obj['GM'] || '').trim(),
    tls,
    targetPerMonthPerBDA: parseNum(obj['Target Per Month Per BDA']),
    targetPerDayPerBDA: parseNum(obj['Target Per Day Per BDA']),
  };
}

// Cohort sheet GM → TL list for a program (target mapping only)
function getCohortTlsForGm(cohort, gmName) {
  if (!cohort || !gmName || normTeamName(cohort.gm) !== normTeamName(gmName)) return [];
  return cohort.tls || [];
}

function normTlMatch(a, b) {
  const na = normTeamName(a);
  const nb = normTeamName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // "Piyush" ↔ "Piyush Kumar", "Rekha" ↔ "Rekha Direct"
  if (na.startsWith(nb + ' ') || nb.startsWith(na + ' ')) return true;
  const stripDirect = (s) => s.replace(/\s+direct$/, '');
  return stripDirect(na) === stripDirect(nb);
}

function cohortTlIsMapped(cohort, gmName, tlName) {
  return getCohortTlsForGm(cohort, gmName).some(t => normTlMatch(t, tlName));
}

function cohortGmBaseTarget(cohort) {
  return cohort.gmTarget || cohort.cohortTarget || 0;
}

function revGetFilterDateRange() {
  return {
    start: activeFilters.dateFrom || '',
    end: activeFilters.dateTo || activeFilters.dateFrom || '',
  };
}

function clampTargetDateStr(dateStr, minStr, maxStr) {
  if (!dateStr) return minStr || '';
  if (minStr && dateStr < minStr) return minStr;
  if (maxStr && dateStr > maxStr) return maxStr;
  return dateStr;
}

/**
 * Prorated cohort target for the active date filter window.
 * target = Cohort Target × (elapsed days in filter ∩ cohort ÷ total cohort days)
 */
function calculateProratedCohortTarget(cohort, filterStart, filterEnd) {
  if (!cohort?.cohortTarget || !cohort.startDate || !cohort.endDate) {
    return { target: 0, perDay: 0, elapsedDays: 0, totalDays: 0, fullTarget: 0 };
  }

  const cohortStart = cohort.startDate;
  const cohortEnd = cohort.endDate;
  const totalDays = cohortDayCount(cohortStart, cohortEnd);
  const perDay = cohort.cohortTarget / totalDays;
  const fullTarget = cohort.cohortTarget;

  const fStart = filterStart || cohortStart;
  const fEnd = filterEnd || cohortEnd;

  if (fEnd < cohortStart || fStart > cohortEnd) {
    return { target: 0, perDay, elapsedDays: 0, totalDays, fullTarget };
  }

  const effectiveStart = clampTargetDateStr(fStart, cohortStart, cohortEnd);
  const effectiveEnd = clampTargetDateStr(fEnd, cohortStart, cohortEnd);
  const elapsedDays = cohortDayCount(effectiveStart, effectiveEnd);
  const target = perDay * elapsedDays;

  return {
    target: Math.round(target * 10) / 10,
    perDay: Math.round(perDay * 100) / 100,
    elapsedDays,
    totalDays,
    fullTarget,
  };
}

/** BDA target prorated by filter: (Target Per Month Per BDA / 30) × elapsed days */
function calculateProratedBdaTarget(cohort, filterStart, filterEnd) {
  if (!cohort?.targetPerMonthPerBDA || !cohort.startDate || !cohort.endDate) {
    return { target: 0, perDay: 0 };
  }

  const perDay = cohort.targetPerMonthPerBDA / 30;
  const cohortStart = cohort.startDate;
  const cohortEnd = cohort.endDate;
  const fStart = filterStart || cohortStart;
  const fEnd = filterEnd || cohortEnd;

  if (fEnd < cohortStart || fStart > cohortEnd) {
    return { target: 0, perDay };
  }

  const effectiveStart = clampTargetDateStr(fStart, cohortStart, cohortEnd);
  const effectiveEnd = clampTargetDateStr(fEnd, cohortStart, cohortEnd);
  const elapsedDays = cohortDayCount(effectiveStart, effectiveEnd);

  return {
    target: Math.round(perDay * elapsedDays * 10) / 10,
    perDay: Math.round(perDay * 100) / 100,
  };
}

function revProratedCohortForProgram(program, cohortName) {
  if (!cohortLoaded || !program) {
    return { target: 0, perDay: 0, elapsedDays: 0, totalDays: 0, fullTarget: 0 };
  }
  const cohort = findCohortTarget(program, cohortName);
  if (!cohort) {
    return { target: 0, perDay: 0, elapsedDays: 0, totalDays: 0, fullTarget: 0 };
  }
  const { start, end } = revGetFilterDateRange();
  return calculateProratedCohortTarget(cohort, start, end);
}

// Prorated target for selected program, or sum across all programs when ALL
function revCohortTotalTarget(program) {
  if (!cohortLoaded) return 0;
  const prog = program ?? activeFilters.program;

  if (!prog || prog === 'ALL') {
    const programs = [...new Set(cohortTargetRows.map(r => r.programName).filter(Boolean))];
    return programs.reduce((sum, p) => sum + revProratedCohortForProgram(p).target, 0);
  }

  return revProratedCohortForProgram(prog).target;
}

function revCohortPerDayTarget(program) {
  if (!cohortLoaded) return 0;
  const prog = program ?? activeFilters.program;

  if (!prog || prog === 'ALL') {
    const programs = [...new Set(cohortTargetRows.map(r => r.programName).filter(Boolean))];
    return programs.reduce((sum, p) => sum + revProratedCohortForProgram(p).perDay, 0);
  }

  return revProratedCohortForProgram(prog).perDay;
}

function revProgramsInScope(contextRows) {
  const fromRows = [...new Set((contextRows || []).map(r => r.type).filter(Boolean))];
  if (fromRows.length) return fromRows;
  if (activeFilters.program !== 'ALL') return [activeFilters.program];
  return [...new Set(cohortTargetRows.map(r => r.programName).filter(Boolean))];
}

// Target scoped to active GM / TL / BDE filters (KPI + unit cards)
function revScopedTarget(contextRows) {
  if (!cohortLoaded) return { total: 0, perDay: 0 };

  if (activeFilters.bde !== 'ALL') {
    return revBdaRowsCohortTarget(contextRows);
  }
  if (activeFilters.tl !== 'ALL') {
    return revTlRowsCohortTarget(activeFilters.tl);
  }
  if (activeFilters.gm !== 'ALL') {
    return revRowsCohortTarget(contextRows, activeFilters.gm);
  }

  const programs = revProgramsInScope(contextRows);
  let total = 0, perDay = 0;
  programs.forEach(p => {
    const r = revProratedCohortForProgram(p);
    total += r.target;
    perDay += r.perDay;
  });
  return { total, perDay };
}

// GM slice: sum prorated GM Target per program where cohort sheet GM matches
function revRowsCohortTarget(contextRows, gmName) {
  if (!cohortLoaded) return { total: 0, perDay: 0 };
  const { start, end } = revGetFilterDateRange();
  const programs = revProgramsInScope(contextRows);
  if (!programs.length) return { total: 0, perDay: 0 };
  let total = 0, perDay = 0;
  programs.forEach(prog => {
    const cohort = findCohortTarget(prog);
    if (!cohort) return;
    if (gmName && normTeamName(cohort.gm) !== normTeamName(gmName)) return;
    const baseTarget = cohortGmBaseTarget(cohort);
    if (!baseTarget) return;
    const result = calculateProratedCohortTarget({ ...cohort, cohortTarget: baseTarget }, start, end);
    total += result.target;
    perDay += result.perDay;
  });
  return { total, perDay };
}

// BDA slice: prorated Target Per Month Per BDA per program
function revBdaRowsCohortTarget(contextRows) {
  if (!cohortLoaded) return { total: 0, perDay: 0 };
  const { start, end } = revGetFilterDateRange();
  const programs = revProgramsInScope(contextRows);
  if (!programs.length) return { total: 0, perDay: 0 };
  let total = 0, perDay = 0;
  programs.forEach(prog => {
    const cohort = findCohortTarget(prog);
    if (!cohort) return;
    const result = calculateProratedBdaTarget(cohort, start, end);
    total += result.target;
    perDay += result.perDay;
  });
  return { total, perDay };
}

// TL slice: GM Target ÷ TLs listed in cohort sheet (TL1–TL5) for that GM + program
// Programs come from cohort sheet mapping (not revenue rows). Unmapped TL → 0.
function revTlRowsCohortTarget(tlName) {
  if (!cohortLoaded || !tlName) return { total: 0, perDay: 0 };

  const gmFilter = activeFilters.gm !== 'ALL' ? activeFilters.gm : '';
  const progFilter = activeFilters.program !== 'ALL' ? activeFilters.program : '';
  const { start, end } = revGetFilterDateRange();
  let total = 0, perDay = 0;

  cohortTargetRows.forEach(cohort => {
    if (progFilter && cohort.programName !== progFilter) return;

    const gmName = gmFilter || cohort.gm;
    if (!gmName || normTeamName(cohort.gm) !== normTeamName(gmName)) return;
    if (!cohortTlIsMapped(cohort, gmName, tlName)) return;

    const tls = getCohortTlsForGm(cohort, gmName);
    const baseTarget = cohortGmBaseTarget(cohort);
    if (!tls.length || !baseTarget) return;

    const result = calculateProratedCohortTarget({ ...cohort, cohortTarget: baseTarget }, start, end);
    total += result.target / tls.length;
    perDay += result.perDay / tls.length;
  });
  return { total, perDay };
}

function findCohortTarget(programName, cohortName) {
  if (!programName) return null;
  const matches = cohortTargetRows.filter(r => r.programName === programName);
  if (!matches.length) return null;
  if (cohortName) {
    const exact = matches.find(r => r.cohortName === cohortName);
    if (exact) return exact;
  }
  const today = new Date().toISOString().slice(0, 10);
  const active = matches.find(r => r.startDate <= today && r.endDate >= today);
  return active || matches[0];
}

function cohortDayCount(startDate, endDate) {
  if (!startDate || !endDate) return 1;
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

// Input sheet (productivity + leads) — BDA → TL → GM roster for target mapping only
function normTeamName(name) {
  return (name || '').trim().toLowerCase();
}

function buildInputBdaRosterMap() {
  const map = new Map();
  const add = (bda, tl, gm, date) => {
    if (!bda) return;
    const key = bda.trim().toLowerCase();
    const tlName = (tl || '').trim();
    const gmName = (gm || '').trim();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { bda: bda.trim(), tl: tlName, gm: gmName, date: date || '' });
      return;
    }
    if ((!existing.tl || !existing.gm) && tlName && gmName) {
      map.set(key, { bda: bda.trim(), tl: tlName, gm: gmName, date: date || existing.date });
      return;
    }
    if (date && date >= existing.date && (tlName || gmName)) {
      map.set(key, {
        bda: bda.trim(),
        tl: tlName || existing.tl,
        gm: gmName || existing.gm,
        date,
      });
    }
  };

  if (prodLoaded) {
    prodAllRows.forEach(r => add(r.owner, r.manager, r.gm, r.date));
  }
  if (laLoaded) {
    laAllRows.forEach(r => add(r.owner, r.tl, r.gm, r.createdOn));
  }
  return map;
}

function getRevenueBdaEmails(scope = {}) {
  const gm = scope.gm !== undefined ? scope.gm : activeFilters.gm;
  const tl = scope.tl !== undefined ? scope.tl : activeFilters.tl;
  const bde = scope.bde !== undefined ? scope.bde : activeFilters.bde;
  const program = scope.program ?? activeFilters.program;

  let pool = [...revTokenRows, ...revFullRows];
  if (gm !== 'ALL') pool = pool.filter(r => r.gm === gm);
  if (tl !== 'ALL') pool = pool.filter(r => normTeamName(r.tl) === normTeamName(tl));
  if (program !== 'ALL') pool = pool.filter(r => r.type === program);
  if (bde !== 'ALL') pool = pool.filter(r => inputBdaMatchesFilter(r.bdMail, bde));
  return [...new Set(pool.map(r => r.bdMail).filter(Boolean))];
}

function getTargetBdaCount(scope = {}) {
  const roster = getInputBdaRoster(scope);
  if (roster.length) return roster.length;

  const inputMap = buildInputBdaRosterMap();
  const revEmails = getRevenueBdaEmails(scope);
  if (revEmails.length) {
    const inInput = revEmails.filter(e => inputMap.has(e.toLowerCase()));
    return inInput.length || revEmails.length;
  }

  if (scope.bde && scope.bde !== 'ALL') return 1;
  return 0;
}

function revResolveTargetProgram(scope, contextRows) {
  const program = scope.program ?? activeFilters.program;
  if (program !== 'ALL') return program;
  const counts = {};
  (contextRows || []).forEach(r => {
    const p = (r.type || '').trim();
    if (p) counts[p] = (counts[p] || 0) + 1;
  });
  let top = '';
  let max = 0;
  for (const [p, c] of Object.entries(counts)) {
    if (c > max) { max = c; top = p; }
  }
  return top || (cohortTargetRows[0]?.programName || '');
}

function revTargetPerDay(scope = {}) {
  if (!cohortLoaded || !cohortTargetRows.length) return 0;

  const program = revResolveTargetProgram(scope, scope.contextRows);
  if (!program) return 0;

  const cohort = findCohortTarget(program, scope.cohortName);
  if (!cohort?.targetPerDayPerBDA) return 0;

  const bdaCount = getTargetBdaCount({ ...scope, program });
  if (!bdaCount) return 0;

  return cohort.targetPerDayPerBDA * bdaCount;
}

function revTargetFullPayments(scope = {}) {
  if (!cohortLoaded || !cohortTargetRows.length) return 0;

  const program = revResolveTargetProgram(scope, scope.contextRows);
  if (!program) return 0;

  const cohort = findCohortTarget(program, scope.cohortName);
  if (!cohort?.targetPerDayPerBDA) return 0;

  const bdaCount = getTargetBdaCount({ ...scope, program });
  if (!bdaCount) return 0;

  const days = cohortDayCount(cohort.startDate, cohort.endDate);
  return cohort.targetPerDayPerBDA * bdaCount * days;
}

function inputBdaMatchesFilter(bda, filterBde) {
  if (!filterBde || filterBde === 'ALL') return true;
  const bdaLower = (bda || '').trim().toLowerCase();
  const filterLower = filterBde.trim().toLowerCase();
  if (bdaLower === filterLower) return true;
  if (filterBde.includes('@')) {
    return bdaLower === filterLower || emailToDisplayName(filterBde).toLowerCase() === emailToDisplayName(bda).toLowerCase();
  }
  return emailToDisplayName(bda).toLowerCase() === filterLower || bdaLower === filterLower;
}

function getInputBdaRoster(scope = {}) {
  const rosterMap = buildInputBdaRosterMap();
  const gm = scope.gm !== undefined ? scope.gm : activeFilters.gm;
  const tl = scope.tl !== undefined ? scope.tl : activeFilters.tl;
  const bde = scope.bde !== undefined ? scope.bde : activeFilters.bde;

  let list = [...rosterMap.values()];
  if (gm === 'ALL') list = list.filter(r => isGMAllowed(r.gm));
  else list = list.filter(r => r.gm === gm);
  if (tl !== 'ALL') list = list.filter(r => normTeamName(r.tl) === normTeamName(tl));
  if (bde !== 'ALL') list = list.filter(r => inputBdaMatchesFilter(r.bda, bde));
  return list;
}

function formatTargetNum(n) {
  return Number.isInteger(n) ? fNum(n) : n.toFixed(1);
}

function applyCohortDateRangeForFilters() {
  if (userSelectedDate) return false;
  if (!cohortLoaded || !cohortTargetRows.length) return false;

  let startDate = '';
  let endDate = '';

  if (activeFilters.program !== 'ALL') {
    const cohort = findCohortTarget(activeFilters.program);
    if (!cohort) return false;
    startDate = cohort.startDate;
    endDate = cohort.endDate;
  } else {
    const starts = cohortTargetRows.map(r => r.startDate).filter(Boolean).sort();
    const ends = cohortTargetRows.map(r => r.endDate).filter(Boolean).sort();
    if (!starts.length) return false;
    startDate = starts[0];
    endDate = ends[ends.length - 1];
  }

  if (!startDate || !endDate) return false;

  activeFilters.dateFrom = startDate;
  activeFilters.dateTo = endDate;
  const dateFromEl = document.getElementById('date-from');
  const dateToEl = document.getElementById('date-to');
  if (dateFromEl) dateFromEl.value = startDate;
  if (dateToEl) dateToEl.value = endDate;

  const filterDateEl = document.getElementById('filter-date');
  if (filterDateEl) filterDateEl.value = 'custom';
  lastAppliedDateOption = 'custom';
  updateDateDisplayLabel();

  return true;
}

function revMatchesFilters(row, dateField) {
  const dt = row[dateField];
  const inDate = (!activeFilters.dateFrom || dt >= activeFilters.dateFrom) &&
    (!activeFilters.dateTo || dt <= activeFilters.dateTo);
  const inGM = activeFilters.gm === 'ALL' ? isGMAllowed(row.gm) : row.gm === activeFilters.gm;
  const inProgram = activeFilters.program === 'ALL' || row.type === activeFilters.program;
  const inTL = activeFilters.tl === 'ALL' || row.tl === activeFilters.tl;
  const inBDE = activeFilters.bde === 'ALL' || row.bdMail === activeFilters.bde;
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

function revBookingBreakup(tokenCount, fullCount) {
  const parts = [];
  if (tokenCount > 0) parts.push(`${fNum(tokenCount)} Token`);
  if (fullCount > 0) parts.push(`${fNum(fullCount)} Full`);
  if (parts.length === 0) return '0 bookings';
  return parts.join(' and ');
}

function populateRevGlobalFilters() {
  const gmSel = document.getElementById('filter-gm');
  if (gmSel) {
    const current = activeFilters.gm;
    const gmNames = [...new Set(revTokenRows.map(r => r.gm).filter(Boolean))].filter(g => isGMAllowed(g)).sort();
    gmSel.innerHTML = '';
    if (gmNames.length > 1) {
      gmSel.innerHTML = '<option value="ALL">All GMs</option>';
    }
    gmNames.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      gmSel.appendChild(opt);
    });

    const allowed = getAllowedGMs();
    if (allowed.length === 1) {
      activeFilters.gm = allowed[0];
    } else if (!gmNames.includes(current)) {
      activeFilters.gm = 'ALL';
    } else {
      activeFilters.gm = current;
    }
    gmSel.value = activeFilters.gm;

    const gmFilterGroup = document.getElementById('gm-filter-group');
    if (gmFilterGroup) {
      gmFilterGroup.style.display = allowed.length <= 1 ? 'none' : 'flex';
    }
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
  const types = [...new Set([
    ...pool.map(r => r.type).filter(Boolean),
    ...cohortTargetRows.map(r => r.programName).filter(Boolean),
  ])].sort();
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
  if (activeFilters.gm !== 'ALL') pool = pool.filter(r => r.gm === activeFilters.gm);
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
  if (activeFilters.gm !== 'ALL') pool = pool.filter(r => r.gm === activeFilters.gm);
  if (activeFilters.program !== 'ALL') pool = pool.filter(r => r.type === activeFilters.program);
  if (tlName && tlName !== 'ALL') pool = pool.filter(r => r.tl === tlName);
  const bdes = [...new Set(pool.map(r => r.bdMail).filter(Boolean))].sort();
  sel.innerHTML = '<option value="ALL">All BDEs</option>';
  bdes.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b;
    opt.textContent = emailToDisplayName(b);
    sel.appendChild(opt);
  });
  activeFilters.bde = bdes.includes(activeFilters.bde) ? activeFilters.bde : 'ALL';
  sel.value = activeFilters.bde;
}

async function ensureInputMappingLoaded() {
  if (prodLoaded) return;
  if (prodLoading) {
    while (prodLoading) await new Promise(r => setTimeout(r, 50));
    return;
  }
  await fetchProductivityCSV();
}

async function fetchRevenueCSV() {
  if (revLoading) return;
  revLoading = true;
  setText('rev-total', '…');
  if (activeView === 'overview') setText('ov-revenue', '…');
  try {
    const [tokenResp, fullResp, cohortResp] = await Promise.all([
      fetch(SHEETS_API.revenueToken),
      fetch(SHEETS_API.revenueFull),
      fetch(SHEETS_API.cohortTargets),
      ensureInputMappingLoaded(),
    ]);
    if (!tokenResp.ok) throw new Error(`Token CSV HTTP ${tokenResp.status}`);
    if (!fullResp.ok) throw new Error(`Full Payment CSV HTTP ${fullResp.status}`);

    const tokenRaw = parseCSV(await tokenResp.text());
    const fullRaw = parseCSV(await fullResp.text());
    revTokenRows = tokenRaw.map(mapTokenRow).filter(r => r.tokenDate);
    revFullRows = fullRaw.map(mapFullPayRow).filter(r => r.fullPayDate || r.amountPaid > 0);

    if (cohortResp.ok) {
      cohortTargetRows = parseCSV(await cohortResp.text())
        .map(mapCohortRow)
        .filter(r => r.programName && r.startDate && r.endDate);
      cohortLoaded = true;
    } else {
      cohortTargetRows = [];
      cohortLoaded = false;
    }

    revLoaded = true;
    allowedGMsCache = null;

    if (activeView === 'revenue' || activeView === 'overview') {
      if (!userSelectedDate) {
        if (!applyCohortDateRangeForFilters()) {
          const dates = revTokenRows.map(r => r.tokenDate).filter(Boolean).sort();
          if (dates.length) {
            activeFilters.dateFrom = dates[0];
            activeFilters.dateTo = dates[dates.length - 1];
            const dateFromEl = document.getElementById('date-from');
            const dateToEl = document.getElementById('date-to');
            if (dateFromEl) dateFromEl.value = activeFilters.dateFrom;
            if (dateToEl) dateToEl.value = activeFilters.dateTo;

            const filterDateEl = document.getElementById('filter-date');
            if (filterDateEl) filterDateEl.value = 'custom';
            lastAppliedDateOption = 'custom';
            updateDateDisplayLabel();
          }
        }
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
  if (!prodLoaded && !prodLoading) ensureInputMappingLoaded().then(() => renderRevenue());
  if (!prodLoaded) return;

  const tokenData = getBaseRevTokens();
  const fullData = getBaseRevFullPayments();

  const tokenAgg = revAggTokens(tokenData);
  const fullAgg = revAggFull(fullData);
  const tokenRev = tokenAgg.amount;
  const fullRev = fullAgg.amount;
  const tokenCount = tokenAgg.count;
  const fullCount = fullAgg.count;
  const totalRev = tokenRev + fullRev;

  setText('rev-total', fCurrency(totalRev));
  setText('rev-total-sub', 'collected');
  setText('rev-full', fNum(fullCount));
  setText('rev-full-sub', fCurrency(fullRev));
  setText('rev-tokens', fNum(tokenCount));
  setText('rev-tokens-sub', fCurrency(tokenRev));

  const scopeRows = [...tokenData, ...fullData];
  const { total: targetFull, perDay } = revScopedTarget(scopeRows);
  const achievedFull = fullAgg.count;
  if (cohortLoaded && targetFull > 0) {
    const targetPct = Math.min(999, (achievedFull / targetFull) * 100);
    setText('rev-target-pct', `${targetPct.toFixed(1)}%`);
    setText('rev-target-sub', `${fNum(achievedFull)} of ${formatTargetNum(targetFull)} full${perDay ? ` · ${formatTargetNum(perDay)}/day` : ''}`);
  } else {
    setText('rev-target-pct', '—');
    setText('rev-target-sub', cohortLoaded ? 'No target for date range' : 'Loading targets…');
  }

  // Target Token (Unit wise) & Target Full Enrollment (Unit wise)
  const tokenUnitsContainer = document.getElementById('rev-target-token-units');
  const enrollmentUnitsContainer = document.getElementById('rev-target-enrollment-units');

  if (tokenUnitsContainer) tokenUnitsContainer.innerHTML = '';
  if (enrollmentUnitsContainer) enrollmentUnitsContainer.innerHTML = '';

  const typeSet = new Set([
    ...tokenData.map(r => r.type).filter(Boolean),
    ...fullData.map(r => r.type).filter(Boolean)
  ]);
  const types = [...typeSet].sort();
  if (types.length === 0 && activeFilters.program !== 'ALL') {
    types.push(activeFilters.program);
  }

  types.forEach((type, idx) => {
    const tRows = tokenData.filter(r => r.type === type);
    const fRows = fullData.filter(r => r.type === type);
    const tAgg = revAggTokens(tRows);
    const fAgg = revAggFull(fRows);
    const cohort = findCohortTarget(type);
    const { total: progTarget, perDay: progPerDay } = revScopedTarget([...tRows, ...fRows]);
    const cohortDates = cohort ? `${cohort.startDate} → ${cohort.endDate}` : '';
    const accentClass = idx % 3 === 0 ? 'accent-indigo' : idx % 3 === 1 ? 'accent-emerald' : 'accent-purple';

    // 1. Populate Token target card
    if (tokenUnitsContainer) {
      const tokenPct = progTarget ? Math.min(100, (tAgg.count / progTarget) * 100) : 0;
      const card = document.createElement('div');
      card.className = `target-card ${accentClass}`;
      card.innerHTML = `
        <div class="target-card-header">
          <span class="target-card-title">${type}</span>
          <span class="target-card-sub">Tokens Value: ${fCurrency(tAgg.amount)}${cohortDates ? ` · ${cohortDates}` : ''}</span>
        </div>
        <div class="target-progress-wrap">
          ${progTarget ? `
          <div class="target-progress-bar">
            <div class="target-progress-fill" style="width: ${tokenPct.toFixed(1)}%"></div>
          </div>` : ''}
          <div class="target-progress-stats">
            <span>Achieved: ${tAgg.count} Tokens</span>
            <span>Target: ${formatTargetNum(progTarget)} (${formatTargetNum(progPerDay)}/day) · Progress: ${tokenPct.toFixed(1)}%</span>
          </div>
        </div>
      `;
      tokenUnitsContainer.appendChild(card);
    }

    // 2. Populate Full Enrollment target card
    if (enrollmentUnitsContainer) {
      const fullPct = progTarget ? Math.min(100, (fAgg.count / progTarget) * 100) : 0;
      const card = document.createElement('div');
      card.className = `target-card ${accentClass}`;
      card.innerHTML = `
        <div class="target-card-header">
          <span class="target-card-title">${type}</span>
          <span class="target-card-sub">Enrollments Value: ${fCurrency(fAgg.amount)}${cohortDates ? ` · ${cohortDates}` : ''}</span>
        </div>
        <div class="target-progress-wrap">
          ${progTarget ? `
          <div class="target-progress-bar">
            <div class="target-progress-fill" style="width: ${fullPct.toFixed(1)}%"></div>
          </div>` : ''}
          <div class="target-progress-stats">
            <span>Achieved: ${fAgg.count} Full</span>
            <span>Target: ${formatTargetNum(progTarget)} (${formatTargetNum(progPerDay)}/day) · Progress: ${fullPct.toFixed(1)}%</span>
          </div>
        </div>
      `;
      enrollmentUnitsContainer.appendChild(card);
    }
  });

  if (types.length === 0) {
    if (tokenUnitsContainer) {
      tokenUnitsContainer.innerHTML = '<div class="empty-row" style="grid-column: 1/-1;">No Token revenue data for selected filters</div>';
    }
    if (enrollmentUnitsContainer) {
      enrollmentUnitsContainer.innerHTML = '<div class="empty-row" style="grid-column: 1/-1;">No Full Enrollment revenue data for selected filters</div>';
    }
  }

  setText('rev-lead-tokens', fCurrency(tokenRev));
  setText('rev-lead-enrollments', fCurrency(fullRev));

  // Input efficiency — use productivity CSV if available
  let totalCalls = 0;
  let talkMins = 0;
  if (prodLoaded) {
    const cData = getBaseProdData();
    totalCalls = cData.reduce((s, r) => s + r.calls, 0);
    talkMins = cData.reduce((s, r) => s + r.talkTimeMin, 0);
  }
  const activeBdesCount = new Set([
    ...tokenData.map(r => r.bdMail),
    ...fullData.map(r => r.bdMail)
  ].filter(Boolean)).size;
  setText('rev-input-rev-bde', fCurrency(activeBdesCount ? Math.round(totalRev / activeBdesCount) : 0));
  setText('rev-input-rev-dial', fCurrency(totalCalls ? Math.round(totalRev / totalCalls) : 0));
  setText('rev-input-rev-talk', fCurrency(talkMins ? Math.round(totalRev / talkMins) : 0));

  // Top 3 BDAs by token count
  const bdaPodiumContainer = document.getElementById('rev-podium-bdas');
  bdaPodiumContainer.innerHTML = '';
  const podiumBdeMap = {};
  tokenData.forEach(r => {
    if (!r.bdMail) return;
    if (!podiumBdeMap[r.bdMail]) podiumBdeMap[r.bdMail] = { tokens: [], type: r.type };
    podiumBdeMap[r.bdMail].tokens.push(r);
    if (r.type) podiumBdeMap[r.bdMail].type = r.type;
  });

  const bdaRankings = Object.keys(podiumBdeMap).map(bd => {
    const tokenCount = revAggTokens(podiumBdeMap[bd].tokens).count;
    return { bd, tokenCount, type: podiumBdeMap[bd].type || '—' };
  }).sort((a, b) => b.tokenCount - a.tokenCount);

  const topBDAs = bdaRankings.filter(b => b.tokenCount > 0).slice(0, 3);
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
        <div class="podium-bda-rev">${fNum(bda.tokenCount)} Token${bda.tokenCount !== 1 ? 's' : ''}</div>
      `;
      bdaPodiumContainer.appendChild(card);
    });
  } else {
    bdaPodiumContainer.innerHTML = '<div class="empty-row" style="width: 100%">No token data for BDAs in this period</div>';
  }

  // GM Performance
  const gmTbody = document.getElementById('rev-gm-table');
  gmTbody.innerHTML = '';
  const gmNames = activeFilters.gm === 'ALL'
    ? [...new Set([...tokenData, ...fullData].map(r => r.gm).filter(Boolean))].sort()
    : [activeFilters.gm];

  gmNames.forEach(gmName => {
    const gmRows = [...tokenData, ...fullData].filter(r => r.gm === gmName);
    const gmTokens = revAggTokens(tokenData.filter(r => r.gm === gmName));
    const gmFull = revAggFull(fullData.filter(r => r.gm === gmName));
    const { total: gmTarget, perDay: gmTargetDay } = revRowsCohortTarget(gmRows, gmName);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-name bold">${gmName}</td>
      <td class="col-num" title="${gmTarget ? `${formatTargetNum(gmTargetDay)}/day` : ''}">${gmTarget ? formatTargetNum(gmTarget) : '—'}</td>
      <td class="col-num">${fNum(gmTokens.count)}</td>
      <td class="col-num">${fNum(gmFull.count)}</td>
    `;
    gmTbody.appendChild(tr);
  });
  if (gmTbody.innerHTML === '') emptyRow(gmTbody, 4);

  // TL Performance
  const tlTbody = document.getElementById('rev-tl-perf-table');
  tlTbody.innerHTML = '';
  const tlNames = [...new Set([...tokenData, ...fullData].map(r => r.tl).filter(Boolean))].sort();
  tlNames.forEach(tlName => {
    const tlRows = [...tokenData, ...fullData].filter(r => normTeamName(r.tl) === normTeamName(tlName));
    const tlTokens = revAggTokens(tokenData.filter(r => normTeamName(r.tl) === normTeamName(tlName)));
    const tlFull = revAggFull(fullData.filter(r => normTeamName(r.tl) === normTeamName(tlName)));
    if (tlTokens.count === 0 && tlFull.count === 0) return;
    const { total: tlTarget, perDay: tlTargetDay } = revTlRowsCohortTarget(tlName);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-name bold">${tlName}</td>
      <td class="col-num" title="${tlTarget ? `${formatTargetNum(tlTargetDay)}/day` : ''}">${tlTarget ? formatTargetNum(tlTarget) : '—'}</td>
      <td class="col-num">${fNum(tlTokens.count)}</td>
      <td class="col-num">${fNum(tlFull.count)}</td>
    `;
    tlTbody.appendChild(tr);
  });
  if (tlTbody.innerHTML === '') emptyRow(tlTbody, 4);

  // BDA Performance
  const bdaTbody = document.getElementById('rev-bda-table');
  bdaTbody.innerHTML = '';
  const bdeMap = {};
  tokenData.forEach(r => {
    if (!r.bdMail) return;
    if (!bdeMap[r.bdMail]) bdeMap[r.bdMail] = { tokens: [], full: [] };
    bdeMap[r.bdMail].tokens.push(r);
  });
  fullData.forEach(r => {
    if (!r.bdMail) return;
    if (!bdeMap[r.bdMail]) bdeMap[r.bdMail] = { tokens: [], full: [] };
    bdeMap[r.bdMail].full.push(r);
  });
  Object.keys(bdeMap).sort().forEach(bd => {
    const tAgg = revAggTokens(bdeMap[bd].tokens);
    const fAgg = revAggFull(bdeMap[bd].full);
    const bdeRows = [...bdeMap[bd].tokens, ...bdeMap[bd].full];
    const { total: bdeTarget, perDay: bdeTargetDay } = revBdaRowsCohortTarget(bdeRows);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-name bold" title="${bd}">${bd}</td>
      <td class="col-num" title="${bdeTarget ? `${formatTargetNum(bdeTargetDay)}/day` : ''}">${bdeTarget ? formatTargetNum(bdeTarget) : '—'}</td>
      <td class="col-num">${fNum(tAgg.count)}</td>
      <td class="col-num">${fNum(fAgg.count)}</td>
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
      const tokenDisplay = fNum(info.tokens);
      const enrollDisplay = fNum(info.enrolls);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="col-name bold">${formattedDate}</td>
        <td class="col-num">${tokenDisplay}</td>
        <td class="col-num">${enrollDisplay}</td>
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
    owner: obj['Owner Name'] || '',
    date: (obj['Date'] || '').substring(0, 10),
    calls: parseNum(obj['# Calls']),
    connected: parseNum(obj['# Calls Connected']),
    uniqueLeads: parseNum(obj['# Unique Leads']),
    talkTimeMin: parseNum(obj['Total Call Duration']),
    manager: (obj['Manager Name'] || '').trim(),
    gm: (obj['GM Name'] || '').trim(),
  };
}

function getProdOwnersForProgram() {
  if (activeFilters.program === 'ALL' || !laLoaded) return null;
  const owners = new Set(
    laAllRows
      .filter(r => {
        const inGM = activeFilters.gm === 'ALL' ? isGMAllowed(r.gm) : r.gm === activeFilters.gm;
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
      (!activeFilters.dateTo || r.date <= activeFilters.dateTo);
    const inGM = activeFilters.gm === 'ALL' ? isGMAllowed(r.gm) : r.gm === activeFilters.gm;
    return inDate && inGM && r.owner;
  });
}

function getBaseProdData() {
  let pool = getProdGlobalData();
  const programOwners = getProdOwnersForProgram();
  if (programOwners) pool = pool.filter(r => programOwners.has(r.owner));
  if (activeFilters.tl !== 'ALL') pool = pool.filter(r => r.manager === activeFilters.tl);
  if (activeFilters.bde !== 'ALL') pool = pool.filter(r => r.owner === activeFilters.bde);
  return pool;
}

function populateProdGlobalFilters() {
  const gmSel = document.getElementById('filter-gm');
  if (gmSel) {
    const current = activeFilters.gm;
    const gmNames = [...new Set(prodAllRows.map(r => r.gm).filter(Boolean))].filter(g => isGMAllowed(g)).sort();
    gmSel.innerHTML = '';
    if (gmNames.length > 1) {
      gmSel.innerHTML = '<option value="ALL">All GMs</option>';
    }
    gmNames.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      gmSel.appendChild(opt);
    });

    const allowed = getAllowedGMs();
    if (allowed.length === 1) {
      activeFilters.gm = allowed[0];
    } else if (!gmNames.includes(current)) {
      activeFilters.gm = 'ALL';
    } else {
      activeFilters.gm = current;
    }
    gmSel.value = activeFilters.gm;

    const gmFilterGroup = document.getElementById('gm-filter-group');
    if (gmFilterGroup) {
      gmFilterGroup.style.display = allowed.length <= 1 ? 'none' : 'flex';
    }
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
    opt.textContent = emailToDisplayName(b);
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
    allowedGMsCache = null;

    if (activeView === 'productivity') {
      if (!userSelectedDate) {
        const dates = prodAllRows.map(r => r.date).filter(Boolean).sort();
        if (dates.length) {
          activeFilters.dateFrom = dates[0];
          activeFilters.dateTo = dates[dates.length - 1];
          const dateFromEl = document.getElementById('date-from');
          const dateToEl = document.getElementById('date-to');
          if (dateFromEl) dateFromEl.value = activeFilters.dateFrom;
          if (dateToEl) dateToEl.value = activeFilters.dateTo;

          const filterDateEl = document.getElementById('filter-date');
          if (filterDateEl) filterDateEl.value = 'custom';
          lastAppliedDateOption = 'custom';
          updateDateDisplayLabel();
        }
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

// LS working days: each owner-date with at least 1 call counts as 1
function prodWorkingDaysCount(rows) {
  const days = new Set();
  rows.forEach(r => {
    if (r.calls > 0 && r.date && r.owner) {
      days.add(`${r.owner}|${r.date}`);
    }
  });
  return days.size;
}

function prodAvgCall(rows) {
  const totalCalls = rows.reduce((s, r) => s + r.calls, 0);
  const workingDays = prodWorkingDaysCount(rows);
  return workingDays ? (totalCalls / workingDays).toFixed(1) : '0.0';
}

function prodAvgCC(rows) {
  const totalConnects = rows.reduce((s, r) => s + r.connected, 0);
  const workingDays = prodWorkingDaysCount(rows);
  return workingDays ? (totalConnects / workingDays).toFixed(1) : '0.0';
}

function prodAvgTT(rows) {
  const totalTalkMin = rows.reduce((s, r) => s + r.talkTimeMin, 0);
  const workingDays = prodWorkingDaysCount(rows);
  return workingDays ? formatTalkHrs(totalTalkMin / workingDays) : '0.0h';
}

function prodCPL(totalCalls, uniqueDialled) {
  return uniqueDialled ? (totalCalls / uniqueDialled).toFixed(2) : '—';
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
  const talkHrs = (talkMins / 60).toFixed(1);
  const avgTalkSec = connected ? Math.round((talkMins * 60) / connected) : 0;

  const allOwnersInScope = new Set(getProdGlobalData().map(r => r.owner));
  const programOwners = getProdOwnersForProgram();
  const totalBDEs = programOwners
    ? [...programOwners].filter(o => allOwnersInScope.has(o)).length
    : allOwnersInScope.size;

  setText('prod-calls', fNum(totalCalls));
  setText('prod-calls-sub', `${fNum(connected)} connected`);
  setText('prod-connect', `${connectRate}%`);
  setText('prod-connect-sub', `${fNum(connected)} connected calls`);
  setText('prod-talk', `${talkHrs}h`);
  setText('prod-talk-sub', `Avg ${avgTalkSec}s per connect`);
  setText('prod-active', `${activeBDEs}/${totalBDEs || activeBDEs}`);
  setText('prod-active-sub', `active in period`);

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
    const { calls: gmDials, connects: gmConnects, uniqueDialled: gmUnique, talk: gmTalk } = prodAggregate(gmRows);
    const gmAvgCall = prodAvgCall(gmRows);
    const gmAvgCC = prodAvgCC(gmRows);
    const gmAvgTT = prodAvgTT(gmRows);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-name bold">${gmName}</td>
      <td class="col-num">${fNum(gmDials)}</td>
      <td class="col-num">${fNum(gmConnects)}</td>
      <td class="col-num">${fNum(gmUnique)}</td>
      <td class="col-num">${prodCPL(gmDials, gmUnique)}</td>
      <td class="col-num">${formatTalkHrs(gmTalk)}</td>
      <td class="col-num">${gmAvgCall}</td>
      <td class="col-num">${gmAvgCC}</td>
      <td class="col-num">${gmAvgTT}</td>
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
    const { calls: tlDials, connects: tlConnects, uniqueDialled: tlUnique, talk: tlTalk } = prodAggregate(tlRows);
    const tlAvgCall = prodAvgCall(tlRows);
    const tlAvgCC = prodAvgCC(tlRows);
    const tlAvgTT = prodAvgTT(tlRows);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-name bold">${tlName}</td>
      <td class="col-num">${fNum(tlDials)}</td>
      <td class="col-num">${fNum(tlConnects)}</td>
      <td class="col-num">${fNum(tlUnique)}</td>
      <td class="col-num">${prodCPL(tlDials, tlUnique)}</td>
      <td class="col-num">${formatTalkHrs(tlTalk)}</td>
      <td class="col-num">${tlAvgCall}</td>
      <td class="col-num">${tlAvgCC}</td>
      <td class="col-num">${tlAvgTT}</td>
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
    const bdeAvgCall = prodAvgCall(bdeRows);
    const bdeAvgCC = prodAvgCC(bdeRows);
    const bdeAvgTT = prodAvgTT(bdeRows);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-name bold">${owner}</td>
      <td class="col-num">${fNum(dials)}</td>
      <td class="col-num">${fNum(connects)}</td>
      <td class="col-num">${fNum(uniqueDialled)}</td>
      <td class="col-num">${prodCPL(dials, uniqueDialled)}</td>
      <td class="col-num">${formatTalkHrs(talk)}</td>
      <td class="col-num">${bdeAvgCall}</td>
      <td class="col-num">${bdeAvgCC}</td>
      <td class="col-num">${bdeAvgTT}</td>
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
function lrCountTokens(rows) {
  return rows.filter(r => isNonBlank(r.tokenDate)).length;
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

function lrFormatStageLabel(stage) {
  return stage === '(blank)' ? '(blank)' : stage.replace(/_/g, ' ');
}

function lrGetUniqueStages(rows) {
  const stageMap = {};
  rows.forEach(r => {
    const stage = (r.finalStage || '').trim() || '(blank)';
    stageMap[stage] = (stageMap[stage] || 0) + 1;
  });
  return Object.keys(stageMap).sort((a, b) => stageMap[b] - stageMap[a]);
}

function lrCountStages(rows) {
  const counts = {};
  rows.forEach(r => {
    const stage = (r.finalStage || '').trim() || '(blank)';
    counts[stage] = (counts[stage] || 0) + 1;
  });
  return counts;
}

function lrStickyClass(index, stickyCount) {
  if (index >= stickyCount) return '';
  const n = index + 1;
  const last = n === stickyCount ? ' sticky-col-last' : '';
  return `sticky-col sticky-col-${n}${last}`;
}

function lrStickyTh(label, index, stickyCount, typeClass) {
  const cls = [lrStickyClass(index, stickyCount), typeClass].filter(Boolean).join(' ');
  return `<th class="${cls}">${label}</th>`;
}

function lrStickyTd(content, index, stickyCount, typeClass) {
  const cls = [lrStickyClass(index, stickyCount), typeClass].filter(Boolean).join(' ');
  return `<td class="${cls}">${content}</td>`;
}

function lrStageColWidth(stage) {
  const label = lrFormatStageLabel(stage);
  return Math.max(100, Math.min(176, label.length * 8 + 32));
}

function lrTextColWidth() {
  return 260;
}

function lrApplyColgroup(table, stages, hasTextCol, textColWidth) {
  if (!table) return;
  const NAME_W = 168;
  const TOTAL_W = 104;
  const TEXT_W = textColWidth || 220;
  const TAIL_W = [88, 88, 120, 140];
  const stageWidths = stages.map(s => lrStageColWidth(s));

  let cg = table.querySelector('colgroup');
  if (!cg) {
    cg = document.createElement('colgroup');
    table.insertBefore(cg, table.firstChild);
  }
  cg.innerHTML = '';
  const addCol = (w) => {
    const col = document.createElement('col');
    col.style.width = `${w}px`;
    col.width = w;
    cg.appendChild(col);
  };

  addCol(NAME_W);
  addCol(TOTAL_W);
  if (hasTextCol) addCol(TEXT_W);
  stageWidths.forEach(w => addCol(w));
  TAIL_W.forEach(w => addCol(w));

  const totalW = NAME_W + TOTAL_W
    + (hasTextCol ? TEXT_W : 0)
    + stageWidths.reduce((s, w) => s + w, 0)
    + TAIL_W.reduce((s, w) => s + w, 0);

  table.style.width = `${totalW}px`;
  table.style.setProperty('--sticky-col-1-width', `${NAME_W}px`);
  table.style.setProperty('--sticky-col-2-width', `${TOTAL_W}px`);
  if (hasTextCol) {
    table.style.setProperty('--col-text-width', `${TEXT_W}px`);
  }
}

function lrBuildSummaryThead(fixedHeaders, stages, stickyCount, extraHeader) {
  const typeClasses = ['col-name', 'col-num'];
  const fixedHtml = fixedHeaders.map((h, i) => lrStickyTh(h.label, i, stickyCount, typeClasses[i] || 'col-num')).join('');
  const extraHtml = extraHeader ? `<th class="col-text">${extraHeader}</th>` : '';
  const stageHeaders = stages.map(s => {
    const label = lrFormatStageLabel(s);
    return `<th class="col-num" title="${label}">${label}</th>`;
  }).join('');
  const tailHeaders = `
    <th class="col-num">Token</th>
    <th class="col-num">Enrolled</th>
    <th class="col-pct">Token Conversion %</th>
    <th class="col-pct">Enrollment Conversion %</th>
  `;
  return `<tr>${fixedHtml}${extraHtml}${stageHeaders}${tailHeaders}</tr>`;
}

function lrStageHeaderHtml(stages) {
  return stages.map(s => `<th>${lrFormatStageLabel(s)}</th>`).join('');
}

function lrStageCellsHtml(counts, stages) {
  return stages.map(s => `<td class="col-num">${fNum(counts[s] || 0)}</td>`).join('');
}

function lrSummaryTailCells(total, tok, enr) {
  const tokConv = lrConvPct(tok, total);
  const enrConv = lrConvPct(enr, total);
  return `
    <td class="col-num">${fNum(tok)}</td>
    <td class="col-num">${fNum(enr)}</td>
    <td class="col-pct">${rateBadge(parseFloat(tokConv))}</td>
    <td class="col-pct">${rateBadge(parseFloat(enrConv))}</td>
  `;
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
  const uniqueStages = lrGetUniqueStages(lData);
  const stageColCount = uniqueStages.length;
  const programColW = lrTextColWidth();
  const tlColW = lrTextColWidth();

  // Dynamically update the thead headers to match all unique Final Stage values
  const gmTable = document.getElementById('lead-gm-table')?.closest('table');
  if (gmTable) {
    lrApplyColgroup(gmTable, uniqueStages, false);
    const thead = gmTable.querySelector('thead');
    if (thead) {
      thead.innerHTML = lrBuildSummaryThead(
        [{ label: 'GM Name' }, { label: 'Total Leads' }],
        uniqueStages,
        2
      );
    }
  }

  const tlTable = document.getElementById('lead-tl-table')?.closest('table');
  if (tlTable) {
    lrApplyColgroup(tlTable, uniqueStages, true, programColW);
    const thead = tlTable.querySelector('thead');
    if (thead) {
      thead.innerHTML = lrBuildSummaryThead(
        [{ label: 'TL Name' }, { label: 'Total Leads' }],
        uniqueStages,
        2,
        'Program'
      );
    }
  }

  const bdeTable = document.getElementById('lead-bde-table')?.closest('table');
  if (bdeTable) {
    lrApplyColgroup(bdeTable, uniqueStages, true, tlColW);
    const thead = bdeTable.querySelector('thead');
    if (thead) {
      thead.innerHTML = lrBuildSummaryThead(
        [{ label: 'BDE Name' }, { label: 'Total Leads' }],
        uniqueStages,
        2,
        'TL'
      );
    }
  }

  const total = lData.length;
  const interested = lrCountInterested(lData);
  const followup = lrCountFollowUp(lData);
  const enrolled = lrCountEnrolled(lData);
  const convRate = lrConvPct(enrolled, total);

  setText('lead-total', fNum(total));
  setText('lead-interested', fNum(interested));
  setText('lead-interested-sub', `${total ? ((interested / total) * 100).toFixed(0) : 0}% of total`);
  setText('lead-followup', fNum(followup));
  setText('lead-enrolled', fNum(enrolled));
  setText('lead-enrolled-sub', `${convRate}% conversion`);

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
    const gmStages = lrCountStages(gmLeads);
    const gmTok = lrCountTokens(gmLeads);
    const gmEnr = lrCountEnrolled(gmLeads);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      ${lrStickyTd(gmName, 0, 2, 'col-name bold')}
      ${lrStickyTd(fNum(gmTotal), 1, 2, 'col-num')}
      ${lrStageCellsHtml(gmStages, uniqueStages)}
      ${lrSummaryTailCells(gmTotal, gmTok, gmEnr)}
    `;
    gmTbody.appendChild(tr);
  });
  if (gmTbody.innerHTML === '') emptyRow(gmTbody, 2 + stageColCount + 4);

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
    const tlStages = lrCountStages(tlLeads);
    const tlTok = lrCountTokens(tlLeads);
    const tlEnr = lrCountEnrolled(tlLeads);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      ${lrStickyTd(tlName, 0, 2, 'col-name bold')}
      ${lrStickyTd(fNum(tlTotal), 1, 2, 'col-num')}
      <td class="col-text" title="${(program || '').replace(/"/g, '&quot;')}">${program || '—'}</td>
      ${lrStageCellsHtml(tlStages, uniqueStages)}
      ${lrSummaryTailCells(tlTotal, tlTok, tlEnr)}
    `;
    tlTbody.appendChild(tr);
  });
  if (tlTbody.innerHTML === '') emptyRow(tlTbody, 3 + stageColCount + 4);

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
      const bStages = lrCountStages(bdeLeads);
      const bTok = lrCountTokens(bdeLeads);
      const bEnr = lrCountEnrolled(bdeLeads);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        ${lrStickyTd(owner, 0, 2, 'col-name bold')}
        ${lrStickyTd(fNum(bTotal), 1, 2, 'col-num')}
        <td class="col-text" title="${(tl || '').replace(/"/g, '&quot;')}">${tl || '—'}</td>
        ${lrStageCellsHtml(bStages, uniqueStages)}
        ${lrSummaryTailCells(bTotal, bTok, bEnr)}
      `;
      tbody.appendChild(tr);
    });

  if (tbody.innerHTML === '') emptyRow(tbody, 3 + stageColCount + 4);
}

// ==========================================
// LEAD ANALYSIS VIEW — powered by live CSV
// ==========================================

// --- CSV parsing helpers ---
function parseCSV(text) {
  const matrix = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const input = String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    const n = input[i + 1];

    if (inQuotes) {
      if (c === '"' && n === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      field = '';
      if (row.some((cell) => cell.trim() !== '')) matrix.push(row);
      row = [];
    } else {
      field += c;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    if (row.some((cell) => cell.trim() !== '')) matrix.push(row);
  }

  if (matrix.length < 2) return [];

  const headers = matrix[0].map((h) => h.trim());
  return matrix.slice(1).map((vals) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (vals[idx] !== undefined ? vals[idx] : '').trim();
    });
    return obj;
  });
}

function mapCSVRow(obj) {
  return {
    email: obj['Email Address'] || '',
    source: obj['Lead Source'] || '',
    subSource: obj['Sub Source'] || '',
    createdOn: (obj['Created On'] || '').substring(0, 10),
    program: obj['Program'] || '',
    owner: obj['Owner (User Email)'] || '',
    status: obj['Status'] || '',
    stage: obj['Stage'] || '',
    campaign: obj['Campaign'] || '',
    tl: (obj['TL Name '] || obj['TL Name'] || '').trim(),
    gm: (obj['GM NAME'] || '').trim(),
    finalStage: obj['Final Stage'] || '',
    tokenDate: obj['Token Date'] || '',
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
    laLoaded = true;
    allowedGMsCache = null;

    if (CSV_LEAD_VIEWS.includes(activeView)) {
      if (!userSelectedDate) {
        const dates = laAllRows.map(r => r.createdOn).filter(Boolean).sort();
        if (dates.length) {
          activeFilters.dateFrom = dates[0];
          activeFilters.dateTo = dates[dates.length - 1];
          const dateFromEl = document.getElementById('date-from');
          const dateToEl = document.getElementById('date-to');
          if (dateFromEl) dateFromEl.value = activeFilters.dateFrom;
          if (dateToEl) dateToEl.value = activeFilters.dateTo;

          const filterDateEl = document.getElementById('filter-date');
          if (filterDateEl) filterDateEl.value = 'custom';
          lastAppliedDateOption = 'custom';
          updateDateDisplayLabel();
        }
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
    const current = activeFilters.gm;
    const gmNames = [...new Set(laAllRows.map(r => r.gm).filter(Boolean))].filter(g => isGMAllowed(g)).sort();
    gmSel.innerHTML = '';
    if (gmNames.length > 1) {
      gmSel.innerHTML = '<option value="ALL">All GMs</option>';
    }
    gmNames.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      gmSel.appendChild(opt);
    });

    const allowed = getAllowedGMs();
    if (allowed.length === 1) {
      activeFilters.gm = allowed[0];
    } else if (!gmNames.includes(current)) {
      activeFilters.gm = 'ALL';
    } else {
      activeFilters.gm = current;
    }
    gmSel.value = activeFilters.gm;

    const gmFilterGroup = document.getElementById('gm-filter-group');
    if (gmFilterGroup) {
      gmFilterGroup.style.display = allowed.length <= 1 ? 'none' : 'flex';
    }
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
  if (activeFilters.gm !== 'ALL') pool = pool.filter(r => r.gm === activeFilters.gm);
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
  if (activeFilters.gm !== 'ALL') pool = pool.filter(r => r.gm === activeFilters.gm);
  if (activeFilters.program !== 'ALL') pool = pool.filter(r => r.program === activeFilters.program);
  if (tlName && tlName !== 'ALL') pool = pool.filter(r => r.tl === tlName);
  const bdes = [...new Set(pool.map(r => r.owner).filter(Boolean))].sort();
  sel.innerHTML = '<option value="ALL">All BDEs</option>';
  bdes.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b;
    opt.textContent = emailToDisplayName(b);
    sel.appendChild(opt);
  });
  activeFilters.bde = bdes.includes(activeFilters.bde) ? activeFilters.bde : 'ALL';
  sel.value = activeFilters.bde;
}

// Global filters: GM, Program, Date (used for T1 dropdown options)
function getLAGlobalData() {
  return laAllRows.filter(r => {
    const inDate = (!activeFilters.dateFrom || r.createdOn >= activeFilters.dateFrom) &&
      (!activeFilters.dateTo || r.createdOn <= activeFilters.dateTo);
    const inGM = activeFilters.gm === 'ALL' ? isGMAllowed(r.gm) : r.gm === activeFilters.gm;
    const inProgram = activeFilters.program === 'ALL' || r.program === activeFilters.program;
    return inDate && inGM && inProgram;
  });
}

// --- Base data filtered by all global filters ---
function getBaseLAData() {
  return getLAGlobalData().filter(r => {
    const inTL = activeFilters.tl === 'ALL' || r.tl === activeFilters.tl;
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

  const campaignCard = document.getElementById('la-campaign-table-card');
  if (campaignCard) {
    if (currentUser === 'syed') {
      campaignCard.style.display = 'block';
    } else {
      campaignCard.style.display = 'none';
    }
  }

  // Dynamically update the thead headers to guarantee they match the columns, solving caching issues
  const t1Table = document.getElementById('la-table1-body')?.closest('table');
  if (t1Table) {
    const thead = t1Table.querySelector('thead');
    if (thead) {
      thead.innerHTML = `
        <tr>
          <th>Date</th>
          <th>Lead Count</th>
          <th>Tokens</th>
          <th>Enrolled</th>
          <th>Token Conversion %</th>
          <th>Enrollment Conversion %</th>
        </tr>
      `;
    }
  }

  const t2Table = document.getElementById('la-table2-body')?.closest('table');
  if (t2Table) {
    const thead = t2Table.querySelector('thead');
    if (thead) {
      thead.innerHTML = `
        <tr>
          <th>Date</th>
          <th>Lead Count</th>
          <th>Tokens</th>
          <th>Enrolled</th>
          <th>Token Conversion %</th>
          <th>Enrollment Conversion %</th>
        </tr>
      `;
    }
  }

  const t3Table = document.getElementById('la-table3-body')?.closest('table');
  if (t3Table) {
    const thead = t3Table.querySelector('thead');
    if (thead) {
      thead.innerHTML = `
        <tr>
          <th>Date</th>
          <th>Lead Count</th>
          <th>Tokens</th>
          <th>Enrolled</th>
          <th>Token Conversion %</th>
          <th>Enrollment Conversion %</th>
        </tr>
      `;
    }
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
  const totalLeads = base.length;
  const totalTokens = base.filter(r => isNonBlank(r.tokenDate)).length;
  const totalEnrolled = base.filter(r => isNonBlank(r.enrollmentDate)).length;
  setText('la-kpi-leads', fNum(totalLeads));
  setText('la-kpi-tokens', fNum(totalTokens));
  setText('la-kpi-enrolled', fNum(totalEnrolled));
  setText('la-kpi-cvr', totalLeads ? ((totalEnrolled / totalLeads) * 100).toFixed(2) + '%' : '0.00%');

  renderTable1();
  renderTable2();
  renderTable3();
}

// --- Table-level dropdown helpers (use live base pool) ---
function populateTableTLAndBDE(tlSelId, bdeSelId, basePool) {
  const tlSel = document.getElementById(tlSelId);
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
    opt.textContent = emailToDisplayName(name);
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
  const tlSel = document.getElementById('t1-filter-tl');
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
    opt.textContent = emailToDisplayName(email);
    bdeSel.appendChild(opt);
  });
  bdeSel.value = bdes.includes(selectedBDE) ? selectedBDE : 'ALL';
}

function onT1TLChange() {
  const tlSel = document.getElementById('t1-filter-tl');
  const bdeSel = document.getElementById('t1-filter-bde');
  if (tlSel && bdeSel) {
    const pool = getLAGlobalData().filter(r => tlSel.value === 'ALL' || r.tl === tlSel.value);
    const bdes = [...new Set(pool.map(r => r.owner).filter(Boolean))].sort();
    bdeSel.innerHTML = '<option value="ALL">All BDEs</option>';
    bdes.forEach(email => {
      const opt = document.createElement('option');
      opt.value = email;
      opt.textContent = emailToDisplayName(email);
      bdeSel.appendChild(opt);
    });
    bdeSel.value = 'ALL';
  }
  renderTable1();
}

function renderTable1() {
  const tlVal = document.getElementById('t1-filter-tl')?.value || 'ALL';
  const bdeVal = document.getElementById('t1-filter-bde')?.value || 'ALL';

  // Start from global GM/Program/Date/TL/BDE filters, then apply T1 TL + BDE
  const pool = getBaseLAData().filter(r =>
    (tlVal === 'ALL' || r.tl === tlVal) &&
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
    if (isNonBlank(r.tokenDate)) map[dateKey].tokens++;
    if (isNonBlank(r.enrollmentDate)) map[dateKey].enrolled++;
  });

  const dates = Object.keys(map).sort();
  let hasData = false;

  dates.forEach(date => {
    const row = map[date];
    if (row.leads === 0) return;
    hasData = true;
    const tokCvr = ((row.tokens / row.leads) * 100).toFixed(2);
    const enrCvr = ((row.enrolled / row.leads) * 100).toFixed(2);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="mono">${date}</td>
      <td class="mono">${fNum(row.leads)}</td>
      <td class="mono">${fNum(row.tokens)}</td>
      <td class="mono">${fNum(row.enrolled)}</td>
      <td class="mono">${tokCvr}%</td>
      <td class="mono">${enrCvr}%</td>
    `;
    tbody.appendChild(tr);
  });

  if (!hasData) emptyRow(tbody, 6);
}

function resetT1() {
  const tlSel = document.getElementById('t1-filter-tl');
  const bdeSel = document.getElementById('t1-filter-bde');
  if (tlSel) tlSel.value = 'ALL';
  if (bdeSel) bdeSel.value = 'ALL';
  populateT1Dropdowns();
  renderTable1();
}

// --- Table 2: Source-wise ---
function onT2TLChange() {
  const tlSel = document.getElementById('t2-filter-tl');
  const bdeSel = document.getElementById('t2-filter-bde');
  if (tlSel && bdeSel) {
    const pool = getBaseLAData().filter(r => tlSel.value === 'ALL' || r.tl === tlSel.value);
    const bdes = [...new Set(pool.map(r => r.owner).filter(Boolean))].sort();
    bdeSel.innerHTML = '<option value="ALL">All BDEs</option>';
    bdes.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = emailToDisplayName(name);
      bdeSel.appendChild(opt);
    });
    bdeSel.value = 'ALL';
  }
  renderTable2();
}

function renderTable2() {
  const base = getBaseLAData();
  const srcVal = document.getElementById('t2-filter-source')?.value || 'ALL';
  const tlVal = document.getElementById('t2-filter-tl')?.value || 'ALL';
  const bdeVal = document.getElementById('t2-filter-bde')?.value || 'ALL';
  const pool = base.filter(r =>
    (srcVal === 'ALL' || r.subSource === srcVal) &&
    (tlVal === 'ALL' || r.tl === tlVal) &&
    (bdeVal === 'ALL' || r.owner === bdeVal)
  );
  renderLATable('la-table2-body', pool, 'date');
}

function resetT2() {
  const srcSel = document.getElementById('t2-filter-source');
  const tlSel = document.getElementById('t2-filter-tl');
  const bdeSel = document.getElementById('t2-filter-bde');
  if (srcSel) srcSel.value = 'ALL';
  if (tlSel) tlSel.value = 'ALL';
  if (bdeSel) bdeSel.value = 'ALL';
  const base = getBaseLAData();
  populateTableSourceDropdown('t2-filter-source', base, 'subSource');
  populateTableTLAndBDE('t2-filter-tl', 't2-filter-bde', base);
  renderTable2();
}

// --- Table 3: Campaign-wise ---
function onT3TLChange() {
  const tlSel = document.getElementById('t3-filter-tl');
  const bdeSel = document.getElementById('t3-filter-bde');
  if (tlSel && bdeSel) {
    const pool = getBaseLAData().filter(r => tlSel.value === 'ALL' || r.tl === tlSel.value);
    const bdes = [...new Set(pool.map(r => r.owner).filter(Boolean))].sort();
    bdeSel.innerHTML = '<option value="ALL">All BDEs</option>';
    bdes.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = emailToDisplayName(name);
      bdeSel.appendChild(opt);
    });
    bdeSel.value = 'ALL';
  }
  renderTable3();
}

function renderTable3() {
  const base = getBaseLAData();
  const cmpVal = document.getElementById('t3-filter-campaign')?.value || 'ALL';
  const srcVal = document.getElementById('t3-filter-source')?.value || 'ALL';
  const tlVal = document.getElementById('t3-filter-tl')?.value || 'ALL';
  const bdeVal = document.getElementById('t3-filter-bde')?.value || 'ALL';
  const pool = base.filter(r =>
    (cmpVal === 'ALL' || r.campaign === cmpVal) &&
    (srcVal === 'ALL' || r.source === srcVal) &&
    (tlVal === 'ALL' || r.tl === tlVal) &&
    (bdeVal === 'ALL' || r.owner === bdeVal)
  );
  renderLATable('la-table3-body', pool, 'date');
}

function resetT3() {
  const cmpSel = document.getElementById('t3-filter-campaign');
  const srcSel = document.getElementById('t3-filter-source');
  const tlSel = document.getElementById('t3-filter-tl');
  const bdeSel = document.getElementById('t3-filter-bde');
  if (cmpSel) cmpSel.value = 'ALL';
  if (srcSel) srcSel.value = 'ALL';
  if (tlSel) tlSel.value = 'ALL';
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
    if (groupBy === 'source') key = r.source || '(unknown)';
    else if (groupBy === 'subSource') key = r.subSource || '(unknown)';
    else if (groupBy === 'campaign') key = r.campaign || '(unknown)';
    else key = r.createdOn || '(unknown)';

    if (!map[key]) map[key] = { leads: 0, tokens: 0, enrolled: 0 };
    map[key].leads++;
    if (isNonBlank(r.tokenDate)) map[key].tokens++;
    if (isNonBlank(r.enrollmentDate)) map[key].enrolled++;
  });

  const keys = Object.keys(map).sort();
  let hasData = false;

  keys.forEach(key => {
    const row = map[key];
    if (row.leads === 0) return;
    hasData = true;
    const tokCvr = ((row.tokens / row.leads) * 100).toFixed(2);
    const enrCvr = ((row.enrolled / row.leads) * 100).toFixed(2);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="mono">${key}</td>
      <td class="mono">${fNum(row.leads)}</td>
      <td class="mono">${fNum(row.tokens)}</td>
      <td class="mono">${fNum(row.enrolled)}</td>
      <td class="mono">${tokCvr}%</td>
      <td class="mono">${enrCvr}%</td>
    `;
    tbody.appendChild(tr);
  });

  if (!hasData) emptyRow(tbody, 6);
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
  if (!restoreSession()) {
    showLoginScreen();
    const usernameInput = document.getElementById('login-username');
    if (usernameInput) usernameInput.focus();
  }
});

// ==========================================
// DATE FILTER PRESET & POPUP HANDLERS
// ==========================================
function onDateOptionChange() {
  const opt = document.getElementById('filter-date').value;
  if (opt === 'custom') {
    showCustomDatePopup();
  } else {
    applyDatePreset(opt);
  }
}

function applyDatePreset(opt) {
  const today = new Date();
  let fromDate = '';
  let toDate = '';

  const toISODate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  switch (opt) {
    case 'today':
      fromDate = toISODate(today);
      toDate = toISODate(today);
      break;
    case 'yesterday':
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      fromDate = toISODate(yesterday);
      toDate = toISODate(yesterday);
      break;
    case 'last7days':
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(today.getDate() - 6);
      fromDate = toISODate(sevenDaysAgo);
      toDate = toISODate(today);
      break;
    case 'thismonth':
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      fromDate = toISODate(startOfMonth);
      toDate = toISODate(endOfMonth);
      break;
    case 'lastmonth':
      const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      fromDate = toISODate(startOfLastMonth);
      toDate = toISODate(endOfLastMonth);
      break;
    case 'last3months':
      const startOfThreeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1);
      const endOfCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      fromDate = toISODate(startOfThreeMonthsAgo);
      toDate = toISODate(endOfCurrentMonth);
      break;
    default:
      return;
  }

  const dateFromEl = document.getElementById('date-from');
  const dateToEl = document.getElementById('date-to');
  if (dateFromEl) dateFromEl.value = fromDate;
  if (dateToEl) dateToEl.value = toDate;
  activeFilters.dateFrom = fromDate;
  activeFilters.dateTo = toDate;
  userSelectedDate = true;
  lastAppliedDateOption = opt;
  updateDateDisplayLabel();
  applyFilters();
}

function showCustomDatePopup() {
  const popup = document.getElementById('custom-date-popup');
  if (!popup) return;

  // Pre-populate with currently active filters
  const dateFromEl = document.getElementById('date-from');
  const dateToEl = document.getElementById('date-to');
  if (dateFromEl) dateFromEl.value = activeFilters.dateFrom;
  if (dateToEl) dateToEl.value = activeFilters.dateTo;

  popup.style.display = 'block';
}

function closeCustomDatePopup(apply) {
  const popup = document.getElementById('custom-date-popup');
  if (!popup) return;

  if (apply) {
    const fromVal = document.getElementById('date-from').value;
    const toVal = document.getElementById('date-to').value;
    if (!fromVal || !toVal) {
      alert('Please select both From and To dates.');
      return;
    }
    activeFilters.dateFrom = fromVal;
    activeFilters.dateTo = toVal;
    userSelectedDate = true;
    lastAppliedDateOption = 'custom';
    updateDateDisplayLabel();
    applyFilters();
  } else {
    const filterDateEl = document.getElementById('filter-date');
    if (filterDateEl) filterDateEl.value = lastAppliedDateOption;
  }

  popup.style.display = 'none';
}

function updateDateDisplayLabel() {
  const label = document.getElementById('date-display-label');
  if (!label) return;

  const from = activeFilters.dateFrom;
  const to = activeFilters.dateTo;
  if (from && to) {
    label.textContent = `${from} to ${to}`;
    label.style.display = 'inline-block';
  } else {
    label.textContent = '';
    label.style.display = 'none';
  }
}

// Click outside to dismiss popup
document.addEventListener('click', (event) => {
  const wrapper = document.querySelector('.date-select-wrapper');
  const popup = document.getElementById('custom-date-popup');
  if (popup && popup.style.display === 'block' && wrapper && !wrapper.contains(event.target)) {
    closeCustomDatePopup(false);
  }
});
