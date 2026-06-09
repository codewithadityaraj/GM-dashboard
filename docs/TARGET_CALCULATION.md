# Target Calculation Logic — GM Dashboard (Revenue)

## Overview

Revenue targets come from the **cohort targets sheet** (`cohort-targets` CSV). Achievement is measured against **full payment count** (enrollment count), not rupee amount.

Targets are **date-aware**: they are prorated based on the active dashboard date filter (`dateFrom` → `dateTo`) intersected with each cohort's date range.

```
Prorated Target = Base Target × (elapsed days in filter ∩ cohort ÷ total cohort days)
```

**Important:** GM → TL mapping for targets uses **only the cohort sheet** (`GM`, `TL1`–`TL5`). Revenue CSVs are used for GM/TL/BDA names in tables and achievement counts, not for target team mapping.

---

## Data Sources

| Source | Used for |
|--------|----------|
| Cohort targets sheet | Target values, cohort dates, GM → TL mapping |
| Token / full payment CSVs | Revenue, GM/TL/BDA in tables, achievement counts |
| Productivity (input) sheet | Not used for revenue target calculation |

**Cohort sheet URL (gid=846488199):**  
https://docs.google.com/spreadsheets/d/e/2PACX-1vSYw0XpoBrl5gNAHq3n2p-OLAEOHwsBVVQy70ffPRRSk2SloYaqPPZ1X6YcuesaGvzlgf1EDUE8bwJV/pub?gid=846488199&single=true&output=csv

---

## Cohort Sheet Columns

| Column | Purpose |
|--------|---------|
| `Program Name` | Maps target to a program |
| `Cohort Name` | Optional exact cohort match |
| `Cohort Start Date` / `Cohort End Date` | Cohort window & day count |
| `Cohort Target` | Overall program target (full payments) |
| `GM Target` | GM-level target (used for GM & TL tables) |
| `GM` | GM name for target mapping |
| `TL1`–`TL5` | TLs mapped under that GM (target mapping only) |
| `Target Per Month Per BDA` | BDA-level target |
| `Target Per Day Per BDA` | Legacy column (not used in current UI) |

### Cohort lookup (`findCohortTarget`)

1. Filter rows by `Program Name`
2. If `Cohort Name` is provided → exact match
3. Else → row where today falls between start/end dates
4. Else → first matching row

### Cohort days

```
cohort days = (end date − start date) + 1   (minimum 1)
```

---

## Date Proration (Core)

All target values respect the active date filter.

1. `perDay = baseTarget ÷ total cohort days`
2. Find intersection of filter range and cohort range (clamp dates)
3. `elapsedDays = days in intersection` (inclusive)
4. `proratedTarget = perDay × elapsedDays`

| Case | Result |
|------|--------|
| Filter before cohort starts | Target = 0 |
| Filter after cohort ends | Target = full base target (clamped to cohort end) |
| Partial overlap | Only intersection days count |
| No overlap | Target = 0 |

**Functions:** `calculateProratedCohortTarget()`, `calculateProratedBdaTarget()`, `revGetFilterDateRange()`

---

## Date Filter Auto-Sync

When the user has **not** manually picked dates (`applyCohortDateRangeForFilters`):

| Program filter | Date range set to |
|----------------|-------------------|
| Specific program | That program's `Cohort Start Date` → `Cohort End Date` |
| All Programs | Earliest start across all cohorts → latest end |

---

## Base Target by Level

| Level | Base column used |
|-------|------------------|
| **KPI / Unit cards (no GM/TL/BDE filter)** | `Cohort Target` |
| **GM table** | `GM Target` (falls back to `Cohort Target`) |
| **TL table** | `GM Target ÷ TL count from sheet` |
| **BDA table** | `Target Per Month Per BDA` (prorated by elapsed days) |

```
cohortGmBaseTarget = GM Target || Cohort Target
```

---

## Filter-Scoped Target (`revScopedTarget`)

The **Target Achievement** KPI and **unit cards** adjust based on active filters:

| Filter selected | Target logic |
|-----------------|--------------|
| **Specific BDE** | BDA target (`Target Per Month Per BDA`, prorated) |
| **Specific TL** | TL target (GM Target ÷ mapped TLs in sheet) |
| **Specific GM** | GM target (`GM Target`, prorated) |
| **No team filter** | `Cohort Target` per program (summed if All Programs) |

---

## Level-wise Formulas

### 1. Target Achievement KPI

| Item | Formula |
|------|---------|
| **Target** | `revScopedTarget()` based on active GM / TL / BDE / program filters |
| **Achievement** | Count of full payments in filtered data |
| **%** | `(achieved full payments ÷ prorated target) × 100` |
| **Subtitle** | Shows per-day rate |

---

### 2. Unit-wise cards (per program)

Uses `revScopedTarget()` for the program's filtered rows.

| Item | Formula |
|------|---------|
| **Target** | Prorated scoped target for that program |
| **Per day** | Target ÷ cohort days |
| **Progress %** | Achievement count ÷ prorated target |

