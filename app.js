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
  program: 'ALL',
  tl: 'ALL',
  bde: 'ALL',
  dateFrom: '2026-05-01',
  dateTo: '2026-05-28'
};

let charts = {};   // chart.js instances

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
  const allTLs = currentUser ? USERS[currentUser].tls : [];
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
  activeFilters = { program: 'ALL', tl: 'ALL', bde: 'ALL', dateFrom: '2026-05-01', dateTo: '2026-05-28' };

  document.getElementById('app-layout').style.display = 'none';
  document.getElementById('login-overlay').style.display = 'flex';
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').classList.remove('show');
}

// ==========================================
// DASHBOARD INIT (after login)
// ==========================================
function initDashboard() {
  const user = USERS[currentUser];

  // Set GM name label in top navbar
  document.getElementById('gm-dashboard-label').textContent = user.displayName + "'s Dashboard";

  // Sidebar user info
  document.getElementById('sidebar-avatar').textContent = user.displayName.charAt(0).toUpperCase();
  document.getElementById('sidebar-username').textContent = user.displayName;

  // Populate sidebar team list
  const teamList = document.getElementById('sidebar-team-list');
  teamList.innerHTML = '';
  user.tls.forEach(tl => {
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

  // Reset all filters for clean state
  activeFilters.program = 'ALL';
  activeFilters.tl = 'ALL';
  activeFilters.bde = 'ALL';

  // Populate Program filter (all programs this GM manages)
  populateProgramFilter();

  // Populate TL filter (all TLs under this GM)
  populateTLFilter();

  // Populate BDE filter (all BDEs)
  populateBDEFilter('ALL');

  // Set dates
  document.getElementById('date-from').value = activeFilters.dateFrom;
  document.getElementById('date-to').value   = activeFilters.dateTo;

  // Show overview
  switchView('overview');
}

// Populate Program filter for logged-in GM
function populateProgramFilter() {
  const user = USERS[currentUser];
  const progSelect = document.getElementById('filter-program');
  progSelect.innerHTML = '<option value="ALL">All Programs</option>';
  user.tls.forEach(tl => {
    const opt = document.createElement('option');
    opt.value = tl.program;
    opt.textContent = tl.program;
    progSelect.appendChild(opt);
  });
  progSelect.value = activeFilters.program;
}

// Populate TL filter — scoped to selected program
function populateTLFilter() {
  const user = USERS[currentUser];
  const tlSelect = document.getElementById('filter-tl');
  tlSelect.innerHTML = '<option value="ALL">All TLs</option>';
  const scopedTLs = activeFilters.program === 'ALL'
    ? user.tls
    : user.tls.filter(tl => tl.program === activeFilters.program);
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
  const prevProgram = activeFilters.program;
  const prevTL      = activeFilters.tl;

  activeFilters.program  = document.getElementById('filter-program').value;
  activeFilters.tl       = document.getElementById('filter-tl').value;
  activeFilters.bde      = document.getElementById('filter-bde').value;
  activeFilters.dateFrom = document.getElementById('date-from').value;
  activeFilters.dateTo   = document.getElementById('date-to').value;

  // Program changed → reset TL & BDE, repopulate both dropdowns
  if (activeFilters.program !== prevProgram) {
    activeFilters.tl  = 'ALL';
    activeFilters.bde = 'ALL';
    populateTLFilter();
    populateBDEFilter('ALL');
    document.getElementById('filter-tl').value  = 'ALL';
    document.getElementById('filter-bde').value = 'ALL';
  }
  // TL changed → reset BDE, repopulate BDE dropdown
  else if (activeFilters.tl !== prevTL) {
    activeFilters.bde = 'ALL';
    populateBDEFilter(activeFilters.tl);
    document.getElementById('filter-bde').value = 'ALL';
  }

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
  activeView = viewId;

  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById(`nav-${viewId}`);
  if (navEl) navEl.classList.add('active');

  document.querySelectorAll('.viewport-section').forEach(el => el.classList.remove('active'));
  const sectionEl = document.getElementById(`view-${viewId}`);
  if (sectionEl) sectionEl.classList.add('active');

  document.getElementById('page-title').textContent = VIEW_TITLES[viewId] || viewId;

  document.getElementById('sidebar').classList.remove('mobile-open');
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
// OVERVIEW VIEW
// ==========================================
function renderOverview() {
  const pData = filteredPayments();
  const lData = filteredLeads();
  const cData = filteredCalls();

  const myTLs = getMyTLs().filter(tl =>
    activeFilters.tl === 'ALL' || tl.name === activeFilters.tl
  );

  const enrollments = pData.filter(p => p.type === 'Full Enrollment').length;
  const tokens      = pData.filter(p => p.type === 'Token Booking').length;
  const totalRev    = pData.reduce((s, p) => s + p.amount, 0);

  const overallTarget = myTLs.reduce((s, tl) => s + tl.target, 0);
  const targetPct     = overallTarget ? ((totalRev / overallTarget) * 100).toFixed(1) : 0;

  // Update the top 4 KPI cards
  setText('ov-enrollments', fNum(enrollments));
  setText('ov-enrollments-sub', `${tokens} token bookings`);
  setText('ov-tokens', fNum(tokens));
  setText('ov-revenue', fCurrency(totalRev));
  setText('ov-target-pct', `${targetPct}%`);
  setText('ov-target-sub', `Target: ${fCurrency(overallTarget)}`);

  // Render Target (Unit wise)
  const targetUnitsContainer = document.getElementById('ov-target-units');
  targetUnitsContainer.innerHTML = '';

  // Determine what units to show based on filters
  let units = [];
  if (activeFilters.bde !== 'ALL') {
    // Show only the selected BDA as a unit
    const bde = activeFilters.bde;
    const tl = ALL_TLS.find(t => t.bdes.includes(bde));
    const bdeTarget = tl ? (tl.target / tl.bdes.length) : 0;
    const bdePays = pData.filter(p => p.bde === bde);
    const bdeAchieved = bdePays.reduce((sum, p) => sum + p.amount, 0);
    units.push({
      name: `BDA: ${bde}`,
      subText: tl ? `TL ${tl.name} | ${tl.program}` : '',
      target: bdeTarget,
      achieved: bdeAchieved
    });
  } else if (activeFilters.tl !== 'ALL') {
    // Show only the selected TL as a unit
    const tlName = activeFilters.tl;
    const tl = ALL_TLS.find(t => t.name === tlName);
    const tlTarget = tl ? tl.target : 0;
    const tlPays = pData.filter(p => p.tl === tlName);
    const tlAchieved = tlPays.reduce((sum, p) => sum + p.amount, 0);
    units.push({
      name: `TL: ${tlName}`,
      subText: tl ? tl.program : '',
      target: tlTarget,
      achieved: tlAchieved
    });
  } else {
    // Show all active TLs under the GM as units
    myTLs.forEach(tl => {
      const tlPays = pData.filter(p => p.tl === tl.name);
      const tlAchieved = tlPays.reduce((sum, p) => sum + p.amount, 0);
      units.push({
        name: `${tl.program}`,
        subText: `TL ${tl.name}`,
        target: tl.target,
        achieved: tlAchieved
      });
    });
  }

  units.forEach((unit, idx) => {
    const pct = unit.target ? ((unit.achieved / unit.target) * 100) : 0;
    const pctStr = pct.toFixed(1);
    const accentClass = idx % 3 === 0 ? 'accent-indigo' : idx % 3 === 1 ? 'accent-emerald' : 'accent-purple';

    const card = document.createElement('div');
    card.className = `target-card ${accentClass}`;
    card.innerHTML = `
      <div class="target-card-header">
        <span class="target-card-title">${unit.name}</span>
        <span class="target-card-sub">${unit.subText}</span>
      </div>
      <div class="target-progress-wrap">
        <div class="target-progress-bar">
          <div class="target-progress-fill" style="width: ${Math.min(pct, 100)}%"></div>
        </div>
        <div class="target-progress-stats">
          <span>${fCurrency(unit.achieved)} / ${fCurrency(unit.target)}</span>
          <span style="color: ${pct >= 100 ? 'var(--emerald)' : 'var(--text-secondary)'}">${pctStr}%</span>
        </div>
      </div>
    `;
    targetUnitsContainer.appendChild(card);
  });

  if (units.length === 0) {
    targetUnitsContainer.innerHTML = '<div class="empty-row" style="grid-column: 1/-1;">No active units found</div>';
  }

  // Render Lead & Input Metrics
  // Lead Metrics
  const totalLeads = lData.length;
  const leadTokens = pData.filter(p => p.type === 'Token Booking').length;
  const enrolledLeads = lData.filter(l => l.stage === 'Enrolled').length;
  const cvr = totalLeads ? ((enrolledLeads / totalLeads) * 100).toFixed(1) : '0.0';

  setText('ov-lead-total', fNum(totalLeads));
  setText('ov-lead-tokens', fNum(leadTokens));
  setText('ov-lead-cvr', `${cvr}%`);

  // Input Metrics
  const totalCalls = cData.reduce((s, c) => s + c.calls, 0);
  const connected = cData.reduce((s, c) => s + c.connected, 0);
  const talkMins = cData.reduce((s, c) => s + c.talkTimeMin, 0);
  const totalBdeDays = cData.length;

  const avgDialled = totalBdeDays ? Math.round(totalCalls / totalBdeDays) : 0;
  const avgConnected = totalBdeDays ? Math.round(connected / totalBdeDays) : 0;
  const avgTalkTime = connected ? Math.round((talkMins * 60) / connected) : 0;

  // Format Avg Talk Time into m s
  let talkTimeStr = '0s';
  if (avgTalkTime >= 60) {
    talkTimeStr = `${Math.floor(avgTalkTime / 60)}m ${avgTalkTime % 60}s`;
  } else {
    talkTimeStr = `${avgTalkTime}s`;
  }

  setText('ov-input-dialled', fNum(avgDialled));
  setText('ov-input-connected', fNum(avgConnected));
  setText('ov-input-talktime', talkTimeStr);

  // Render Top 3 BDAs
  const bdaPodiumContainer = document.getElementById('ov-podium-bdas');
  bdaPodiumContainer.innerHTML = '';

  const activeBdes = getMyBDEs(activeFilters.tl).filter(b =>
    activeFilters.bde === 'ALL' || b === activeFilters.bde
  );

  const bdaRankings = activeBdes.map(bde => {
    const bdePays = pData.filter(p => p.bde === bde);
    const revenue = bdePays.reduce((sum, p) => sum + p.amount, 0);
    const tl = ALL_TLS.find(t => t.bdes.includes(bde));
    return {
      name: bde,
      revenue,
      program: tl ? tl.program : 'N/A'
    };
  }).sort((a, b) => b.revenue - a.revenue);

  // Take top 3 with positive revenue
  const topBDAs = bdaRankings.filter(b => b.revenue > 0).slice(0, 3);

  if (topBDAs.length > 0) {
    topBDAs.forEach((bda, index) => {
      const rank = index + 1;
      const card = document.createElement('div');
      card.className = `podium-card rank-${rank}`;
      card.innerHTML = `
        <div class="podium-rank-badge">${rank}</div>
        <div class="podium-bda-name" title="${bda.name}">${bda.name}</div>
        <div class="podium-bda-program">${bda.program}</div>
        <div class="podium-bda-rev">${fCurrency(bda.revenue)}</div>
      `;
      bdaPodiumContainer.appendChild(card);
    });
  } else {
    bdaPodiumContainer.innerHTML = '<div class="empty-row" style="width: 100%">No revenue data for BDAs in this period</div>';
  }

  // Render GM, TL, BDA Performance Tables
  // GM Performance Table
  const gmTbody = document.getElementById('ov-gm-table');
  gmTbody.innerHTML = '';
  if (currentUser) {
    const user = USERS[currentUser];
    const gmName = user.displayName;
    const gmPays = pData;
    const gmTokens = gmPays.filter(p => p.type === 'Token Booking').reduce((s, p) => s + p.amount, 0);
    const gmEnrolls = gmPays.filter(p => p.type === 'Full Enrollment').reduce((s, p) => s + p.amount, 0);
    const gmAchieved = gmTokens + gmEnrolls;

    // GM target scales with filtered TLs
    const gmTarget = myTLs.reduce((s, tl) => {
      if (activeFilters.bde !== 'ALL') {
        if (tl.bdes.includes(activeFilters.bde)) {
          return s + (tl.target / tl.bdes.length);
        }
        return s;
      }
      return s + tl.target;
    }, 0);

    const gmPct = gmTarget ? ((gmAchieved / gmTarget) * 100).toFixed(1) : 0;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="bold">GM ${gmName}</td>
      <td class="mono">${fCurrency(gmTarget)}</td>
      <td class="mono">${fCurrency(gmTokens)}</td>
      <td class="mono">${fCurrency(gmEnrolls)}</td>
    `;
    gmTbody.appendChild(tr);
  }

  // TL Performance Table
  const tlTbody = document.getElementById('ov-tl-perf-table');
  tlTbody.innerHTML = '';
  myTLs.forEach(tl => {
    const tlPays = pData.filter(p => p.tl === tl.name);
    const tlTokens = tlPays.filter(p => p.type === 'Token Booking').reduce((s, p) => s + p.amount, 0);
    const tlEnrolls = tlPays.filter(p => p.type === 'Full Enrollment').reduce((s, p) => s + p.amount, 0);
    const tlAchieved = tlTokens + tlEnrolls;

    let tlTarget = tl.target;
    if (activeFilters.bde !== 'ALL') {
      if (tl.bdes.includes(activeFilters.bde)) {
        tlTarget = tl.target / tl.bdes.length;
      } else {
        tlTarget = 0;
      }
    }

    if (tlTarget > 0 || tlAchieved > 0) {
      const tlPct = tlTarget ? ((tlAchieved / tlTarget) * 100).toFixed(1) : 0;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="bold">TL ${tl.name}</td>
        <td class="mono">${fCurrency(tlTarget)}</td>
        <td class="mono">${fCurrency(tlTokens)}</td>
        <td class="mono">${fCurrency(tlEnrolls)}</td>
      `;
      tlTbody.appendChild(tr);
    }
  });
  if (tlTbody.innerHTML === '') emptyRow(tlTbody, 4);

  // BDA Performance Table
  const bdaTbody = document.getElementById('ov-bda-table');
  bdaTbody.innerHTML = '';
  myTLs.forEach(tl => {
    const bdesToShow = activeFilters.bde !== 'ALL'
      ? tl.bdes.filter(b => b === activeFilters.bde)
      : tl.bdes;

    bdesToShow.forEach(bde => {
      const bdePays = pData.filter(p => p.bde === bde);
      const bdeTokens = bdePays.filter(p => p.type === 'Token Booking').reduce((s, p) => s + p.amount, 0);
      const bdeEnrolls = bdePays.filter(p => p.type === 'Full Enrollment').reduce((s, p) => s + p.amount, 0);
      const bdeAchieved = bdeTokens + bdeEnrolls;
      const bdeTarget = tl.target / tl.bdes.length;
      const bdePct = bdeTarget ? ((bdeAchieved / bdeTarget) * 100).toFixed(1) : 0;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="bold">${bde}</td>
        <td class="mono">${fCurrency(bdeTarget)}</td>
        <td class="mono">${fCurrency(bdeTokens)}</td>
        <td class="mono">${fCurrency(bdeEnrolls)}</td>
      `;
      bdaTbody.appendChild(tr);
    });
  });
  if (bdaTbody.innerHTML === '') emptyRow(bdaTbody, 4);

  // Render Date-wise Token & Enrollment Table
  const dateTbody = document.getElementById('ov-date-table');
  dateTbody.innerHTML = '';

  const dateMap = {};
  let d = new Date(activeFilters.dateFrom);
  const end = new Date(activeFilters.dateTo);
  while (d <= end) {
    dateMap[d.toISOString().split('T')[0]] = { tokens: 0, tokenAmt: 0, enrolls: 0, enrollAmt: 0 };
    d.setDate(d.getDate() + 1);
  }

  pData.forEach(p => {
    if (dateMap[p.date]) {
      if (p.type === 'Token Booking') {
        dateMap[p.date].tokens++;
        dateMap[p.date].tokenAmt += p.amount;
      } else if (p.type === 'Full Enrollment') {
        dateMap[p.date].enrolls++;
        dateMap[p.date].enrollAmt += p.amount;
      }
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
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });

      const tokenDisplay = info.tokens > 0 ? `${info.tokens} (${fCurrency(info.tokenAmt)})` : '0';
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

  if (!hasDateData) {
    emptyRow(dateTbody, 3);
  }
}

// ==========================================
// REVENUE VIEW
// ==========================================
function renderRevenue() {
  const pData = filteredPayments();
  const cData = filteredCalls();
  const lData = filteredLeads();

  const myTLs = getMyTLs().filter(tl =>
    activeFilters.tl === 'ALL' || tl.name === activeFilters.tl
  );

  const totalRev  = pData.reduce((s, p) => s + p.amount, 0);
  const fullRev   = pData.filter(p => p.type === 'Full Enrollment').reduce((s, p) => s + p.amount, 0);
  const tokenRev  = pData.filter(p => p.type === 'Token Booking').reduce((s, p)  => s + p.amount, 0);
  const fullCount  = pData.filter(p => p.type === 'Full Enrollment').length;
  const tokenCount = pData.filter(p => p.type === 'Token Booking').length;

  const overallTarget = myTLs.reduce((s, tl) => s + tl.target, 0);
  const targetPct     = overallTarget ? ((totalRev / overallTarget) * 100).toFixed(1) : 0;

  // Update top 4 KPI cards
  setText('rev-total', fCurrency(totalRev));
  setText('rev-full',  fCurrency(fullRev));
  setText('rev-full-sub', `${fullCount} full payment${fullCount !== 1 ? 's' : ''}`);
  setText('rev-tokens', fCurrency(tokenRev));
  setText('rev-tokens-sub', `${tokenCount} token booking${tokenCount !== 1 ? 's' : ''}`);
  setText('rev-target-pct', `${targetPct}%`);
  setText('rev-target-sub', `Goal: ${fCurrency(overallTarget)}`);

  // Render Target (Unit wise)
  const targetUnitsContainer = document.getElementById('rev-target-units');
  targetUnitsContainer.innerHTML = '';

  let units = [];
  if (activeFilters.bde !== 'ALL') {
    const bde = activeFilters.bde;
    const tl = ALL_TLS.find(t => t.bdes.includes(bde));
    const bdeTarget = tl ? (tl.target / tl.bdes.length) : 0;
    const bdePays = pData.filter(p => p.bde === bde);
    const bdeAchieved = bdePays.reduce((sum, p) => sum + p.amount, 0);
    units.push({
      name: `BDA: ${bde}`,
      subText: tl ? `TL ${tl.name} | ${tl.program}` : '',
      target: bdeTarget,
      achieved: bdeAchieved
    });
  } else if (activeFilters.tl !== 'ALL') {
    const tlName = activeFilters.tl;
    const tl = ALL_TLS.find(t => t.name === tlName);
    const tlTarget = tl ? tl.target : 0;
    const tlPays = pData.filter(p => p.tl === tlName);
    const tlAchieved = tlPays.reduce((sum, p) => sum + p.amount, 0);
    units.push({
      name: `TL: ${tlName}`,
      subText: tl ? tl.program : '',
      target: tlTarget,
      achieved: tlAchieved
    });
  } else {
    myTLs.forEach(tl => {
      const tlPays = pData.filter(p => p.tl === tl.name);
      const tlAchieved = tlPays.reduce((sum, p) => sum + p.amount, 0);
      units.push({
        name: `${tl.program}`,
        subText: `TL ${tl.name}`,
        target: tl.target,
        achieved: tlAchieved
      });
    });
  }

  units.forEach((unit, idx) => {
    const pct = unit.target ? ((unit.achieved / unit.target) * 100) : 0;
    const pctStr = pct.toFixed(1);
    const accentClass = idx % 3 === 0 ? 'accent-indigo' : idx % 3 === 1 ? 'accent-emerald' : 'accent-purple';

    const card = document.createElement('div');
    card.className = `target-card ${accentClass}`;
    card.innerHTML = `
      <div class="target-card-header">
        <span class="target-card-title">${unit.name}</span>
        <span class="target-card-sub">${unit.subText}</span>
      </div>
      <div class="target-progress-wrap">
        <div class="target-progress-bar">
          <div class="target-progress-fill" style="width: ${Math.min(pct, 100)}%"></div>
        </div>
        <div class="target-progress-stats">
          <span>${fCurrency(unit.achieved)} / ${fCurrency(unit.target)}</span>
          <span style="color: ${pct >= 100 ? 'var(--emerald)' : 'var(--text-secondary)'}">${pctStr}%</span>
        </div>
      </div>
    `;
    targetUnitsContainer.appendChild(card);
  });

  if (units.length === 0) {
    targetUnitsContainer.innerHTML = '<div class="empty-row" style="grid-column: 1/-1;">No active units found</div>';
  }

  // Render Lead Revenue Metrics
  const totalBookingsCount = fullCount + tokenCount;
  const avgTicketSize = totalBookingsCount ? Math.round(totalRev / totalBookingsCount) : 0;

  setText('rev-lead-tokens', fCurrency(tokenRev));
  setText('rev-lead-enrollments', fCurrency(fullRev));
  setText('rev-lead-avg-ticket', fCurrency(avgTicketSize));

  // Render Input Efficiency Metrics
  const totalCalls = cData.reduce((s, c) => s + c.calls, 0);
  const talkMins = cData.reduce((s, c) => s + c.talkTimeMin, 0);

  const activeBdes = getMyBDEs(activeFilters.tl).filter(b =>
    activeFilters.bde === 'ALL' || b === activeFilters.bde
  );
  const activeBdesCount = activeBdes.length;

  const revPerBde = activeBdesCount ? Math.round(totalRev / activeBdesCount) : 0;
  const revPerDial = totalCalls ? Math.round(totalRev / totalCalls) : 0;
  const revPerTalkMin = talkMins ? Math.round(totalRev / talkMins) : 0;

  setText('rev-input-rev-bde', fCurrency(revPerBde));
  setText('rev-input-rev-dial', fCurrency(revPerDial));
  setText('rev-input-rev-talk', fCurrency(revPerTalkMin));

  // Render Top 3 BDAs
  const bdaPodiumContainer = document.getElementById('rev-podium-bdas');
  bdaPodiumContainer.innerHTML = '';

  const bdaRankings = activeBdes.map(bde => {
    const bdePays = pData.filter(p => p.bde === bde);
    const revenue = bdePays.reduce((sum, p) => sum + p.amount, 0);
    const tl = ALL_TLS.find(t => t.bdes.includes(bde));
    return {
      name: bde,
      revenue,
      program: tl ? tl.program : 'N/A'
    };
  }).sort((a, b) => b.revenue - a.revenue);

  const topBDAs = bdaRankings.filter(b => b.revenue > 0).slice(0, 3);

  if (topBDAs.length > 0) {
    topBDAs.forEach((bda, index) => {
      const rank = index + 1;
      const card = document.createElement('div');
      card.className = `podium-card rank-${rank}`;
      card.innerHTML = `
        <div class="podium-rank-badge">${rank}</div>
        <div class="podium-bda-name" title="${bda.name}">${bda.name}</div>
        <div class="podium-bda-program">${bda.program}</div>
        <div class="podium-bda-rev">${fCurrency(bda.revenue)}</div>
      `;
      bdaPodiumContainer.appendChild(card);
    });
  } else {
    bdaPodiumContainer.innerHTML = '<div class="empty-row" style="width: 100%">No revenue data for BDAs in this period</div>';
  }

  // Render GM, TL, BDA Performance Tables
  // GM Performance Table
  const gmTbody = document.getElementById('rev-gm-table');
  gmTbody.innerHTML = '';
  if (currentUser) {
    const user = USERS[currentUser];
    const gmName = user.displayName;
    const gmPays = pData;
    const gmTokens = gmPays.filter(p => p.type === 'Token Booking').reduce((s, p) => s + p.amount, 0);
    const gmEnrolls = gmPays.filter(p => p.type === 'Full Enrollment').reduce((s, p) => s + p.amount, 0);
    const gmAchieved = gmTokens + gmEnrolls;

    const gmTarget = myTLs.reduce((s, tl) => {
      if (activeFilters.bde !== 'ALL') {
        if (tl.bdes.includes(activeFilters.bde)) {
          return s + (tl.target / tl.bdes.length);
        }
        return s;
      }
      return s + tl.target;
    }, 0);

    const gmPct = gmTarget ? ((gmAchieved / gmTarget) * 100).toFixed(1) : 0;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="bold">GM ${gmName}</td>
      <td class="mono">${fCurrency(gmTarget)}</td>
      <td class="mono">${fCurrency(gmTokens)}</td>
      <td class="mono">${fCurrency(gmEnrolls)}</td>
    `;
    gmTbody.appendChild(tr);
  }

  // TL Performance Table
  const tlTbody = document.getElementById('rev-tl-perf-table');
  tlTbody.innerHTML = '';
  myTLs.forEach(tl => {
    const tlPays = pData.filter(p => p.tl === tl.name);
    const tlTokens = tlPays.filter(p => p.type === 'Token Booking').reduce((s, p) => s + p.amount, 0);
    const tlEnrolls = tlPays.filter(p => p.type === 'Full Enrollment').reduce((s, p) => s + p.amount, 0);
    const tlAchieved = tlTokens + tlEnrolls;

    let tlTarget = tl.target;
    if (activeFilters.bde !== 'ALL') {
      if (tl.bdes.includes(activeFilters.bde)) {
        tlTarget = tl.target / tl.bdes.length;
      } else {
        tlTarget = 0;
      }
    }

    if (tlTarget > 0 || tlAchieved > 0) {
      const tlPct = tlTarget ? ((tlAchieved / tlTarget) * 100).toFixed(1) : 0;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="bold">TL ${tl.name}</td>
        <td class="mono">${fCurrency(tlTarget)}</td>
        <td class="mono">${fCurrency(tlTokens)}</td>
        <td class="mono">${fCurrency(tlEnrolls)}</td>
      `;
      tlTbody.appendChild(tr);
    }
  });
  if (tlTbody.innerHTML === '') emptyRow(tlTbody, 4);

  // BDA Performance Table
  const bdaTbody = document.getElementById('rev-bda-table');
  bdaTbody.innerHTML = '';
  myTLs.forEach(tl => {
    const bdesToShow = activeFilters.bde !== 'ALL'
      ? tl.bdes.filter(b => b === activeFilters.bde)
      : tl.bdes;

    bdesToShow.forEach(bde => {
      const bdePays = pData.filter(p => p.bde === bde);
      const bdeTokens = bdePays.filter(p => p.type === 'Token Booking').reduce((s, p) => s + p.amount, 0);
      const bdeEnrolls = bdePays.filter(p => p.type === 'Full Enrollment').reduce((s, p) => s + p.amount, 0);
      const bdeAchieved = bdeTokens + bdeEnrolls;
      const bdeTarget = tl.target / tl.bdes.length;
      const bdePct = bdeTarget ? ((bdeAchieved / bdeTarget) * 100).toFixed(1) : 0;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="bold">${bde}</td>
        <td class="mono">${fCurrency(bdeTarget)}</td>
        <td class="mono">${fCurrency(bdeTokens)}</td>
        <td class="mono">${fCurrency(bdeEnrolls)}</td>
      `;
      bdaTbody.appendChild(tr);
    });
  });
  if (bdaTbody.innerHTML === '') emptyRow(bdaTbody, 4);

  // Render Date-wise Token & Enrollment Table
  const dateTbody = document.getElementById('rev-date-table');
  dateTbody.innerHTML = '';

  const dateMap = {};
  let d = new Date(activeFilters.dateFrom);
  const end = new Date(activeFilters.dateTo);
  while (d <= end) {
    dateMap[d.toISOString().split('T')[0]] = { tokens: 0, tokenAmt: 0, enrolls: 0, enrollAmt: 0 };
    d.setDate(d.getDate() + 1);
  }

  pData.forEach(p => {
    if (dateMap[p.date]) {
      if (p.type === 'Token Booking') {
        dateMap[p.date].tokens++;
        dateMap[p.date].tokenAmt += p.amount;
      } else if (p.type === 'Full Enrollment') {
        dateMap[p.date].enrolls++;
        dateMap[p.date].enrollAmt += p.amount;
      }
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
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });

      const tokenDisplay = info.tokens > 0 ? `${info.tokens} (${fCurrency(info.tokenAmt)})` : '0';
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

  if (!hasDateData) {
    emptyRow(dateTbody, 3);
  }
}

// ==========================================
// PRODUCTIVITY VIEW
// ==========================================
function renderProductivity() {
  const cData = filteredCalls();
  const myTLs = getMyTLs().filter(tl =>
    activeFilters.tl === 'ALL' || tl.name === activeFilters.tl
  );

  const totalCalls   = cData.reduce((s, c) => s + c.calls, 0);
  const connected    = cData.reduce((s, c) => s + c.connected, 0);
  const talkMins     = cData.reduce((s, c) => s + c.talkTimeMin, 0);
  const connectRate  = totalCalls ? ((connected / totalCalls) * 100).toFixed(1) : 0;
  const talkHrs      = (talkMins / 60).toFixed(1);
  const avgTalkSec   = connected ? Math.round((talkMins * 60) / connected) : 0;

  const activeBDEs   = [...new Set(cData.map(c => c.bde))].length;
  const totalBDEs    = getMyBDEs(activeFilters.tl).length;

  // Update top 4 KPI cards
  setText('prod-calls',       fNum(totalCalls));
  setText('prod-calls-sub',   `${fNum(connected)} connected`);
  setText('prod-connect',     `${connectRate}%`);
  setText('prod-connect-sub', `${fNum(connected)} connected calls`);
  setText('prod-talk',        `${talkHrs}h`);
  setText('prod-talk-sub',    `Avg ${avgTalkSec}s per connect`);
  setText('prod-active',      `${activeBDEs}/${totalBDEs}`);
  setText('prod-active-sub',  `active in period`);

  // Calculate days in the selected range
  const dateFrom = new Date(activeFilters.dateFrom);
  const dateTo   = new Date(activeFilters.dateTo);
  const daysCount = Math.max(1, Math.round((dateTo - dateFrom) / (1000 * 60 * 60 * 24)) + 1);

  const activeBdesList = getMyBDEs(activeFilters.tl).filter(b =>
    activeFilters.bde === 'ALL' || b === activeFilters.bde
  );

  // Render Top 3 BDAs (Productivity) - Ranked by Total Talk Time (TT)
  const bdaPodiumContainer = document.getElementById('prod-podium-bdas');
  bdaPodiumContainer.innerHTML = '';

  const bdaRankings = activeBdesList.map(bde => {
    const bdeData = cData.filter(c => c.bde === bde);
    const dials = bdeData.reduce((sum, c) => sum + c.calls, 0);
    const connects = bdeData.reduce((sum, c) => sum + c.connected, 0);
    const talkTime = bdeData.reduce((sum, c) => sum + c.talkTimeMin, 0);
    const tl = ALL_TLS.find(t => t.bdes.includes(bde));
    return {
      name: bde,
      dials,
      connects,
      talkTime,
      program: tl ? tl.program : 'N/A'
    };
  }).sort((a, b) => b.talkTime - a.talkTime); // Sort by total talk time

  const topBDAs = bdaRankings.filter(b => b.talkTime > 0).slice(0, 3);

  if (topBDAs.length > 0) {
    topBDAs.forEach((bda, index) => {
      const rank = index + 1;
      const card = document.createElement('div');
      card.className = `podium-card rank-${rank}`;
      card.innerHTML = `
        <div class="podium-rank-badge">${rank}</div>
        <div class="podium-bda-name" title="${bda.name}">${bda.name}</div>
        <div class="podium-bda-program">${bda.program}</div>
        <div class="podium-bda-rev" style="color: var(--purple);">${fNum(bda.talkTime)} min</div>
      `;
      bdaPodiumContainer.appendChild(card);
    });
  } else {
    bdaPodiumContainer.innerHTML = '<div class="empty-row" style="width: 100%">No talk time data for BDAs in this period</div>';
  }

  // helper function to format avg talk time per call
  function formatAvgTalk(sec) {
    if (sec >= 60) {
      return `${Math.floor(sec / 60)}m ${sec % 60}s`;
    }
    return `${sec}s`;
  }

  // Render GM Performance Table
  const gmTbody = document.getElementById('prod-gm-table');
  gmTbody.innerHTML = '';
  if (currentUser) {
    const user = USERS[currentUser];
    const gmName = user.displayName;

    const gmDials = cData.reduce((sum, c) => sum + c.calls, 0);
    const gmConnects = cData.reduce((sum, c) => sum + c.connected, 0);
    const gmTalk = cData.reduce((sum, c) => sum + c.talkTimeMin, 0);

    const gmActiveBdes = [...new Set(cData.map(c => c.bde))].length || 1;

    const gmAvgCall = (gmDials / (gmActiveBdes * daysCount)).toFixed(1);
    const gmAvgCC = (gmConnects / (gmActiveBdes * daysCount)).toFixed(1);
    const gmAvgSec = gmConnects ? Math.round((gmTalk * 60) / gmConnects) : 0;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="bold">GM ${gmName}</td>
      <td class="mono">${fNum(gmDials)}</td>
      <td class="mono">${fNum(gmConnects)}</td>
      <td class="mono">${fNum(gmTalk)} min</td>
      <td class="mono">${gmAvgCall}</td>
      <td class="mono">${gmAvgCC}</td>
      <td class="mono">${formatAvgTalk(gmAvgSec)}</td>
    `;
    gmTbody.appendChild(tr);
  }

  // Render TL Performance Table
  const tlTbody = document.getElementById('prod-tl-perf-table');
  tlTbody.innerHTML = '';
  myTLs.forEach(tl => {
    const tlData = cData.filter(c => c.tl === tl.name);
    if (tlData.length === 0) return;

    const tlDials = tlData.reduce((sum, c) => sum + c.calls, 0);
    const tlConnects = tlData.reduce((sum, c) => sum + c.connected, 0);
    const tlTalk = tlData.reduce((sum, c) => sum + c.talkTimeMin, 0);

    const tlActiveBdes = [...new Set(tlData.map(c => c.bde))].length || 1;

    const tlAvgCall = (tlDials / (tlActiveBdes * daysCount)).toFixed(1);
    const tlAvgCC = (tlConnects / (tlActiveBdes * daysCount)).toFixed(1);
    const tlAvgSec = tlConnects ? Math.round((tlTalk * 60) / tlConnects) : 0;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="bold">TL ${tl.name}</td>
      <td class="mono">${fNum(tlDials)}</td>
      <td class="mono">${fNum(tlConnects)}</td>
      <td class="mono">${fNum(tlTalk)} min</td>
      <td class="mono">${tlAvgCall}</td>
      <td class="mono">${tlAvgCC}</td>
      <td class="mono">${formatAvgTalk(tlAvgSec)}</td>
    `;
    tlTbody.appendChild(tr);
  });
  if (tlTbody.innerHTML === '') emptyRow(tlTbody, 7);

  // Render BDA Performance Table
  const bdaTbody = document.getElementById('prod-bda-perf-table');
  bdaTbody.innerHTML = '';
  myTLs.forEach(tl => {
    const bdesToShow = activeFilters.bde !== 'ALL'
      ? tl.bdes.filter(b => b === activeFilters.bde)
      : tl.bdes;

    bdesToShow.forEach(bde => {
      const bdeData = cData.filter(c => c.bde === bde);
      if (bdeData.length === 0) return;

      const dials = bdeData.reduce((sum, c) => sum + c.calls, 0);
      const connects = bdeData.reduce((sum, c) => sum + c.connected, 0);
      const talk = bdeData.reduce((sum, c) => sum + c.talkTimeMin, 0);

      const bdeAvgCall = (dials / daysCount).toFixed(1);
      const bdeAvgCC = (connects / daysCount).toFixed(1);
      const bdeAvgSec = connects ? Math.round((talk * 60) / connects) : 0;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="bold">${bde}</td>
        <td class="mono">${fNum(dials)}</td>
        <td class="mono">${fNum(connects)}</td>
        <td class="mono">${fNum(talk)} min</td>
        <td class="mono">${bdeAvgCall}</td>
        <td class="mono">${bdeAvgCC}</td>
        <td class="mono">${formatAvgTalk(bdeAvgSec)}</td>
      `;
      bdaTbody.appendChild(tr);
    });
  });
  if (bdaTbody.innerHTML === '') emptyRow(bdaTbody, 7);
}

// ==========================================
// LEAD REPORT VIEW
// ==========================================
function renderLeads() {
  const lData = filteredLeads();
  const pData = filteredPayments(); // for matching payments if needed, though leads has enrolled stage
  const myTLs = getMyTLs().filter(tl =>
    activeFilters.tl === 'ALL' || tl.name === activeFilters.tl
  );

  const total      = lData.length;
  const interested = lData.filter(l => l.stage === 'Interested').length;
  const followup   = lData.filter(l => l.stage === 'Follow Up').length;
  const enrolled   = lData.filter(l => l.stage === 'Enrolled').length;
  const convRate   = total ? ((enrolled / total) * 100).toFixed(1) : 0;

  setText('lead-total',        fNum(total));
  setText('lead-interested',   fNum(interested));
  setText('lead-interested-sub', `${total ? ((interested/total)*100).toFixed(0) : 0}% of total`);
  setText('lead-followup',     fNum(followup));
  setText('lead-enrolled',     fNum(enrolled));
  setText('lead-enrolled-sub', `${convRate}% conversion`);

  // Clean up canvas-based chart.js instances if any exist
  destroyChart('leadStage');
  destroyChart('leadSource');

  // Render Lead Stage Funnel Progress Bars
  const funnelContainer = document.getElementById('lead-stage-funnel');
  funnelContainer.innerHTML = '';
  const notConnected = lData.filter(l => l.stage === 'Not Connected').length;
  const invalid      = lData.filter(l => l.stage === 'Invalid').length;

  const funnelStages = [
    { name: 'Enrolled (Converted)', count: enrolled, color: 'var(--emerald)' },
    { name: 'Interested', count: interested, color: 'var(--indigo)' },
    { name: 'Follow Up', count: followup, color: 'var(--amber)' },
    { name: 'Not Connected', count: notConnected, color: 'var(--text-muted)' },
    { name: 'Invalid', count: invalid, color: 'var(--danger)' }
  ];

  funnelStages.forEach(s => {
    const pct = total ? ((s.count / total) * 100) : 0;
    const row = document.createElement('div');
    row.className = 'funnel-stage-row';
    row.style = 'display: flex; flex-direction: column; gap: 4px;';
    row.innerHTML = `
      <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600;">
        <span style="color: var(--text);">${s.name}: ${fNum(s.count)}</span>
        <span style="color: var(--text-secondary);">${pct.toFixed(1)}%</span>
      </div>
      <div style="height: 6px; background: var(--border); border-radius: 3px; overflow: hidden;">
        <div style="height: 100%; width: ${pct}%; background: ${s.color}; border-radius: 3px;"></div>
      </div>
    `;
    funnelContainer.appendChild(row);
  });

  // Render Lead Source Mix Progress Bars
  const sourcesContainer = document.getElementById('lead-sources-list');
  sourcesContainer.innerHTML = '';

  const srcMap = {};
  lData.forEach(l => { srcMap[l.source] = (srcMap[l.source] || 0) + 1; });

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
    sourcesContainer.innerHTML = '<div class="empty-row">No lead source data available</div>';
  }

  // Render GM-wise Lead Summary Table
  const gmTbody = document.getElementById('lead-gm-table');
  gmTbody.innerHTML = '';
  if (currentUser) {
    const user = USERS[currentUser];
    const gmName = user.displayName;
    const gmTotal = lData.length;
    const gmInt = lData.filter(l => l.stage === 'Interested').length;
    const gmFU = lData.filter(l => l.stage === 'Follow Up').length;
    const gmEnr = lData.filter(l => l.stage === 'Enrolled').length;
    const gmConv = gmTotal ? ((gmEnr / gmTotal) * 100).toFixed(1) : 0;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="bold">GM ${gmName}</td>
      <td class="mono">${fNum(gmTotal)}</td>
      <td class="mono">${fNum(gmInt)}</td>
      <td class="mono">${fNum(gmFU)}</td>
      <td class="mono">${fNum(gmEnr)}</td>
      <td>${rateBadge(parseFloat(gmConv))}</td>
    `;
    gmTbody.appendChild(tr);
  }

  // TL lead summary table
  const tlTbody = document.getElementById('lead-tl-table');
  tlTbody.innerHTML = '';

  myTLs.forEach(tl => {
    const tlLeads   = lData.filter(l => l.tl === tl.name);
    if (tlLeads.length === 0) return;
    const tlTotal    = tlLeads.length;
    const tlInt      = tlLeads.filter(l => l.stage === 'Interested').length;
    const tlFU       = tlLeads.filter(l => l.stage === 'Follow Up').length;
    const tlEnr      = tlLeads.filter(l => l.stage === 'Enrolled').length;
    const tlConv     = tlTotal ? ((tlEnr / tlTotal) * 100).toFixed(1) : 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="bold">TL ${tl.name}</td>
      <td>${tl.program}</td>
      <td class="mono">${fNum(tlTotal)}</td>
      <td class="mono">${fNum(tlInt)}</td>
      <td class="mono">${fNum(tlFU)}</td>
      <td class="mono">${fNum(tlEnr)}</td>
      <td>${rateBadge(parseFloat(tlConv))}</td>
    `;
    tlTbody.appendChild(tr);
  });
  if (tlTbody.innerHTML === '') emptyRow(tlTbody, 7);

  // BDE Lead table
  const tbody = document.getElementById('lead-bde-table');
  tbody.innerHTML = '';

  myTLs.forEach(tl => {
    const bdesToShow = activeFilters.bde !== 'ALL'
      ? tl.bdes.filter(b => b === activeFilters.bde)
      : tl.bdes;

    bdesToShow.forEach(bde => {
      const bdeLeads  = lData.filter(l => l.bde === bde);
      if (bdeLeads.length === 0) return;

      const bTotal      = bdeLeads.length;
      const bInterested = bdeLeads.filter(l => l.stage === 'Interested').length;
      const bFollowup   = bdeLeads.filter(l => l.stage === 'Follow Up').length;
      const bEnrolled   = bdeLeads.filter(l => l.stage === 'Enrolled').length;
      const bConv       = bTotal ? ((bEnrolled / bTotal) * 100).toFixed(1) : 0;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="bold">${bde}</td>
        <td>TL ${tl.name}</td>
        <td class="mono">${fNum(bTotal)}</td>
        <td class="mono">${fNum(bInterested)}</td>
        <td class="mono">${fNum(bFollowup)}</td>
        <td class="mono">${fNum(bEnrolled)}</td>
        <td>${rateBadge(parseFloat(bConv))}</td>
      `;
      tbody.appendChild(tr);
    });
  });

  if (tbody.innerHTML === '') emptyRow(tbody, 7);
}

// ==========================================
// LEAD ANALYSIS VIEW
// ==========================================
// Helper to populate TL and BDE dropdowns for a specific table
function populateTLAndBDEDropdowns(tlSelId, bdeSelId) {
  const tlSel = document.getElementById(tlSelId);
  const bdeSel = document.getElementById(bdeSelId);
  if (!tlSel || !bdeSel) return;

  const myTLNames = getMyTLNames();
  const selectedTL = tlSel.value || 'ALL';

  tlSel.innerHTML = '<option value="ALL">All TLs</option>';
  myTLNames.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    tlSel.appendChild(opt);
  });

  if (myTLNames.includes(selectedTL)) {
    tlSel.value = selectedTL;
  } else {
    tlSel.value = 'ALL';
  }

  const currentTL = tlSel.value;
  const myBDEs = getMyBDEs(currentTL);
  const selectedBDE = bdeSel.value || 'ALL';

  bdeSel.innerHTML = '<option value="ALL">All BDEs</option>';
  myBDEs.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    bdeSel.appendChild(opt);
  });

  if (myBDEs.includes(selectedBDE)) {
    bdeSel.value = selectedBDE;
  } else {
    bdeSel.value = 'ALL';
  }
}

