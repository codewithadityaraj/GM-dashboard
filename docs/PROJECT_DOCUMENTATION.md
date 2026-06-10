# GM Dashboard — Project Documentation

A credential-based sales dashboard for EdTech General Managers (GMs). It pulls live data from published Google Sheets (CSV), filters by GM / Program / TL / BDE / date range, and renders five views: **Overview**, **Revenue**, **Productivity**, **Leads**, and **Lead Analysis**.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Running Locally & Deployment](#running-locally--deployment)
3. [Google Sheets — Data Sources](#google-sheets--data-sources)
4. [How Data Reaches the Browser](#how-data-reaches-the-browser)
5. [Authentication & Access Control](#authentication--access-control)
6. [Global Filters](#global-filters)
7. [Views](#views)
8. [Revenue — Targets & Achievement](#revenue--targets--achievement)
9. [Productivity — KPI Formulas](#productivity--kpi-formulas)
10. [Leads & Lead Analysis](#leads--lead-analysis)
11. [Project File Structure](#project-file-structure)
12. [Environment Variables](#environment-variables)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (index.html + app.js + style.css)                      │
│  - Login (GM_USERS)                                             │
│  - Parse CSV client-side                                        │
│  - Filter, aggregate, render tables & KPIs                      │
└───────────────┬───────────────────────────────┬─────────────────┘
                │                               │
        /api/sheets?sheet=…              /api/config
                │                               │
    ┌───────────▼───────────┐         ┌─────────▼─────────┐
    │ Netlify Function      │         │ Netlify Function  │
    │ netlify/functions/    │         │ config.js         │
    │ sheets.js             │         │ (sheet URLs)      │
    └───────────┬───────────┘         └───────────────────┘
                │
    ┌───────────▼───────────────────────────────────────────┐
    │ Google Sheets (published CSV URLs)                        │
    └───────────────────────────────────────────────────────────┘

Local dev alternative:
    uvicorn main:app  →  FastAPI proxies /api/sheets + serves static files
```

| Layer | Role |
|-------|------|
| **Frontend** | Single-page app: `index.html`, `app.js`, `style.css`. Chart.js for charts. |
| **API proxy** | Fetches Google Sheet CSV server-side (avoids CORS / hides URL config). |
| **Sheets** | Source of truth for all metrics. No database. |

All heavy lifting (parsing, filtering, target math) happens in **`app.js`** in the browser after CSV download.

---

## Running Locally & Deployment

### Local (FastAPI + Uvicorn)

```bash
cd "GM-dashboard"
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000).

`main.py` serves `index.html` and static assets, and implements:

- `GET /api/sheets?sheet=<key>` — proxy to Google Sheets CSV
- `GET /api/leads` — optional server-filtered leads (cached 5 min)

### Netlify (production)

`netlify.toml` publishes the repo root and routes:

| Route | Handler |
|-------|---------|
| `/api/sheets` | `netlify/functions/sheets.js` |
| `/api/config` | `netlify/functions/config.js` |

Sheet URLs can be overridden via environment variables (see [Environment Variables](#environment-variables)).

---

## Google Sheets — Data Sources

Seven published CSV feeds power the dashboard. Five revenue/target sheets are fetched via `/api/sheets`; **Productivity** also uses `/api/sheets`. **Leads** is fetched directly from the URL returned by `/api/config` (large file — avoids Netlify function size limits).

### All sheet CSV links (quick reference)

| Sheet | API key / config key | CSV URL |
|-------|---------------------|---------|
| Leads | `leads` (via `/api/config`) | [Open CSV](https://docs.google.com/spreadsheets/d/e/2PACX-1vQe0m4OUvApuACPrN8jWN7twZuoGgZA3jj3ZU9Adp1C5LTe_8DZD7rseDmtxoaE7poMn7CMd4nVxyoZ/pub?gid=1770292739&single=true&output=csv) |
| Productivity | `productivity` | [Open CSV](https://docs.google.com/spreadsheets/d/e/2PACX-1vT6_Ukl-_qTeyobt1Q3SpgXhR0921qgUWrz6WPnINvl3U2OXl1dcsjEyGgMafUmG_cb9rE6QNrWZkuX/pub?gid=948739317&single=true&output=csv) |
| Revenue — Token | `revenue-token` | [Open CSV](https://docs.google.com/spreadsheets/d/e/2PACX-1vSYw0XpoBrl5gNAHq3n2p-OLAEOHwsBVVQy70ffPRRSk2SloYaqPPZ1X6YcuesaGvzlgf1EDUE8bwJV/pub?gid=0&single=true&output=csv) |
| Revenue — Full Payment | `revenue-full` | [Open CSV](https://docs.google.com/spreadsheets/d/e/2PACX-1vSYw0XpoBrl5gNAHq3n2p-OLAEOHwsBVVQy70ffPRRSk2SloYaqPPZ1X6YcuesaGvzlgf1EDUE8bwJV/pub?gid=1494867608&single=true&output=csv) |
| Cohort Targets | `cohort-targets` | [Open CSV](https://docs.google.com/spreadsheets/d/e/2PACX-1vSYw0XpoBrl5gNAHq3n2p-OLAEOHwsBVVQy70ffPRRSk2SloYaqPPZ1X6YcuesaGvzlgf1EDUE8bwJV/pub?gid=846488199&single=true&output=csv) |
| TL Targets | `tl-targets` | [Open CSV](https://docs.google.com/spreadsheets/d/e/2PACX-1vSYw0XpoBrl5gNAHq3n2p-OLAEOHwsBVVQy70ffPRRSk2SloYaqPPZ1X6YcuesaGvzlgf1EDUE8bwJV/pub?gid=209837982&single=true&output=csv) |
| BD (BDA) Targets | `bd-targets` | [Open CSV](https://docs.google.com/spreadsheets/d/e/2PACX-1vSYw0XpoBrl5gNAHq3n2p-OLAEOHwsBVVQy70ffPRRSk2SloYaqPPZ1X6YcuesaGvzlgf1EDUE8bwJV/pub?gid=68498859&single=true&output=csv) |

**Raw URLs (copy-paste):**

```
Leads:
https://docs.google.com/spreadsheets/d/e/2PACX-1vQe0m4OUvApuACPrN8jWN7twZuoGgZA3jj3ZU9Adp1C5LTe_8DZD7rseDmtxoaE7poMn7CMd4nVxyoZ/pub?gid=1770292739&single=true&output=csv

Productivity:
https://docs.google.com/spreadsheets/d/e/2PACX-1vT6_Ukl-_qTeyobt1Q3SpgXhR0921qgUWrz6WPnINvl3U2OXl1dcsjEyGgMafUmG_cb9rE6QNrWZkuX/pub?gid=948739317&single=true&output=csv

Revenue — Token:
https://docs.google.com/spreadsheets/d/e/2PACX-1vSYw0XpoBrl5gNAHq3n2p-OLAEOHwsBVVQy70ffPRRSk2SloYaqPPZ1X6YcuesaGvzlgf1EDUE8bwJV/pub?gid=0&single=true&output=csv

Revenue — Full Payment:
https://docs.google.com/spreadsheets/d/e/2PACX-1vSYw0XpoBrl5gNAHq3n2p-OLAEOHwsBVVQy70ffPRRSk2SloYaqPPZ1X6YcuesaGvzlgf1EDUE8bwJV/pub?gid=1494867608&single=true&output=csv

Cohort Targets:
https://docs.google.com/spreadsheets/d/e/2PACX-1vSYw0XpoBrl5gNAHq3n2p-OLAEOHwsBVVQy70ffPRRSk2SloYaqPPZ1X6YcuesaGvzlgf1EDUE8bwJV/pub?gid=846488199&single=true&output=csv

TL Targets:
https://docs.google.com/spreadsheets/d/e/2PACX-1vSYw0XpoBrl5gNAHq3n2p-OLAEOHwsBVVQy70ffPRRSk2SloYaqPPZ1X6YcuesaGvzlgf1EDUE8bwJV/pub?gid=209837982&single=true&output=csv

BD (BDA) Targets:
https://docs.google.com/spreadsheets/d/e/2PACX-1vSYw0XpoBrl5gNAHq3n2p-OLAEOHwsBVVQy70ffPRRSk2SloYaqPPZ1X6YcuesaGvzlgf1EDUE8bwJV/pub?gid=68498859&single=true&output=csv
```

> **Note:** Revenue, Cohort, TL, and BD target sheets share the same Google Spreadsheet document (`2PACX-1vSYw0XpoBrl5gNAHq3n2p-OLAEOHwsBVVQy70ffPRRSk2SloYaqPPZ1X6YcuesaGvzlgf1EDUE8bwJV`) but use different tab gids. Leads and Productivity are separate published spreadsheets.

---

### 1. Leads Sheet

| | |
|---|---|
| **API key** | Fetched via `/api/config` → `leads` URL |
| **Default gid** | `1770292739` |
| **CSV URL** | https://docs.google.com/spreadsheets/d/e/2PACX-1vQe0m4OUvApuACPrN8jWN7twZuoGgZA3jj3ZU9Adp1C5LTe_8DZD7rseDmtxoaE7poMn7CMd4nVxyoZ/pub?gid=1770292739&single=true&output=csv |
| **Used in** | Overview, Leads, Lead Analysis |

**Key columns (mapped in `mapCSVRow`):**

| Sheet column | Internal field | Purpose |
|--------------|----------------|---------|
| `Email Address` | `email` | Lead identifier |
| `Created On` | `createdOn` | Date filter |
| `Program` | `program` | Program filter |
| `Owner (User Email)` | `owner` | BDE filter |
| `TL Name` / `TL Name ` | `tl` | TL filter |
| `GM NAME` | `gm` | GM filter |
| `Final Stage` | `finalStage` | Funnel / stage tables |
| `Token Date` | `tokenDate` | Token tracking |
| `Enrollment Date` | `enrollmentDate` | CVR / enrolled count |
| `Lead Source`, `Campaign`, `Status`, `Stage` | various | Lead Analysis breakdowns |

---

### 2. Productivity Sheet

| | |
|---|---|
| **API key** | `productivity` |
| **Default gid** | `948739317` |
| **CSV URL** | https://docs.google.com/spreadsheets/d/e/2PACX-1vT6_Ukl-_qTeyobt1Q3SpgXhR0921qgUWrz6WPnINvl3U2OXl1dcsjEyGgMafUmG_cb9rE6QNrWZkuX/pub?gid=948739317&single=true&output=csv |
| **Used in** | Overview, Productivity |

**Key columns (`mapProdRow`):**

| Sheet column | Internal field |
|--------------|----------------|
| `Owner Name` | `owner` (BDE) |
| `Date` | `date` |
| `Program Name` | `program` |
| `Manager Name` | `manager` (TL) |
| `GM Name` | `gm` |
| `# Calls` | `calls` |
| `# Calls Connected` | `connected` |
| `# Unique Leads` | `uniqueLeads` |
| `Total Call Duration` | `talkTimeMin` |

---

### 3. Revenue — Token Sheet

| | |
|---|---|
| **API key** | `revenue-token` |
| **Default gid** | `0` |
| **CSV URL** | https://docs.google.com/spreadsheets/d/e/2PACX-1vSYw0XpoBrl5gNAHq3n2p-OLAEOHwsBVVQy70ffPRRSk2SloYaqPPZ1X6YcuesaGvzlgf1EDUE8bwJV/pub?gid=0&single=true&output=csv |
| **Used in** | Overview, Revenue |

**Key columns (`mapTokenRow`):**

| Sheet column | Internal field |
|--------------|----------------|
| `GM` | `gm` |
| `Type` | `type` (program) |
| `TL Name` | `tl` |
| `BD Mail` | `bdMail` |
| `Token date` | `tokenDate` |
| `Token Amount` | `tokenAmount` |
| `Cohort Name` | `cohortName` |

Token revenue in KPIs uses a fixed rate: **`TOKEN_REVENUE_RATE = ₹5,000`** per token (not sheet amount).

---

### 4. Revenue — Full Payment Sheet

| | |
|---|---|
| **API key** | `revenue-full` |
| **Default gid** | `1494867608` |
| **CSV URL** | https://docs.google.com/spreadsheets/d/e/2PACX-1vSYw0XpoBrl5gNAHq3n2p-OLAEOHwsBVVQy70ffPRRSk2SloYaqPPZ1X6YcuesaGvzlgf1EDUE8bwJV/pub?gid=1494867608&single=true&output=csv |
| **Used in** | Overview, Revenue |

**Key columns (`mapFullPayRow`):**

| Sheet column | Internal field |
|--------------|----------------|
| `GM`, `Type`, `TL Name`, `BD Mail` | same as token |
| `Full payment date` | `fullPayDate` |
| `Amount Paid` | `amountPaid` |

Enrollment **counts** use row count; revenue sums `amountPaid`.

---

### 5. Cohort Targets Sheet

| | |
|---|---|
| **API key** | `cohort-targets` |
| **Default gid** | `846488199` |
| **CSV URL** | https://docs.google.com/spreadsheets/d/e/2PACX-1vSYw0XpoBrl5gNAHq3n2p-OLAEOHwsBVVQy70ffPRRSk2SloYaqPPZ1X6YcuesaGvzlgf1EDUE8bwJV/pub?gid=846488199&single=true&output=csv |
| **Used in** | Revenue (GM targets, unit cards when no TL/BDE filter) |

**Key columns (`mapCohortRow`):**

| Sheet column | Internal field | Purpose |
|--------------|----------------|---------|
| `Program Name` | `programName` | Program mapping |
| `Cohort Name` | `cohortName` | Optional exact cohort |
| `Cohort Start Date` / `Cohort End Date` | `startDate`, `endDate` | Proration window |
| `Cohort Target` | `cohortTarget` | Program-level enrollment target |
| `GM Target` | `gmTarget` | GM-level whole-cohort target |
| `GM` | `gm` | GM name |

GM targets use **whole-cohort proration** (target ÷ total cohort days × filter overlap days).

---

### 6. TL Targets Sheet

| | |
|---|---|
| **API key** | `tl-targets` |
| **Default gid** | `209837982` |
| **CSV URL** | https://docs.google.com/spreadsheets/d/e/2PACX-1vSYw0XpoBrl5gNAHq3n2p-OLAEOHwsBVVQy70ffPRRSk2SloYaqPPZ1X6YcuesaGvzlgf1EDUE8bwJV/pub?gid=209837982&single=true&output=csv |
| **Used in** | Revenue (TL Performance table, unit cards when TL filter) |

**Key columns (`mapTlTargetRow`):**

| Sheet column | Internal field |
|--------------|----------------|
| `Manager Name` | `managerName` |
| `Program Name` | `programName` |
| `Cohort Start Date` / `Cohort End Date` | `startDate`, `endDate` |
| `Month Token Target` | `monthTokenTarget` |
| `Month Enrollment Target` | `monthEnrollmentTarget` |

TL targets use **monthly proration**: `(Month Target ÷ 30) × days in (filter ∩ cohort)`.

---

### 7. BD (BDA) Targets Sheet

| | |
|---|---|
| **API key** | `bd-targets` |
| **Default gid** | `68498859` |
| **CSV URL** | https://docs.google.com/spreadsheets/d/e/2PACX-1vSYw0XpoBrl5gNAHq3n2p-OLAEOHwsBVVQy70ffPRRSk2SloYaqPPZ1X6YcuesaGvzlgf1EDUE8bwJV/pub?gid=68498859&single=true&output=csv |
| **Used in** | Revenue (BDA Performance table, unit cards when BDE filter) |

**Key columns (`mapBdTargetRow`):**

| Sheet column | Internal field |
|--------------|----------------|
| `Agent Name` | `agentName` |
| `Agent Email ID` | `agentEmail` |
| `Program Name` | `programName` |
| `Manager Name` | `managerName` |
| `GM Name` | `gmName` |
| `Cohort Start Date` / `Cohort End Date` | `startDate`, `endDate` |
| `Month Token Target` | `monthTokenTarget` |
| `Month Enrollment Target` | `monthEnrollmentTarget` |

Same monthly proration formula as TL targets.

---

## How Data Reaches the Browser

### Fetch lifecycle

| Dataset | Function | Stored in |
|---------|----------|-----------|
| Leads | `fetchLeadCSV()` | `laAllRows` |
| Productivity | `fetchProductivityCSV()` | `prodAllRows` |
| Revenue + targets | `fetchRevenueCSV()` | `revTokenRows`, `revFullRows`, `bdTargetRows`, `tlTargetRows`, `cohortTargetRows` |

Each fetch:

1. Calls `/api/sheets?sheet=<key>` (or direct URL for leads via config).
2. Parses CSV with `parseCSV()` (handles quoted fields).
3. Maps rows via `map*Row()` helpers.
4. Sets `*Loaded = true` and calls `renderActiveView()`.

A loading overlay shows while any required dataset for the active view is still loading.

### Date auto-sync

If the user has **not** manually picked dates (`userSelectedDate === false`):

- **Revenue view**: `applyCohortDateRangeForFilters()` sets date range from cohort target sheet (per program or global min/max).
- **Leads view**: date range defaults to min/max `Created On` in leads data.

---

## Authentication & Access Control

Login is client-side via `GM_USERS` in `app.js`. Each user has:

- `password` — checked on login
- `displayName` — shown in UI
- `access` — `'ALL'` or an array of GM names they can see

`getAllowedGMs()` / `isGMAllowed(gmName)` restrict:

- GM dropdown options
- Row visibility in tables
- Overview totals scoped to allowed GMs

Users with `access: 'ALL'` (e.g. Syed) see all GMs discovered from loaded sheet data.

---

## Global Filters

Applied across views via `activeFilters`:

| Filter | Field | Notes |
|--------|-------|-------|
| **GM** | `gm` | `'ALL'` or specific GM name |
| **Program** | `program` | Program / `Type` / `Program Name` depending on view |
| **TL** | `tl` | Team Leader / Manager Name |
| **BDE** | `bde` | BDA email (`BD Mail` in revenue, `Owner` in productivity/leads) |
| **Date from / to** | `dateFrom`, `dateTo` | Inclusive ISO dates (`YYYY-MM-DD`) |

Changing GM resets Program, TL, and BDE. Changing Program resets TL and BDE. Changing TL resets BDE.

Preset date options (Today, Yesterday, This Week, etc.) update `dateFrom` / `dateTo` and set `userSelectedDate = true`.

---

## Views

### Overview (`view-overview`)

Summary cards combining data from all sources:

| Card | Source | Logic |
|------|--------|-------|
| Total / Current Token | Revenue token sheet | Total = all time (filtered by team); Current = in date range |
| Total / Current Enrollment | Revenue full payment sheet | Same pattern |
| Avg Dialled / Connected / Talk Time | Productivity | Uses `prodAvgCall`, `prodAvgCC`, `prodAvgTT` (owner-day based — see Productivity section) |
| Total Lead (CVR) | Leads | All leads for team filter; CVR = enrolled ÷ total |
| Current Leads (CVR) | Leads | Leads in selected date range (`getBaseLAData`) |

Also shows revenue summary snippet when loaded.

---

### Revenue (`view-revenue`)

**Data:** Token CSV, Full Payment CSV, Cohort Targets, TL Targets, BD Targets.

**Sections:**

| Section | Description |
|---------|-------------|
| KPI row | Total revenue, token count, enrollment count, target achievement % |
| Target Token / Enrollment (Unit wise) | Per-program progress cards |
| Top 3 BDAs | By token count in filter range |
| GM / TL / BDA Performance tables | Target, actuals, Current Deficit |
| Date-wise Token & Enrollment | Daily breakdown |

**Roster behavior:**

- **GM / TL tables**: Show all GMs/TLs from target sheets whose cohort overlaps the filter, even with zero activity. Zeros display as `—`.
- **BDA table**: Same from BD TARGET sheet + activity rows.

**Token value:** Each token counted as ₹5,000 in revenue KPIs.

---

### Productivity (`view-productivity`)

**Data:** Productivity sheet only.

**KPIs:** Avg Dialled/Day, Connect %, Avg Talk Time/Day, Active Team Size.

**Tables:** GM → TL → BDA performance (calls, connects, unique dialled, CPL, talk time, averages).

**Top 3 BDAs:** By total talk time.

---

### Leads (`view-leads`)

**Data:** Leads sheet.

KPIs: total leads, interested, follow-up, enrolled, conversion rate.

Charts: stage funnel, lead source breakdown.

Tables: GM / TL / BDE summary with dynamic columns per `Final Stage` values in data.

---

### Lead Analysis (`view-lead-analysis`)

**Data:** Leads sheet.

Deeper campaign / source / program analysis tables (Table 1–3) with independent TL/BDE sub-filters per table.

---

## Revenue — Targets & Achievement

### Core date proration

All targets respect `activeFilters.dateFrom` → `activeFilters.dateTo` intersected with each row's cohort dates.

```
cohort days = (endDate − startDate) + 1   (minimum 1)
```

Two proration models:

#### A. Monthly target (TL & BDA) — `calculateBdEnrollmentTarget`

Used for: `Month Token Target`, `Month Enrollment Target`

```
perDay = monthTarget ÷ 30
target = perDay × elapsedDays in (filter ∩ cohort)
```

#### B. Whole-cohort target (GM) — `calculateCohortWideTarget`

Used for: `GM Target` from cohort sheet

```
perDay = gmTarget ÷ totalCohortDays
target = perDay × elapsedDays in (filter ∩ cohort)
```

---

### Target source by filter (unit cards & KPI)

`revScopedTarget()` picks the target logic based on active team filter:

| Filter | Enrollment target source | Token target (unit cards) |
|--------|--------------------------|---------------------------|
| **TL selected** | TL TARGET sheet → `Month Enrollment Target` | TL TARGET → `Month Token Target` |
| **BDE selected** | BD TARGET sheet → `Month Enrollment Target` | BD TARGET → `Month Token Target` |
| **GM selected** | Cohort sheet → `GM Target` (prorated) | Same as enrollment (cohort-based) |
| **No team filter** | Cohort sheet → `Cohort Target` per program | Same as enrollment |

When TL or BDE is filtered, program cards are built from that person's target sheet rows (even if they had no revenue activity in the range).

---

### Performance tables

| Table | Enrollment Target | Actual Token | Actual Enrollment | Current Deficit |
|-------|-------------------|--------------|-------------------|-----------------|
| **GM** | Cohort sheet `GM Target` | Token CSV count | Full payment count | `max(0, target − enrollment)` in **filter range** |
| **TL** | TL TARGET sheet | Token CSV count | Full payment count | Past-period deficit: `cohortStart → filterStart−1` vs enrollments |
| **BDA** | BD TARGET sheet | Token CSV count | Full payment count | Past-period deficit (same as TL) |

**GM Current Deficit** = shortfall in the **selected date window** (target minus actual enrollments).

**TL / BDA Current Deficit** = shortfall **before** the filter starts (from cohort start through the day before `dateFrom`), comparing prorated past target to past enrollments. Shows `—` when zero.

---

### Target Achievement KPI

```
achievement % = (full enrollments in filter ÷ scoped enrollment target) × 100
```

Achievement is based on **enrollment count**, not rupee amount.

---

## Productivity — KPI Formulas

### Avg Dialled / Day (`prodAvgDialledPerDay`)

```
totalCalls = sum of # Calls for filtered rows
denominator = prodKpiDenominator(rows)
Avg Dialled / Day = totalCalls ÷ denominator
```

**Denominator (`prodKpiDenominator`):**

1. **Working days** = calendar days in `dateFrom`–`dateTo`, **excluding Sundays**.
2. If **single BDE** filter → `denominator = workingDays`.
3. Otherwise → `denominator = workingDays × TL–BDA pairs in data`.

A **TL–BDA pair** is each unique `Manager Name | Owner Name` combination appearing in the filtered productivity rows for the date range. BDAs with no rows in the sheet for that period are not counted in the denominator.

### Avg Talk Time / Day

Same denominator as Avg Dialled; numerator = total talk minutes.

### Connect %

```
(connected calls ÷ total calls) × 100
```

### Active Team Size

Count of **all unique BDEs** (`owner`) in productivity data matching GM/Program/TL filters — **without** date filter. Sub-text shows how many were active (had rows) in the selected date range.

### Table averages (GM/TL/BDA tables)

`prodAvgCall`, `prodAvgCC`, `prodAvgTT` use **owner-days with at least 1 call** as denominator (different from the top KPI).

### Overview productivity cards

Overview uses `prodAvgCall` / `prodAvgCC` / `prodAvgTT` (owner-day method), **not** the same formula as the Productivity tab's "Avg Dialled / Day" KPI.

---

## Leads & Lead Analysis

### Filtering (`getBaseLAData`)

Leads in the selected date range (`createdOn` between `dateFrom` and `dateTo`), plus GM / Program / TL / BDE filters.

### CVR (Overview)

```
CVR = (leads with non-blank Enrollment Date ÷ total leads) × 100
```

- **Total Lead**: all leads for team filters (no date filter on count).
- **Current Leads**: leads in selected date range.

### Leads view stages

Tables pivot on unique `Final Stage` values found in filtered data. Each stage gets a column with lead counts per GM / TL / BDE.

---

## Project File Structure

```
GM-dashboard/
├── index.html          # UI layout, all view sections, tables, KPI placeholders
├── app.js              # All logic: auth, fetch, parse, filter, render, targets
├── style.css           # Styling
├── main.py             # Local FastAPI server + /api/sheets proxy
├── netlify.toml        # Netlify deploy config + redirects
├── netlify/functions/
│   ├── sheets.js       # Sheet CSV proxy (production)
│   ├── config.js       # Returns sheet URLs from env
│   └── leads.js        # Optional server-side leads filter
├── .env.example        # Environment variable template
├── docs/
│   ├── PROJECT_DOCUMENTATION.md   # This file
│   └── TARGET_CALCULATION.md    # Older revenue target notes (partially outdated)
└── images/             # Logo assets
```

---

## Environment Variables

Copy `.env.example` for Netlify / `netlify dev`:

| Variable | Sheet |
|----------|-------|
| `SHEET_URL_LEADS` | Leads |
| `SHEET_URL_PRODUCTIVITY` | Productivity |
| `SHEET_URL_REVENUE_TOKEN` | Revenue tokens |
| `SHEET_URL_REVENUE_FULL` | Revenue full payments |
| `SHEET_URL_COHORT_TARGETS` | Cohort / GM targets |
| `SHEET_URL_TL_TARGETS` | TL targets |
| `SHEET_URL_BD_TARGETS` | BDA targets |

If unset, defaults in `netlify/functions/sheets.js` and `app.js` (`DEFAULT_SHEET_URLS`) are used.

---

## Quick Reference — Which Sheet Powers What

| Dashboard area | Primary sheet(s) |
|----------------|------------------|
| Overview tokens/enrollments | Revenue token + full payment |
| Overview productivity | Productivity |
| Overview leads / CVR | Leads |
| Revenue actuals | Revenue token + full payment |
| GM targets & deficit | Cohort targets |
| TL targets & deficit | TL targets |
| BDA targets & deficit | BD targets |
| Productivity all metrics | Productivity |
| Leads / Lead Analysis | Leads |

---

## Notes for Maintainers

1. **Published CSV URLs** must stay publicly accessible; the app has no Google Sheets API auth.
2. **Column names** in sheets must match `map*Row()` keys exactly (including trailing spaces like `TL Name ` on leads).
3. **TL name matching** uses `normTlMatch()` — handles prefixes and `"Direct"` suffix variants.
4. **BDE email matching** uses case-insensitive `normEmail()`.
5. Updating target logic: check `revScopedTarget`, `revTlSheetTarget`, `revBdSheetTarget`, `revGmSheetTarget`, and the unit-card block inside `renderRevenue()`.
6. The older `docs/TARGET_CALCULATION.md` describes an earlier cohort-only model; refer to this document for current TL/BDE sheet logic and deficit rules.