---

### 3. GM Performance table

| Display | Formula |
|---------|---------|
| **Target (cell)** | Sum of prorated `GM Target` for programs where sheet `GM` column matches this GM |
| **Tooltip** | Per-day rate |

Only cohort rows where `cohort.gm === gmName` contribute.

---

### 4. TL Performance table

Uses **cohort sheet mapping only** (not productivity roster).

| Display | Formula |
|---------|---------|
| **Target (cell)** | Prorated `GM Target ÷ number of TLs listed in TL1–TL5` |
| **Tooltip** | Per-day rate ÷ TL count |

**Steps:**

1. Loop all cohort rows for active program filter (if any)
2. Match `GM` column to active GM filter (or row's GM)
3. Check if TL name appears in `TL1`–`TL5` (flexible name match)
4. If **not mapped** → target = **0** (shows `—`)
5. If mapped → divide prorated GM Target by TL count

**TL name matching (`normTlMatch`):**

- Case-insensitive exact match
- Prefix match (`Piyush` ↔ `Piyush Kumar`)
- Ignores ` Direct` suffix (`Rekha` ↔ `Rekha Direct`)

---

### 5. BDA Performance table

| Display | Formula |
|---------|---------|
| **Target (cell)** | `(Target Per Month Per BDA ÷ 30) × elapsed days in filter ∩ cohort` |
| **Tooltip** | `Target Per Month Per BDA ÷ 30` per day |

Summed across programs if BDA spans multiple programs.

---

## Achievement vs Target

| UI area | Compared metric |
|---------|-----------------|
| KPI / unit cards | Full payment **count** |
| GM / TL / BDA tables | Target in Target column; Token & Enrollment columns show **counts** |

---

## Quick Reference

| Level | Base source | Prorated formula |
|-------|-------------|------------------|
| **KPI (no team filter)** | `Cohort Target` | `× (elapsedDays ÷ cohortDays)` |
| **Unit card** | Scoped target | Same proration |
| **GM** | `GM Target` | Sum per matching program |
| **TL** | `GM Target ÷ sheet TL count` | Per mapped TL |
| **BDA** | `Target Per Month Per BDA` | `(÷ 30) × elapsedDays` |

---

## Examples

### Example 1 — IIT Jodhpur (Umang)

Sheet row:

- `GM Target` = 1000  
- `GM` = Umang  
- `TL1`–`TL5` = Ashish, Abhishek Mishra, Chetan, Neetu, Md Ibrahim (5 TLs)  
- Cohort: 88 days  

**GM Umang (full cohort, full filter):** Target = **1000**  
**Each mapped TL:** 1000 ÷ 5 = **200**  
**Unmapped TL (e.g. Aman under Rekha's row):** **0**

---

### Example 2 — IIT Madras UI/UX (Rekha)

Sheet row:

- `GM Target` = 120  
- `GM` = Rekha  
- `TL1` = Rekha Direct only  

**GM Rekha:** **120**  
**Rekha Direct:** **120**  
**Aman (not in TL1–TL5):** **0**

---

### Example 3 — BDA target

- `Target Per Month Per BDA` = 1  
- Cohort elapsed in filter = 30 days  

**BDA target** = (1 ÷ 30) × 30 = **1.0**

---

### Example 4 — Date proration

- `GM Target` = 150  
- Cohort = 135 days  
- Filter = first 15 days of cohort  

**Prorated GM target** = 150 × (15 ÷ 135) = **16.7**

---

## Key Functions (`app.js`)

| Function | Purpose |
|----------|---------|
| `mapCohortRow()` | Parse cohort sheet row |
| `findCohortTarget()` | Lookup cohort by program |
| `cohortDayCount()` | Inclusive day count |
| `calculateProratedCohortTarget()` | Prorate GM/Cohort target |
| `calculateProratedBdaTarget()` | Prorate BDA monthly target |
| `cohortGmBaseTarget()` | `GM Target` or `Cohort Target` |
| `cohortTlIsMapped()` | Check TL in sheet mapping |
| `revScopedTarget()` | KPI/unit card target by filters |
| `revRowsCohortTarget()` | GM table target |
| `revTlRowsCohortTarget()` | TL table target |
| `revBdaRowsCohortTarget()` | BDA table target |
| `applyCohortDateRangeForFilters()` | Auto-set date filter from cohort |

---

## Edge Cases

| Case | Handling |
|------|----------|
| TL not in sheet `TL1`–`TL5` for that GM | Target = 0 (`—`) |
| GM name mismatch between revenue & sheet | GM table uses sheet `GM` column only |
| TL name slight mismatch | `normTlMatch` flexible matching |
| Filter outside cohort dates | Target = 0 |
| `GM Target` blank | Falls back to `Cohort Target` |
| All Programs (KPI) | Sum prorated targets across all cohort programs |
| Multiple cohorts per program | Today-in-range row, else first row |