// Helper to populate Source dropdown
function populateSourceDropdown(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel || sel.dataset.populated === 'true') return;

  const allSources = [...new Set(DB.leads.map(l => l.source))].sort();
  sel.innerHTML = '<option value="ALL">All Sources</option>';
  allSources.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    sel.appendChild(opt);
  });
  sel.dataset.populated = 'true';
}

// Helper to populate Campaign dropdown
function populateCampaignDropdown(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel || sel.dataset.populated === 'true') return;

  const allCampaigns = [...new Set(DB.leads.map(l => l.campaign))].sort();
  sel.innerHTML = '<option value="ALL">All Campaigns</option>';
  allCampaigns.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  });
  sel.dataset.populated = 'true';
}

function getBaseLAData() {
  const myTLNames = getMyTLNames();
  return DB.leads.filter(l => {
    const inDate    = l.date >= activeFilters.dateFrom && l.date <= activeFilters.dateTo;
    const inProgram = activeFilters.program === 'ALL' || l.program === activeFilters.program;
    const inMyTeam  = myTLNames.includes(l.tl);
    return inDate && inProgram && inMyTeam;
  });
}

function renderLeadAnalysis() {
  // Ensure dropdowns are populated / updated when GM user or program changes
  const tlSel1 = document.getElementById('t1-filter-tl');
  const currentKey = `${currentUser}-${activeFilters.program}`;
  if (tlSel1 && tlSel1.dataset.key !== currentKey) {
    populateTLAndBDEDropdowns('t1-filter-tl', 't1-filter-bde');
    populateTLAndBDEDropdowns('t2-filter-tl', 't2-filter-bde');
    populateTLAndBDEDropdowns('t3-filter-tl', 't3-filter-bde');
    
    // Clear populated flag for source/campaign so they can refresh if needed
    const t2Src = document.getElementById('t2-filter-source');
    if (t2Src) delete t2Src.dataset.populated;
    const t3Src = document.getElementById('t3-filter-source');
    if (t3Src) delete t3Src.dataset.populated;
    const t3Cmp = document.getElementById('t3-filter-campaign');
    if (t3Cmp) delete t3Cmp.dataset.populated;

    tlSel1.dataset.key = currentKey;
  }

  // Populate source and campaign dropdowns
  populateSourceDropdown('t2-filter-source');
  populateSourceDropdown('t3-filter-source');
  populateCampaignDropdown('t3-filter-campaign');

  // Render KPI strip based on base pool (respecting global date & program filters)
  const base = getBaseLAData();
  const totalLeads = base.length;
  const totalEnrolled = base.filter(l => l.stage === 'Enrolled').length;
  const totalChase = base.filter(l => l.stage === 'Follow Up').length;
  const totalTokens = base.filter(l => l.stage === 'Enrolled').length;
  setText('la-kpi-leads',    fNum(totalLeads));
  setText('la-kpi-tokens',   fNum(totalTokens));
  setText('la-kpi-enrolled', fNum(totalEnrolled));
  setText('la-kpi-chase',    fNum(totalChase));
  setText('la-kpi-cvr',      totalLeads ? ((totalEnrolled/totalLeads)*100).toFixed(1)+'%' : '0%');

  // Render the three tables
  renderTable1();
  renderTable2();
  renderTable3();
}

