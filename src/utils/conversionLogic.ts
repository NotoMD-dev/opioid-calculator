// src/utils/conversionLogic.ts
import {
  Opioid,
  Route,
  Severity,
  HomeMedRow,
  DoseInput,
  SwitchOptions,
  RotateTargetResult,
  PrnSuggestionResult,
} from "../types";
import {
  MME_FACTORS,
  TARGET_FACTORS,
  FENT_PATCHES,
  OPIOID_SHORT,
  ROUTE_LABELS,
  OPIOID_LABELS,
  PRN_FRACTIONS,
  FRAIL_FENTANYL_REDUCTION_FACTOR,
  STANDARD_LOW_FACTOR,
  STANDARD_HIGH_FACTOR,
  FRAIL_LOW_FACTOR,
  FRAIL_HIGH_FACTOR,
  IS_COMBO,
  APAP_CAUTION_MG,
  APAP_MAX_MG,
} from "./constants";

/* ======================= General Helpers ======================= */
export function generateUniqueId() {
  return typeof crypto !== "undefined" && (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : String(Date.now() + Math.random());
}

export function roundToTenth(mg: number) {
  if (!Number.isFinite(mg)) return 0;
  return Number(mg.toFixed(1));
}

export function fmtDose(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = Number(n.toFixed(2));
  return Math.abs(rounded - Math.round(rounded)) < 1e-9
    ? String(Math.round(rounded))
    : String(rounded);
}

/* ======================= Opioid rounding & conversions ======================= */
export function roundPerDose(drug: Opioid, route: Route, mg: number): number {
  const clean = (x: number) => Number(x.toFixed(2));
  if (drug === "hydromorphone" && route === "iv")
    return clean(Math.max(0.2, Math.ceil(mg / 0.2) * 0.2));
  if (drug === "hydromorphone" && route === "oral")
    return clean(Math.max(2, Math.ceil(mg / 2) * 2));
  if (drug === "oxycodone" && route === "oral")
    return clean(Math.max(5, Math.ceil(mg / 5) * 5));
  if (drug === "morphine" && route === "iv")
    return clean(Math.max(1, Math.ceil(mg / 1) * 1));
  return clean(Math.round(mg * 10) / 10);
}

export function roundToPatch(mcgPerHr: number): number {
  let best = FENT_PATCHES[0];
  let bestDiff = Math.abs(mcgPerHr - best);
  for (const p of FENT_PATCHES) {
    const d = Math.abs(mcgPerHr - p);
    if (d < bestDiff) {
      best = p;
      bestDiff = d;
    }
  }
  return best;
}

export function getTargetFactor(drug: Opioid, route: Route): number | null {
  if (drug === "fentanyl_tds" || drug === "methadone" || drug === "buprenorphine") return null;
  const byRoute = TARGET_FACTORS[drug];
  if (!byRoute) return null;
  return (
    (byRoute as Record<string, number>)[route] ??
    (byRoute as Record<string, number>).oral ??
    null
  );
}

export function mmeOf(input: DoseInput): number | null {
  if (input.drug === "buprenorphine") return null;
  if (input.drug === "fentanyl_tds") {
    // Midpoint: 25 mcg/h ≈ 75 OME/day (mid of 60–90)
    const mcg = input.fentanylPatchMcgPerHr || 0;
    if (!mcg) return null;
    return (mcg / 25) * 75;
  }
  if (input.drug === "methadone") return null;
  const factor = MME_FACTORS[input.drug];
  if (!factor) return null;
  return input.totalDailyDoseMg * factor;
}

/* ======================= APAP rollups & warnings ======================= */
/** Returns daily OME, daily APAP mg, and detail/notes (non-linear, etc.) */
export function sumOMEAndAPAP(rows: HomeMedRow[]): {
  ome: number;
  apap: number;
  details: string[];
  notes: string[];
} {
  let ome = 0;
  let apap = 0;
  const details: string[] = [];
  const notes: string[] = [];

  for (const r of rows) {
    if (!r.drug || !r.route || !r.doseMg) continue;

    const isFentanyl = r.drug === "fentanyl_tds";
    const dosesPerDay = r.isPRN
      ? (r.avgPrnDosesPerDay ?? 0)
      : r.freqHours
        ? 24 / r.freqHours
        : 1;

    // APAP tracking for combo products
    if (IS_COMBO(r.drug) && r.apapPerTabMg && dosesPerDay > 0) {
      apap += r.apapPerTabMg * dosesPerDay;
    }

    // Total daily dose of opioid component
    const totalDailyDoseMg = isFentanyl ? r.doseMg : r.doseMg * dosesPerDay;

    const input: DoseInput = {
      drug: r.drug,
      route: r.route,
      totalDailyDoseMg,
      fentanylPatchMcgPerHr: isFentanyl ? r.doseMg : undefined,
    };
    const dailyOME = mmeOf(input);

    if (dailyOME !== null) {
      ome += dailyOME;
      const doseType = r.isPRN
        ? `PRN (avg ${fmtDose(dosesPerDay)}/day)`
        : isFentanyl
          ? "patch (mcg/h)"
          : r.freqHours ? `Scheduled q${r.freqHours}h` : "Scheduled (daily)";
      details.push(
        `${OPIOID_SHORT[r.drug]} ${fmtDose(r.doseMg)} ${ROUTE_LABELS[r.route]} ${doseType}: ~${Math.round(dailyOME)} OME/day`
      );
    } else {
      notes.push(`OME not computed for ${OPIOID_LABELS[r.drug]} (non-linear/partial agonist or missing factor).`);
    }
  }

  return { ome, apap, details, notes };
}

export function apapSafetyWarning(totalApapMgPerDay: number): string | null {
  if (totalApapMgPerDay >= APAP_MAX_MG) return "⚠️ Acetaminophen ≥4,000 mg/day — exceeds max daily dose.";
  if (totalApapMgPerDay >= APAP_CAUTION_MG) return "⚠️ Acetaminophen ≥3,000 mg/day — use caution (elderly/liver disease).";
  return null;
}

/* ======================= Original totalHomeOME (kept for compatibility) ======================= */
export function totalHomeOME(rows: HomeMedRow[]): { ome: number; details: string[] } {
  const { ome, details } = sumOMEAndAPAP(rows);
  return { ome, details };
}

/* ======================= Regimen rotation (range behavior) ======================= */
export function rotateToTarget(
  ome: number,
  targetDrug: Opioid,
  targetRoute: Route,
  options: SwitchOptions
): RotateTargetResult {
  const { crossToleranceReductionPct, frailOrElderly } = options;
  const notes: string[] = [];

  // 1) CT reduction
  const adjustedOME = ome * (1 - crossToleranceReductionPct / 100);
  notes.push(
    `1) Cross-tolerance reduction: ${ome.toFixed(1)} OME × (1 - ${crossToleranceReductionPct}%) = ${adjustedOME.toFixed(1)} OME/day`
  );

  // 2) Special agents
  if (targetDrug === "methadone" || targetDrug === "buprenorphine") {
    notes.push(`Special agent: ${OPIOID_LABELS[targetDrug]} conversion is non-linear; consult pain/palliative.`);
    return { range: null, notes };
  }

  // 3) Fentanyl TDS
  if (targetDrug === "fentanyl_tds") {
    // 25 mcg/h ≈ 60–90 OME/day → derive patch band
    const standardLow = (adjustedOME / 90) * 25;
    let standardHigh = (adjustedOME / 60) * 25;
    if (frailOrElderly) {
      standardHigh *= FRAIL_FENTANYL_REDUCTION_FACTOR;
      notes.push("Frail/Elderly: high end reduced by 25%.");
    }
    const roundLo = roundToPatch(standardLow);
    const roundHi = roundToPatch(standardHigh);
    notes.push(
      `2) Fentanyl mapping → ~${roundLo}–${roundHi} mcg/h (rounded to standard patches: ${FENT_PATCHES.join(", ")}).`
    );
    return { range: null, notes, fentanylPatchMcgHr: [roundLo, roundHi] };
  }

  // 4) Standard
  const factor = getTargetFactor(targetDrug, targetRoute);
  if (!factor) {
    notes.push(`Missing conversion factor for ${OPIOID_LABELS[targetDrug]} ${ROUTE_LABELS[targetRoute]}.`);
    return { range: null, notes };
  }

  const targetDailyMg = adjustedOME / factor;
  notes.push(`2) Target factor ${factor}: ${adjustedOME.toFixed(1)} ÷ ${factor} = ${targetDailyMg.toFixed(1)} mg/day`);

  let lowFactor = STANDARD_LOW_FACTOR;
  let highFactor = STANDARD_HIGH_FACTOR;
  if (frailOrElderly) {
    lowFactor = FRAIL_LOW_FACTOR;
    highFactor = FRAIL_HIGH_FACTOR;
    notes.push("Frail/Elderly: using 75–90% of calculated daily dose.");
  }

  const low = Math.max(0, roundToTenth(targetDailyMg * lowFactor));
  const high = Math.max(0, roundToTenth(targetDailyMg * highFactor));
  notes.push(`3) Suggested daily dose range: ${low.toFixed(1)}–${high.toFixed(1)} mg/day.`);
  return { range: [low, high], notes };
}

/* ======================= PRN suggestion ======================= */
export function prnSuggestion(
  ome: number,
  drug: Opioid,
  route: Route,
  freqHours: number,
  severity: Severity,
  opts?: { opioidNaive?: boolean }
): PrnSuggestionResult {
  const STARTING: Record<string, [number, number]> = {
    "oxycodone|oral|moderate": [5, 10],
    "oxycodone|oral|severe": [10, 15],
    "hydromorphone|iv|moderate": [0.2, 0.4],
    "hydromorphone|iv|severe": [0.4, 0.8],
    "hydromorphone|oral|moderate": [2, 4],
    "hydromorphone|oral|severe": [4, 6],
    "morphine|oral|moderate": [5, 10],
    "morphine|oral|severe": [10, 15],
    "morphine|iv|moderate": [1, 2],
    "morphine|iv|severe": [2, 4],
  };

  if (opts?.opioidNaive) {
    const key = `${drug}|${route}|${severity === "breakthrough" ? "severe" : severity}`;
    const base = STARTING[key];
    if (!base) return { text: "Select common drug/route for naïve defaults" };
    const [lo, hi] = base;
    const drugShort = OPIOID_SHORT[drug];
    return {
      text: `${drugShort} ${fmtDose(lo)}${hi !== lo ? "–" + fmtDose(hi) : ""} ${ROUTE_LABELS[route].toLowerCase()} q${Math.max(2, Math.min(12, Math.round(freqHours)))}h PRN`,
      low: lo,
      high: hi,
    };
  }

  if (ome <= 0) return { text: "Enter home regimen to calculate suggestions." };
  if (drug === "fentanyl_tds" || drug === "methadone" || drug === "buprenorphine") {
    return { text: `${OPIOID_LABELS[drug]} not suggested as PRN in this tool` };
  }

  const factor = getTargetFactor(drug, route) ?? 1;
  const targetDailyMg = ome / factor;

  const [loF, hiF] = PRN_FRACTIONS[severity];
  const perDoseLow = roundPerDose(drug, route, targetDailyMg * loF);
  const perDoseHigh = roundPerDose(drug, route, targetDailyMg * hiF);

  const drugShort = OPIOID_SHORT[drug];
  return {
    text: `${drugShort} ${fmtDose(perDoseLow)}${perDoseHigh !== perDoseLow ? "–" + fmtDose(perDoseHigh) : ""} ${ROUTE_LABELS[route].toLowerCase()} q${Math.max(2, Math.min(12, Math.round(freqHours)))}h PRN`,
    low: perDoseLow,
    high: perDoseHigh,
    note: `${Math.round(loF * 100)}${hiF !== loF ? "–" + Math.round(hiF * 100) : ""}% of target daily dose`,
  };
}

/* ======================= EXACT quick converter (single value) ======================= */
/**
 * exactQuickConvert
 * - Always returns ONE exact recommendation (no ranges).
 * - Rounding rules:
 *   - If no target frequency: daily mg rounded to whole mg.
 *   - If target frequency provided: per-dose = daily / dosesPerDay;
 *       IV -> 1 decimal, PO/TD -> whole mg.
 *   - Fentanyl patch -> nearest single patch strength.
 * - Cross-tolerance (%) is applied numerically before converting.
 */
export function exactQuickConvert(opts: {
  fromDrug: Opioid;
  fromRoute: Route;
  toDrug: Opioid;
  toRoute: Route;
  includeFreq: boolean;       // if true, fromDoseMg is per-dose with fromFreqHours
  fromDoseMg: number;         // per-dose if includeFreq=true, else DAILY mg
  fromFreqHours?: number;     // required when includeFreq=true
  toFreqHours?: number;       // optional; if provided we emit per-dose
  crossTolerancePct: number;  // 0–100
}): { text: string; steps: string[] } {
  const {
    fromDrug, fromRoute, toDrug, toRoute,
    includeFreq, fromDoseMg, fromFreqHours, toFreqHours,
    crossTolerancePct,
  } = opts;

  const steps: string[] = [];

  // Guard: unsupported as source
  if (fromDrug === "methadone" || fromDrug === "buprenorphine") {
    return { text: "From-drug non-linear/partial agonist not supported for exact conversion.", steps };
  }

  // 1) Build daily OME from source
  const fromFactor = fromDrug === "fentanyl_tds"
    ? null
    : (MME_FACTORS[fromDrug] ?? null);

  let dailyOME: number;
  if (fromDrug === "fentanyl_tds") {
    // Using midpoint mapping: 25 mcg/h ≈ 75 OME/day
    const patchMcgHr = includeFreq ? fromDoseMg : fromDoseMg; // UI provides mcg/h
    dailyOME = (patchMcgHr / 25) * 75;
    steps.push(`Fentanyl source: ${patchMcgHr} mcg/h → ${dailyOME.toFixed(1)} OME/day (25 mcg/h ≈ 75 OME/day).`);
  } else {
    const dosesPerDay = includeFreq ? Math.max(1, 24 / Math.max(1, fromFreqHours || 24)) : 1;
    dailyOME = fromDoseMg * dosesPerDay * (fromFactor ?? 1);
    steps.push(`Input → Daily OME: ${fromDoseMg} mg × ${includeFreq ? dosesPerDay.toFixed(2) + "/day × " : ""}factor ${fromFactor ?? 1} = ${dailyOME.toFixed(1)} OME/day`);
  }

  // 2) Cross-tolerance
  const ct = Math.max(0, Math.min(95, crossTolerancePct));
  const adjOME = dailyOME * (1 - ct / 100);
  steps.push(`Cross-tolerance ${ct}% → ${adjOME.toFixed(1)} OME/day`);

  // 3) Convert to target
  if (toDrug === "methadone" || toDrug === "buprenorphine") {
    steps.push("Target is non-linear/partial agonist; exact 1:1 not supported.");
    return { text: "Exact conversion to this target is not supported.", steps };
  }

  if (toDrug === "fentanyl_tds") {
    // Single nearest patch strength
    const rawMcgHr = adjOME / 75 * 25; // invert mapping
    const patch = roundToPatch(rawMcgHr);
    steps.push(`Target fentanyl: ${adjOME.toFixed(1)} OME/day → ${rawMcgHr.toFixed(1)} mcg/h → nearest ${patch} mcg/h`);
    return { text: `Fentanyl patch ${patch} mcg/h`, steps };
  }

  const toFactor = getTargetFactor(toDrug, toRoute);
  if (!toFactor) {
    steps.push(`Missing factor for ${OPIOID_LABELS[toDrug]} ${ROUTE_LABELS[toRoute]}.`);
    return { text: "Missing conversion factor.", steps };
  }

  const dailyTarget = adjOME / toFactor;
  steps.push(`Target daily: ${adjOME.toFixed(1)} ÷ factor ${toFactor} = ${dailyTarget.toFixed(2)} mg/day`);

  // 4) Emit a single, rounded value
  if (!toFreqHours) {
    const dailyRounded = Math.round(dailyTarget); // whole mg
    steps.push(`Rounded (no frequency): ${dailyRounded} mg/day`);
    return { text: `${OPIOID_LABELS[toDrug]} ${dailyRounded} ${ROUTE_LABELS[toRoute]} per day`, steps };
  } else {
    const dosesPerDay = Math.max(1, 24 / Math.max(1, toFreqHours));
    const perDose = dailyTarget / dosesPerDay;
    const isIV = toRoute === "iv";
    const perDoseRounded = isIV ? Number(perDose.toFixed(1)) : Math.round(perDose);
    steps.push(`Per-dose = ${dailyTarget.toFixed(2)} ÷ ${dosesPerDay.toFixed(2)} = ${perDose.toFixed(2)} → ${isIV ? perDoseRounded.toFixed(1) : perDoseRounded} mg`);
    return { text: `${OPIOID_LABELS[toDrug]} ${isIV ? perDoseRounded.toFixed(1) : perDoseRounded} ${ROUTE_LABELS[toRoute]} q${toFreqHours}h`, steps };
  }
}

/* ======================= Clipboard util ======================= */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && (window as any).isSecureContext !== false) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    console.error("Clipboard API failed:", e);
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch (e) {
    console.error("Clipboard fallback failed:", e);
    return false;
  }
}
