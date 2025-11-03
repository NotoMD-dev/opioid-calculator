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
  OPIOID_LABELS,
  ROUTE_LABELS,
  PRN_FRACTIONS,
  FRAIL_FENTANYL_REDUCTION_FACTOR,
  STANDARD_LOW_FACTOR,
  STANDARD_HIGH_FACTOR,
  FRAIL_LOW_FACTOR,
  FRAIL_HIGH_FACTOR,
  IS_COMBO,
  APAP_MAX_MG,
  APAP_CAUTION_MG,
  COMBO_TABLES,
} from "./constants";

/* -------------------------------------------------------------
 * small utilities
 * ----------------------------------------------------------- */

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

/**
 * expose this so other files (like QuickConvert.tsx) can reuse
 */
export function getTargetFactor(drug: Opioid, route: Route): number | null {
  // we don’t do simple table lookup for these
  if (
    drug === "fentanyl_tds" ||
    drug === "methadone" ||
    drug === "buprenorphine"
  )
    return null;
  const byRoute = TARGET_FACTORS[drug];
  if (!byRoute) return null;
  return (
    (byRoute as Record<string, number>)[route] ??
    (byRoute as Record<string, number>).oral ??
    null
  );
}

/* -------------------------------------------------------------
 * MME / APAP from home regimen
 * ----------------------------------------------------------- */

export function mmeOf(input: DoseInput): number | null {
  if (input.drug === "buprenorphine") return null;

  // fentanyl patches: we used the usual “25 mcg/h ≈ 60–90 OME/day”, mid 75
  if (input.drug === "fentanyl_tds") {
    const mid = 75;
    const mcg = input.fentanylPatchMcgPerHr || 0;
    if (!mcg) return null;
    return (mcg / 25) * mid;
  }

  if (input.drug === "methadone") return null;

  const factor = MME_FACTORS[input.drug];
  if (!factor) return null;
  return input.totalDailyDoseMg * factor;
}

/**
 * calculate total daily OME and total daily acetaminophen (APAP)
 * from home rows (PRN + scheduled + combo products)
 */
export function totalHomeOME(rows: HomeMedRow[]): {
  ome: number;
  details: string[];
  apapDailyMg: number;
} {
  let totalOME = 0;
  let totalAPAP = 0;
  const details: string[] = [];

  for (const r of rows) {
    if (!r.drug || !r.route || !r.doseMg) continue;

    const isFentanyl = r.drug === "fentanyl_tds";
    const isCombo = IS_COMBO[r.drug];
    let totalDailyDoseMg = 0;
    let doseType = "";

    if (isFentanyl) {
      totalDailyDoseMg = r.doseMg;
      doseType = "patch (mcg/h)";
    } else if (r.isPRN && r.avgPrnDosesPerDay) {
      totalDailyDoseMg = r.doseMg * r.avgPrnDosesPerDay;
      doseType = `PRN (avg ${fmtDose(r.avgPrnDosesPerDay)}/day)`;
    } else if (!r.isPRN) {
      if (r.freqHours) {
        const dosesPerDay = 24 / r.freqHours;
        totalDailyDoseMg = r.doseMg * dosesPerDay;
        doseType = `Scheduled q${r.freqHours}h`;
      } else {
        totalDailyDoseMg = r.doseMg;
        doseType = "Scheduled (daily assumed)";
      }
      if (r.isER) doseType += " ER/LA";
    }

    // OME part
    if (totalDailyDoseMg > 0 || isFentanyl) {
      const doseInput: DoseInput = {
        drug: r.drug,
        route: r.route,
        totalDailyDoseMg: totalDailyDoseMg,
        fentanylPatchMcgPerHr: isFentanyl ? r.doseMg : undefined,
      };
      const dailyOME = mmeOf(doseInput);
      if (dailyOME !== null) {
        totalOME += dailyOME;
        details.push(
          `${OPIOID_SHORT[r.drug]} ${fmtDose(r.doseMg)} ${
            ROUTE_LABELS[r.route]
          } ${doseType}: ~${Math.round(dailyOME)} OME/day`
        );
      } else {
        details.push(
          `! ${OPIOID_SHORT[r.drug]} ${ROUTE_LABELS[r.route]} ${doseType}: OME N/A (methadone/bupe/missing factor)`
        );
      }
    }

    // APAP part (for combos)
    if (isCombo) {
      const apapPerTab = r.apapPerTabMg || 325;
      let dailyTabs = 0;
      if (r.isPRN) {
        dailyTabs = r.avgPrnDosesPerDay || 0;
      } else if (r.freqHours) {
        dailyTabs = 24 / r.freqHours;
      } else {
        dailyTabs = 1;
      }
      totalAPAP += apapPerTab * dailyTabs;
    }
  }

  // show APAP at top
  details.unshift(`APAP/day: ${Math.round(totalAPAP)} mg`);

  return { ome: totalOME, details, apapDailyMg: totalAPAP };
}