// --- Table 1 logic ---
function onT1TLChange() {
  const tlSel = document.getElementById('t1-filter-tl');
  const bdeSel = document.getElementById('t1-filter-bde');
  if (tlSel && bdeSel) {
    const currentTL = tlSel.value;
    const myBDEs = getMyBDEs(currentTL);
    bdeSel.innerHTML = '<option value="ALL">All BDEs</option>';
    myBDEs.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      bdeSel.appendChild(opt);
    });
    bdeSel.value = 'ALL';
  }
  renderTable1();
}

function renderTable1() {
  const base = getBaseLAData();
  const tlVal = document.getElementById('t1-filter-tl')?.value || 'ALL';
  const bdeVal = document.getElementById('t1-filter-bde')?.value || 'ALL';

  const pool = base.filter(l =>
    (tlVal === 'ALL' || l.tl === tlVal) &&
    (bdeVal === 'ALL' || l.bde === bdeVal)
  );

  renderLATable('la-table1-body', pool);
}

function resetT1() {
  const tlSel = document.getElementById('t1-filter-tl');
  const bdeSel = document.getElementById('t1-filter-bde');
  if (tlSel) tlSel.value = 'ALL';
  if (bdeSel) {
    const myBDEs = getMyBDEs('ALL');
    bdeSel.innerHTML = '<option value="ALL">All BDEs</option>';
    myBDEs.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      bdeSel.appendChild(opt);
    });
    bdeSel.value = 'ALL';
  }
  renderTable1();
}

