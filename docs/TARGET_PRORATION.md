# Target Calculation Logic — Implementation Guide

> **Goal:** Calculate date-aware targets at GM, TL, BDA levels that respect the dashboard date filter.

---

## Core Concept

Targets are **linearly prorated** across cohort duration. When the user picks a date range, the target reflects how many enrollments should have happened by then.

```
Prorated Target = Cohort Target × (Days Elapsed in Filter ÷ Total Cohort Days)
```

Implemented in `app.js` via `calculateProratedCohortTarget()` and `calculateProratedBdaTarget()`.

---

## Date Filter Source

The dashboard uses `activeFilters.dateFrom` and `activeFilters.dateTo` (YYYY-MM-DD). These are set by:

- Program dropdown auto-sync (`applyCohortDateRangeForFilters`)
- Date presets (Today, Yesterday, Last 7 days, etc.)
- Custom date range popup

`revGetFilterDateRange()` reads the active filter for all target calculations.

---

## Proration Algorithm

1. Compute `perDay = Cohort Target ÷ total cohort days`
2. Find intersection of filter range and cohort range (clamp dates)
3. `elapsedDays = days in intersection` (inclusive)
4. `target = perDay × elapsedDays`

If filter has **no overlap** with cohort → target = 0.

---

## Level-wise Formulas

| Level | Formula |
|-------|---------|
| **KPI** | Sum of prorated `Cohort Target` (all programs if ALL selected) |
| **Unit card** | Prorated `Cohort Target` per program |
| **GM** | Σ prorated target for each program in GM's revenue rows |
| **TL** | Σ (prorated target ÷ TL count under GM) per program |
| **BDA** | Σ `(Target Per Month Per BDA ÷ 30) × elapsed days` per program |

---

## Functions (app.js)

| Function | Purpose |
|----------|---------|
| `revGetFilterDateRange()` | Active filter start/end |
| `clampTargetDateStr()` | Clamp date to cohort bounds |
| `calculateProratedCohortTarget()` | Core cohort proration |
| `calculateProratedBdaTarget()` | BDA per-month proration |
| `revProratedCohortForProgram()` | Prorated target for one program |
| `revCohortTotalTarget()` | KPI total (supports ALL programs) |
| `revRowsCohortTarget()` | GM table targets |
| `revTlRowsCohortTarget()` | TL table targets (÷ TL count) |
| `revBdaRowsCohortTarget()` | BDA table targets |

---

## Edge Cases

| Case | Handling |
|------|----------|
| Filter before cohort starts | Target = 0 |
| Filter after cohort ends | Target = full cohort target (clamped to cohort end) |
| Partial overlap | Intersection only |
| No overlap | Target = 0 |
| All Programs (KPI) | Sum prorated targets across all cohort programs |
| TL count unknown | Fallback to full GM prorated target |

---

## Quick Formula Cheatsheet

```javascript
// Prorated cohort target
proratedTarget = cohortTarget × (elapsedDays / totalCohortDays)

// GM
gmTarget = Σ proratedTarget[program]

// TL
tlTarget = Σ (proratedTarget[program] / tlCountUnderGM)

// BDA
bdaTarget = Σ (targetPerMonthPerBDA / 30) × elapsedDays
```

---

*See also: [REVENUE_TARGET.md](./REVENUE_TARGET.md)*