/* -------------------------------------------------------------
 * rotation to another opioid (your earlier logic, just kept)
 * ----------------------------------------------------------- */

export function rotateToTarget(
  ome: number,
  targetDrug: Opioid,
  targetRoute: Route,
  options: SwitchOptions
): RotateTargetResult {
  const { crossToleranceReductionPct, frailOrElderly } = options;
  const notes: string[] = [];

  const adjustedOME = ome * (1 - crossToleranceReductionPct / 100);
  notes.push(
    `1) Cross-tolerance reduction: ${ome.toFixed(1)} OME × (1 - ${
      crossToleranceReductionPct
    }%) = ${adjustedOME.toFixed(1)} OME/day`
  );

  if (targetDrug === "methadone" || targetDrug === "buprenorphine") {
    notes.push(
      `Special agent: ${OPIOID_LABELS[targetDrug]} conversion is complex and requires specialist guidance.`
    );
    return { range: null, notes };
  }

  if (targetDrug === "fentanyl_tds") {
    const standardLow = (adjustedOME / 90) * 25;
    let standardHigh = (adjustedOME / 60) * 25;
    if (frailOrElderly) {
      standardHigh = standardHigh * FRAIL_FENTANYL_REDUCTION_FACTOR;
      notes.push("Frail/Elderly: high end reduced by 25%.");
    }
    const roundLo = roundToPatch(standardLow);
    const roundHi = roundToPatch(standardHigh);
    notes.push(
      `2) Fentanyl conversion: ~${roundLo}–${roundHi} mcg/h patch (rounded to standard patches).`
    );
    return {
      range: null,
      notes,
      fentanylPatchMcgHr: [roundLo, roundHi],
    };
  }

  const factor = getTargetFactor(targetDrug, targetRoute);
  if (!factor) {
    notes.push(
      `Error: missing conversion factor for ${OPIOID_LABELS[targetDrug]} ${ROUTE_LABELS[targetRoute]}.`
    );
    return { range: null, notes };
  }

  const targetDailyMg = adjustedOME / factor;
  notes.push(
    `2) Target factor ${factor}. Calculated daily: ${adjustedOME.toFixed(
      1
    )} ÷ ${factor} = ${targetDailyMg.toFixed(1)} mg/day`
  );

  let lowFactor = STANDARD_LOW_FACTOR;
  let highFactor = STANDARD_HIGH_FACTOR;
  if (frailOrElderly) {
    lowFactor = FRAIL_LOW_FACTOR;
    highFactor = FRAIL_HIGH_FACTOR;
    notes.push("Frail/Elderly: conservative 75–90% range.");
  }

  const low = Math.max(0, roundToTenth(targetDailyMg * lowFactor));
  const high = Math.max(0, roundToTenth(targetDailyMg * highFactor));

  notes.push(
    `3) Suggested daily dose range: ${low.toFixed(1)}–${high.toFixed(1)} mg/day.`
  );

  return { range: [low, high], notes };
}

/* -------------------------------------------------------------
 * PRN suggestion — including combo Percocet/Norco tables
 * ----------------------------------------------------------- */

function comboPrnSuggestion(
  ome: number,
  drug: Opioid,
  freqHours: number,
  severity: Severity,
  apapPerTabFromUI?: number
): PrnSuggestionResult {
  const factor = getTargetFactor(drug, "oral") ?? 1;
  const dosesPerDay = 24 / (freqHours || 4);
  const [loFrac] = PRN_FRACTIONS[severity];
  const targetDailyOpioidMg = ome / factor;
  const neededPerDose = (targetDailyOpioidMg * loFrac) / dosesPerDay;

  const table = COMBO_TABLES[drug] || [];
  let chosen =
    table.find(
      (t) => t.opioidMg >= neededPerDose && t.maxTabsPerDay >= dosesPerDay
    ) || table[table.length - 1];

  if (!chosen) {
    return { text: "Select drug, route, and frequency" };
  }

  // if user selected an APAP/tab in UI, try to match it
  if (apapPerTabFromUI) {
    const match = table.find(
      (t) => t.apapMg === apapPerTabFromUI && t.maxTabsPerDay >= dosesPerDay
    );
    if (match) chosen = match;
  }

  const apapPerDay = chosen.apapMg * dosesPerDay;

  const text = `${OPIOID_SHORT[drug]} ${chosen.opioidMg}/${chosen.apapMg} 1 tab q${freqHours}h PRN`;
  const calcLines = [
    `Base OME: ${ome.toFixed(1)} mg/day`,
    `Target % for ${severity}: ${Math.round(loFrac * 100)}% → ${(targetDailyOpioidMg * loFrac).toFixed(
      1
    )} mg/day opioid equivalent`,
    `Frequency: q${freqHours}h → ${dosesPerDay.toFixed(2)} doses/day`,
    `Needed per dose ≈ ${neededPerDose.toFixed(
      2
    )} mg → mapped to available tab ${chosen.opioidMg}/${chosen.apapMg}`,
    `APAP from this PRN line ≈ ${apapPerDay.toFixed(0)} mg/day (if all doses taken)`,
  ];

  return {
    text,
    calcLines,
    note:
      apapPerDay >= APAP_CAUTION_MG
        ? "High APAP exposure from PRN alone — adjust."
        : undefined,
  };
}

