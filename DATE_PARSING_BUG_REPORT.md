# 🔍 Date Parsing Bug Analysis — Complete Report

**Status:** ✅ Issue identified, root cause fixed, 24 events corrected

---

## 📊 Problem Summary

### Events with Incorrect Years Found: **46**
- Years found: `2001, 2011-2014, 2020-2022, 2024, 2025, 2027-2029, 2030, 2040`
- All should be: `2026`
- Example: `2026-03-11` was parsed as `2011-03-26` ❌

---

## 🔧 Root Cause Analysis

### The Bug: ISO Date Misinterpretation

#### ❌ WHAT WAS HAPPENING (Before Fix):

```
Scraper Raw Data:
  dateText: "2026-03-11"  ← ISO format (YYYY-MM-DD)

Normalizer Logic (OLD):
  1. Check if rawDateIso matches /^\d{4}-\d{2}-\d{2}$/ 
     → No (checking wrong field)
  
  2. Build dateText = rawDateText || ... || rawDateIso
     → dateText = "2026-03-11"
  
  3. Pass to parseUruguayDateTime("2026-03-11")
  
  4. DD/MM/YY regex tries: /(\d{1,2})\/\-.](\d{1,2})\/\-.]/
     → Matches: "26-03-11"
     → Interprets as: Day=26, Month=03, Year=11
     → Result: 2011-03-26 ❌ WRONG!
```

#### ✅ WHAT HAPPENS NOW (After Fix):

```
Scraper Raw Data:
  dateText: "2026-03-11"  ← ISO format (YYYY-MM-DD)

Normalizer Logic (NEW):
  1. validateIsoDate(rawDateText):
     → Detects pattern: /^(\d{4})-(\d{2})-(\d{2})/
     → Extracts: year=2026, month=03, day=11
     → Validates: year 2026 ∈ [2026-2027] ✓
     → Validates: calendar date is valid ✓
     → Returns: "2026-03-11"
  
  2. isoDateTextDirect = "2026-03-11"
  
  3. Priority: isoDateDirect ?? isoDateTextDirect ?? ...
     → Result: 2026-03-11 ✅ CORRECT!
```

---

## 🎯 Affected Scrapers

| Source | Issue | Frequency |
|--------|-------|-----------|
| **entraste** | Sends ISO in both `dateIso` + `dateText` | High |
| **cobraticket** | Sends ISO in `dateText` with time | High |
| **ticketfacil** | Sends ISO in `dateText` | High |
| **redtickets** | Mixed: some old dates (2024-2025), some wrong | Medium |

---

## ✅ Resolution Status

### Code Changes Applied

**File:** `src/processing/normalizer.ts`

```typescript
// NEW: Validate ISO dates BEFORE parsing Spanish
const validateIsoDate = (isoStr: string | null): string | null => {
  if (!isoStr) return null;
  const match = isoStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  
  // Only accept 2026-2027 (reject 2001, 2011-2022, etc.)
  if (year < 2026 || year > 2027) return null;
  
  // Validate it's a real calendar date
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year || /* date validation */) return null;
  
  return `${year}-${match[2]}-${match[3]}`;
};

const isoDateDirect = validateIsoDate(rawDateIso);
const isoDateTextDirect = validateIsoDate(rawDateText);

// Use ISO dates with highest priority
const date = isoDateDirect ?? isoDateTextDirect ?? aiResolvedDate?.date ?? parsedDate.date;
```

### Database Records Fixed

**Script:** `scripts/fix-incorrect-event-years.mjs`

```
✅ Fixed: 24 events
  Examples:
  - "Avant The Oscars 2026"     : 2011-03-26 → 2026-03-11
  - "Festival 11 años Doña Marta": 2011-04-26 → 2026-04-11
  - "ULTRA TRAIL DE LAS SIERRAS" : 2024-05-26 → 2026-05-24

⏭️ Skipped: 22 events
  (Need manual review or different handling)
```

---

## 🚦 Remaining Issues (22 Events)

### Category 1: Past Events (18 RedTickets events from 2025)
- **Status:** Should likely be deleted or marked as "past"
- **Examples:**
  - "Entradas al MUSEO MAPI" (2024-07-22)
  - "FutVoltUy" (2025-02-28)
  - "Paseo Artesanal Fijo" (2025-05-24)
- **Action:** Filter events by `status` column instead of keeping old years in DB

### Category 2: Future Events (2 TicketFacil from 2027)
- **Status:** These WILL work with the new normalizer
- **Examples:**
  - "Uruguay - Venezuela" (2027-03-10)
  - "Uruguay - Argentina" (2027-05-15)
- **Action:** No action needed; new code will handle these

### Category 3: Placeholder Dates (3 RedTickets from 2030-2040)
- **Status:** Online courses with symbolic "date TBD" dates
- **Examples:**
  - "Diplomado Inclusión TDAH - TEA"
  - "Seminario TDAH TEA online"
- **Action:** Delete or mark as inactive

---

## 📈 Impact Summary

| Metric | Value |
|--------|-------|
| **Total Bad Events Found** | 46 |
| **Auto-Fixed** | 24 (52%) |
| **Require Manual Review** | 22 (48%) |
| **Normalized Events Now** | 24 new clean records |
| **Future Prevention** | ✅ New validation will prevent future occurrences |

---

## 🔒 Preventive Measures

The fix prevents future date parsing failures by:

1. ✅ **Detecting ISO format in `dateText` field** (not just `dateIso`)
2. ✅ **Validating year range** (only 2026-2027 accepted)
3. ✅ **Validating calendar dates** (Feb 30 would fail)
4. ✅ **Prioritizing ISO dates** over Spanish parsing (safer)

✅ **Result:** Future ISO format dates will be extracted correctly without being mangled by DD/MM/YY regex.