// --- Table 2 logic ---
function onT2TLChange() {
  const tlSel = document.getElementById('t2-filter-tl');
  const bdeSel = document.getElementById('t2-filter-bde');
  if (tlSel && bdeSel) {
    const currentTL = tlSel.value;
    const myBDEs = getMyBDEs(currentTL);
    bdeSel.innerHTML = '<option value="ALL">All BDEs</option>';
    myBDEs.forEach(name => {
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
  const base = getBaseLAData();
  const srcVal = document.getElementById('t2-filter-source')?.value || 'ALL';
  const tlVal = document.getElementById('t2-filter-tl')?.value || 'ALL';
  const bdeVal = document.getElementById('t2-filter-bde')?.value || 'ALL';

  const pool = base.filter(l =>
    (srcVal === 'ALL' || l.source === srcVal) &&
    (tlVal === 'ALL' || l.tl === tlVal) &&
    (bdeVal === 'ALL' || l.bde === bdeVal)
  );

  renderLATable('la-table2-body', pool);
}

function resetT2() {
  const srcSel = document.getElementById('t2-filter-source');
  const tlSel = document.getElementById('t2-filter-tl');
  const bdeSel = document.getElementById('t2-filter-bde');
  if (srcSel) srcSel.value = 'ALL';
  if (tlSel) tlSel.value = 'ALL';
  if (bdeSel) {
    const myBDEs = getMyBDEs('ALL');
    bdeSel.innerHTML = '<option value="ALL">All BDEs</option>';
    myBDEs.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      bdeSel.appendChild(opt);
    });
    bdeSel.value = 'ALL';
  }
  renderTable2();
}

// --- Table 3 logic ---
function onT3TLChange() {
  const tlSel = document.getElementById('t3-filter-tl');
  const bdeSel = document.getElementById('t3-filter-bde');
  if (tlSel && bdeSel) {
    const currentTL = tlSel.value;
    const myBDEs = getMyBDEs(currentTL);
    bdeSel.innerHTML = '<option value="ALL">All BDEs</option>';
    myBDEs.forEach(name => {
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
  const base = getBaseLAData();
  const cmpVal = document.getElementById('t3-filter-campaign')?.value || 'ALL';
  const srcVal = document.getElementById('t3-filter-source')?.value || 'ALL';
  const tlVal = document.getElementById('t3-filter-tl')?.value || 'ALL';
  const bdeVal = document.getElementById('t3-filter-bde')?.value || 'ALL';

  const pool = base.filter(l =>
    (cmpVal === 'ALL' || l.campaign === cmpVal) &&
    (srcVal === 'ALL' || l.source === srcVal) &&
    (tlVal === 'ALL' || l.tl === tlVal) &&
    (bdeVal === 'ALL' || l.bde === bdeVal)
  );

  renderLATable('la-table3-body', pool);
}

function resetT3() {
  const cmpSel = document.getElementById('t3-filter-campaign');
  const srcSel = document.getElementById('t3-filter-source');
  const tlSel = document.getElementById('t3-filter-tl');
  const bdeSel = document.getElementById('t3-filter-bde');
  if (cmpSel) cmpSel.value = 'ALL';
  if (srcSel) srcSel.value = 'ALL';
  if (tlSel) tlSel.value = 'ALL';
  if (bdeSel) {
    const myBDEs = getMyBDEs('ALL');
    bdeSel.innerHTML = '<option value="ALL">All BDEs</option>';
    myBDEs.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      bdeSel.appendChild(opt);
    });
    bdeSel.value = 'ALL';
  }
  renderTable3();
}

// --- Main aggregate-and-render helper for LA Tables ---
function renderLATable(tbodyId, pool) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = '';

  // Aggregate by date helper
  const map = {};
  let d = new Date(activeFilters.dateFrom);
  const end = new Date(activeFilters.dateTo);
  while (d <= end) {
    const key = d.toISOString().split('T')[0];
    map[key] = { leads: 0, tokens: 0, enrolled: 0, bucket: {}, chase: 0 };
    d.setDate(d.getDate() + 1);
  }

  pool.forEach(l => {
    if (!map[l.date]) return;
    map[l.date].leads++;
    if (l.stage === 'Enrolled')  map[l.date].tokens++;
    if (l.stage === 'Enrolled')  map[l.date].enrolled++;
    if (l.stage === 'Follow Up') map[l.date].chase++;
    map[l.date].bucket[l.stage] = (map[l.date].bucket[l.stage] || 0) + 1;
  });

  const dates = Object.keys(map).sort();
  const CPL_RATE = 250;
  let hasData = false;

  dates.forEach(dt => {
    const row = map[dt];
    if (row.leads === 0) return;
    hasData = true;

    const cvr = row.leads ? ((row.enrolled / row.leads) * 100).toFixed(1) : '0.0';
    const cpl = row.leads ? fCurrency(CPL_RATE * row.leads) : '—';

    // Get top bucket
    let top = '', cnt = 0;
    for (const [s, c] of Object.entries(row.bucket)) {
      if (c > cnt) { top = s; cnt = c; }
    }
    const bucket = top || '—';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="mono">${dt}</td>
      <td class="mono">${fNum(row.leads)}</td>
      <td><span class="la-bucket la-bucket-${bucket.replace(/\s+/g,'-').toLowerCase()}">${bucket}</span></td>
      <td class="mono">${fNum(row.tokens)}</td>
      <td class="mono">${cvr}%</td>
      <td class="mono">${cpl}</td>
      <td class="mono">${fNum(row.chase)}</td>
    `;
    tbody.appendChild(tr);
  });

  if (!hasData) emptyRow(tbody, 7);
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
  document.getElementById('app-layout').style.display = 'none';
  document.getElementById('login-overlay').style.display = 'flex';
  document.getElementById('login-username').focus();
});