export function prnSuggestion(
  ome: number,
  drug: Opioid,
  route: Route,
  freqHours: number,
  severity: Severity,
  opts?: { opioidNaive?: boolean; apapPerTabMg?: number }
): PrnSuggestionResult {
  if (opts?.opioidNaive) {
    return {
      text: `${OPIOID_SHORT[drug]} — use institutional naïve starting dose`,
    };
  }

  if (ome <= 0) {
    return { text: "Enter home regimen to calculate suggestions." };
  }

  if (
    drug === "fentanyl_tds" ||
    drug === "methadone" ||
    drug === "buprenorphine"
  ) {
    return { text: `${OPIOID_LABELS[drug]} not suggested as PRN in this tool` };
  }

  // combo PRN (Percocet/Norco)
  if (IS_COMBO[drug]) {
    return comboPrnSuggestion(
      ome,
      drug,
      freqHours,
      severity,
      opts?.apapPerTabMg
    );
  }

  // plain opioids
  const factor = getTargetFactor(drug, route) ?? 1;
  const targetDailyMg = ome / factor;
  const [loF, hiF] = PRN_FRACTIONS[severity];

  const perDoseLow = (targetDailyMg * loF) / (24 / freqHours);
  const perDoseHigh = (targetDailyMg * hiF) / (24 / freqHours);

  const drugShort = OPIOID_SHORT[drug];

  const text = `${drugShort} ${fmtDose(
    perDoseLow
  )}${perDoseHigh !== perDoseLow ? "–" + fmtDose(perDoseHigh) : ""} ${ROUTE_LABELS[
    route
  ].toLowerCase()} q${freqHours}h PRN`;

  const calcLines = [
    `Base OME: ${ome.toFixed(1)} mg/day`,
    `Target % for ${severity}: ${Math.round(loF * 100)}–${Math.round(
      hiF * 100
    )}% of daily opioid`,
    `Frequency: q${freqHours}h → ${(24 / freqHours).toFixed(2)} doses/day`,
    `Per-dose (low) ≈ ${perDoseLow.toFixed(2)} mg`,
    `Per-dose (high) ≈ ${perDoseHigh.toFixed(2)} mg`,
  ];

  return {
    text,
    low: perDoseLow,
    high: perDoseHigh,
    calcLines,
  };
}

/* -------------------------------------------------------------
 * clipboard helper (QuickConvert uses this)
 * ----------------------------------------------------------- */

export async function copyToClipboard(text: string): Promise<void> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {}
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } catch {}
  document.body.removeChild(ta);
}

/* -------------------------------------------------------------
 * quick-convert helpers (the simplified 4-line version)
 * ----------------------------------------------------------- */

export function formatQuickConvertSteps(opts: {
  fromDrugLabel: string;
  fromRouteLabel: string;
  fromDailyMg: number;
  fromFactor: number;
  mme: number;
  toDrugLabel: string;
  toRouteLabel: string;
  toFactor: number;
  crossTolerancePct: number;
  finalDailyMg: number;
}): string[] {
  const {
    fromDrugLabel,
    fromRouteLabel,
    fromDailyMg,
    fromFactor,
    mme,
    toDrugLabel,
    toRouteLabel,
    toFactor,
    crossTolerancePct,
    finalDailyMg,
  } = opts;

  return [
    `1) Start: ${fromDrugLabel} ${fromDailyMg.toFixed(1)} mg ${fromRouteLabel}/day`,
    `2) Convert to morphine equivalent: ${fromDailyMg.toFixed(
      1
    )} mg × ${fromFactor} → ${mme.toFixed(1)} mg MED/day`,
    `3) Convert to ${toDrugLabel} (${toRouteLabel}):  ${mme.toFixed(
      1
    )} ÷ ${toFactor}  → ${(mme / toFactor).toFixed(1)} mg/day`,
    `4) Cross-tolerance: ${crossTolerancePct}%`,
    ` → Final conversion= ${finalDailyMg.toFixed(1)} mg/day`,
  ];
}

