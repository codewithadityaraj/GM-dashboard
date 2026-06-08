# Revenue Target Calculation — GM Dashboard

## Overview

Revenue targets are driven by the **cohort targets sheet** (`cohort-targets` CSV). Achievement is measured against **full payment count** (not rupee amount).

Targets are **date-aware**: they are prorated based on the active dashboard date filter (`dateFrom` → `dateTo`) intersected with each cohort's date range.

```
Prorated Target = Cohort Target × (elapsed days in filter ∩ cohort ÷ total cohort days)
```

See [TARGET_PRORATION.md](./TARGET_PRORATION.md) for full implementation details.

**Data sources:**

| Source | Used for |
|--------|----------|
| Cohort targets sheet | Target values, cohort dates |
| Token / full payment CSVs | GM, TL, BDA mapping for revenue & tables |
| Cohort sheet `GM`, `TL1`–`TL5` | GM → TL mapping **for target calculation only** |

---

## Cohort Sheet Columns

| Column | Purpose |
|--------|---------|
| `Program Name` | Maps target to a program |
| `Cohort Name` | Optional exact cohort match |
| `Cohort Start Date` / `Cohort End Date` | Date range & day count |
| `Cohort Target` | **Overall program target** (full payments) |
| `GM Target` | **GM-level target** (used for GM/TL target split) |
| `GM` | GM name for target mapping |
| `TL1`–`TL5` | TLs mapped under that GM (target mapping only) |
| `Target Per Month Per BDA` | **BDA-level target** |
| `Target Per Day Per BDA` | Legacy; used by `revTargetPerDay` / `revTargetFullPayments` (not used in current GM/TL/BDA table display) |

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

## Date Filter Wiring

When the user has **not** manually picked dates (`applyCohortDateRangeForFilters`):

| Program filter | Date range set to |
|----------------|-------------------|
| Specific program | That program's `Cohort Start Date` → `Cohort End Date` |
| All Programs | Earliest start across all cohorts → latest end |

Changing the program dropdown auto-updates the Revenue date filter to the cohort window.

---

## Target by UI Section

### 1. Target Achievement KPI (top card)

| Item | Formula |
|------|---------|
| **Target** | Prorated `Cohort Target` for selected program (or sum across all programs if ALL) |
| **Achievement** | Count of full payments in filtered data |
| **%** | `(achieved full payments ÷ prorated target) × 100` |
| **Subtitle** | Also shows per-day rate from cohort sheet |

---

### 2. Target (Unit wise) cards

Per program in filtered revenue:

| Item | Formula |
|------|---------|
| **Total target** | Prorated `Cohort Target` for filter date range |
| **Per day** | `Cohort Target ÷ cohort days` (full cohort rate) |
| **Progress %** | `(full payment count ÷ prorated target) × 100` |

---

### 3. GM Performance table

| Display | Formula |
|---------|---------|
| **Target (cell)** | Sum of **prorated** `Cohort Target` per unique program in GM's revenue rows |
| **Tooltip** | Per-day sum for full cohort rate |

**Example:** GM has only IIT Gandhinagar with `Cohort Target = 150` → cell shows **150**.

If a GM spans multiple programs, targets are **summed** across those programs.

---

### 4. TL Performance table

GM target is split **equally** among TLs listed in the cohort sheet (`TL1`–`TL5`) for that GM + program.

| Display | Formula |
|---------|---------|
| **Target (cell)** | Prorated `GM Target ÷ TL count from sheet` |
| **Tooltip** | Per-day rate ÷ TL count |

**Steps:**

1. Match program cohort row where `GM` column equals active GM filter
2. Check if TL name appears in `TL1`–`TL5` for that row
3. If **not mapped** → target = **0**
4. If mapped → divide prorated `GM Target` by number of listed TLs

**Example:** `GM Target = 120`, TLs = `Rekha Direct` only → Rekha Direct = **120**, unmapped TLs = **0**.

---

### 5. BDA Performance table

Uses **`Target Per Month Per BDA`**, scaled to full cohort length.

| Display | Formula |
|---------|---------|
| **Target (cell)** | `(Target Per Month Per BDA ÷ 30) × elapsed days in filter ∩ cohort` |
| **Tooltip** | `Target Per Month Per BDA ÷ 30` (per day) |

**Example:** `Target Per Month Per BDA = 1`, cohort = 135 days → BDA target = `1 × (135/30) = 4.5`.

If a BDA has rows for multiple programs, targets are **summed** per program.

---

## Achievement vs Target (all levels)

| Level | Compared metric |
|-------|-----------------|
| KPI / unit cards | Full payment **count** |
| GM / TL / BDA tables | Target in Target column; Token Collected & Enrollment columns show **counts** |

---

## Legacy helpers (not used in current table/KPI display)

These still exist in `app.js` but are **not** wired to the current Revenue target UI:

```
revTargetPerDay       = Target Per Day Per BDA × BDA count (from input roster)
revTargetFullPayments = revTargetPerDay × cohort days
```

BDA count comes from productivity/leads roster filtered by GM/TL/BDE scope.

---

## Quick reference

| Level | Target source | Formula |
|-------|---------------|---------|
| **Overall KPI** | `Cohort Target` | Direct from sheet |
| **Unit card** | `Cohort Target` | Direct per program |
| **GM** | `Cohort Target` | Sum across GM's programs |
| **TL** | `Cohort Target` | `÷ TLs under GM` (input roster) |
| **BDA** | `Target Per Month Per BDA` | `× (cohort days ÷ 30)` |

---

## Example (IIT Gandhinagar)

Assume:

- `Cohort Target = 150`
- Cohort: 135 days
- `Target Per Month Per BDA = 1`
- GM Ajay has 3 TLs

| Where | Value |
|-------|-------|
| GM Ajay target | **150** |
| Each TL target | **50** (150 ÷ 3) |
| Each BDA target | **4.5** (1 × 135/30) |
| Per-day (GM) | **1.11/day** (150 ÷ 135) |
| Target Achievement % | full payments ÷ 150 × 100 |