/**
 * main quick-convert function the component should call
 */
export function quickConvertWithSteps(
  from: {
    drug: Opioid;
    route: Route;
    perDoseMg: number;
    freqHours?: number;
  },
  to: {
    drug: Opioid;
    route: Route;
    targetFreqHours?: number;
  },
  opts: {
    includeFreq: boolean;
    crossTolerancePct: number;
  }
): { displayText: string; steps: string[] } | null {
  const fromFactor = getTargetFactor(from.drug, from.route);
  const toFactor = getTargetFactor(to.drug, to.route);

  if (!fromFactor || !toFactor) return null;

  const fromLabel = OPIOID_LABELS[from.drug];
  const fromRouteLabel = ROUTE_LABELS[from.route];
  const toLabel = OPIOID_LABELS[to.drug];
  const toRouteLabel = ROUTE_LABELS[to.route];

  // 1) per-dose → daily if checkbox is on
  const dailyFrom =
    opts.includeFreq && from.freqHours
      ? from.perDoseMg * (24 / from.freqHours)
      : from.perDoseMg;

  // 2) daily → MED
  const mme = dailyFrom * fromFactor;

  // 3) MED → target daily
  const rawTargetDaily = mme / toFactor;

  // 4) cross-tolerance
  const finalDaily =
    rawTargetDaily * (1 - (opts.crossTolerancePct || 0) / 100);

  // build display line
  let displayText = `${toLabel} ${finalDaily.toFixed(1)} mg ${toRouteLabel}/day`;
  if (opts.includeFreq && to.targetFreqHours) {
    const perDose = finalDaily / (24 / to.targetFreqHours);
    displayText = `${toLabel} ${perDose.toFixed(1)} mg ${toRouteLabel} q${
      to.targetFreqHours
    }h`;
  }

  const steps = formatQuickConvertSteps({
    fromDrugLabel: fromLabel,
    fromRouteLabel,
    fromDailyMg: dailyFrom,
    fromFactor,
    mme,
    toDrugLabel: toLabel,
    toRouteLabel,
    toFactor,
    crossTolerancePct: opts.crossTolerancePct || 0,
    finalDailyMg: finalDaily,
  });

  // add per-dose line if freq is used
  if (opts.includeFreq && to.targetFreqHours) {
    const dosesPerDay = 24 / to.targetFreqHours;
    const perDose = finalDaily / dosesPerDay;
    steps.push(
      ` → Split for q${to.targetFreqHours}h: ${finalDaily.toFixed(
        1
      )} ÷ ${dosesPerDay.toFixed(2)} = ${perDose.toFixed(
        2
      )} mg q${to.targetFreqHours}h`
    );
  }

  return { displayText, steps };
}

/* -------------------------------------------------------------
 * exact daily→daily converter
 * ----------------------------------------------------------- */

export type QuickConvertResult = {
  toDailyMg: number;
  lines: string[];
  warning?: string;
};

export function exactQuickConvert(
  from: {
    drug: Opioid;
    route: Route;
    dailyMg: number;
    fentanylPatchMcgPerHr?: number;
  },
  to: { drug: Opioid; route: Route }
): QuickConvertResult | null {
  if (
    from.drug === "methadone" ||
    from.drug === "buprenorphine" ||
    to.drug === "methadone" ||
    to.drug === "buprenorphine"
  ) {
    return {
      toDailyMg: 0,
      lines: [
        "Conversions with methadone/buprenorphine are non-linear and need specialist guidance.",
      ],
      warning: "Specialist conversion required.",
    };
  }
  if (from.drug === "fentanyl_tds" || to.drug === "fentanyl_tds") {
    return {
      toDailyMg: 0,
      lines: ["Transdermal fentanyl is not handled in this quick tool."],
      warning: "Manual fentanyl conversion recommended.",
    };
  }

  const fromFactor = getTargetFactor(from.drug, from.route);
  const toFactor = getTargetFactor(to.drug, to.route);
  if (!fromFactor || !toFactor) return null;

  const dailyOME = from.dailyMg * fromFactor;
  const toDaily = dailyOME / toFactor;

  return {
    toDailyMg: Number(toDaily.toFixed(1)),
    lines: [
      `From: ${OPIOID_LABELS[from.drug]} ${from.dailyMg.toFixed(
        1
      )} mg ${ROUTE_LABELS[from.route]}/day`,
      `Factor (from): ${fromFactor} → Daily OME = ${from.dailyMg.toFixed(
        1
      )} × ${fromFactor} = ${dailyOME.toFixed(1)}`,
      `Factor (to): ${toFactor} → Target daily mg = ${dailyOME.toFixed(
        1
      )} ÷ ${toFactor} = ${toDaily.toFixed(1)}`,
    ],
  };
}
