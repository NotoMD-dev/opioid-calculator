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
  } from "./constants";
  
  // --- General Helpers ---
  
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
  
  // --- Opioid-specific Rounding & Conversions ---
  
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
  
  export function mmeOf(input: DoseInput): number | null {
    if (input.drug === "buprenorphine") return null;
    if (input.drug === "fentanyl_tds") {
      const mid = 75; // 60–90 OME per 25 mcg/h midpoint
      const mcg = input.fentanylPatchMcgPerHr || 0;
      if (!mcg) return null;
      return (mcg / 25) * mid;
    }
    if (input.drug === "methadone") return null;
    const factor = MME_FACTORS[input.drug];
    if (!factor) return null;
    return input.totalDailyDoseMg * factor;
  }
  
  // --- Main Calculation Functions ---
  
  /**
   * Calculates the total daily OME from the home regimen rows.
   * Implements simplified logic for calculating daily dose and doseType.
   */
  export function totalHomeOME(rows: HomeMedRow[]): { ome: number; details: string[] } {
    let total = 0;
    const details: string[] = [];
  
    for (const r of rows) {
      if (!r.drug || !r.route || !r.doseMg) continue;
  
      let totalDailyDoseMg = 0;
      let doseType = "";
      const isFentanyl = r.drug === "fentanyl_tds";
      
      if (isFentanyl) {
        totalDailyDoseMg = r.doseMg; // mcg/h used as proxy for daily dose in mmeOf
        doseType = "patch (mcg/h)";
      } else if (r.isPRN && r.avgPrnDosesPerDay) {
        const dosesPerDay = r.avgPrnDosesPerDay;
        totalDailyDoseMg = r.doseMg * dosesPerDay;
        doseType = `PRN (avg ${fmtDose(dosesPerDay)}/day)`;
      } else if (!r.isPRN) {
          // Scheduled (Non-Fentanyl)
          if (r.freqHours) {
              const dosesPerDay = 24 / r.freqHours;
              totalDailyDoseMg = r.doseMg * dosesPerDay;
              doseType = `Scheduled q${r.freqHours}h`;
          } else {
              // Scheduled, but freq missing (assume dose is daily)
              totalDailyDoseMg = r.doseMg;
              doseType = "Scheduled (Daily dose assumed)";
          }
          if (r.isER) doseType += " ER/LA";
      }
  
      if (totalDailyDoseMg > 0 || isFentanyl) {
        const doseInput: DoseInput = {
          drug: r.drug,
          route: r.route,
          totalDailyDoseMg: totalDailyDoseMg,
          fentanylPatchMcgPerHr: isFentanyl ? r.doseMg : undefined,
        };
        
        const dailyOME = mmeOf(doseInput);
  
        if (dailyOME !== null) {
          total += dailyOME;
          details.push(
            `${OPIOID_SHORT[r.drug]} ${fmtDose(r.doseMg)} ${ROUTE_LABELS[r.route]} ${doseType}: ~${Math.round(dailyOME)} OME/day`
          );
        } else {
          details.push(
            `! ${OPIOID_SHORT[r.drug]} ${ROUTE_LABELS[r.route]} ${doseType}: OME N/A (methadone/bupe/missing factor)`
          );
        }
      }
    }
    return { ome: total, details };
  }
  
  /**
   * Converts a total OME to a target daily dose range.
   * Used for both the Quick Converter (for daily dose calc) and the main flow (which is now removed).
   */
  export function rotateToTarget(
    ome: number,
    targetDrug: Opioid,
    targetRoute: Route,
    options: SwitchOptions
  ): RotateTargetResult {
    const { crossToleranceReductionPct, frailOrElderly } = options;
    const notes: string[] = [];
  
    // 1. Cross-tolerance reduction
    const adjustedOME = ome * (1 - crossToleranceReductionPct / 100);
    notes.push(
      `1) Cross-tolerance reduction: ${ome.toFixed(1)} OME × (1 - ${crossToleranceReductionPct}%) = ${adjustedOME.toFixed(1)} OME/day`
    );
    
    // 2. Special agents (Methadone/Bupe)
    if (targetDrug === "methadone" || targetDrug === "buprenorphine") {
      notes.push(
        `Special agent: ${OPIOID_LABELS[targetDrug]} conversion is complex and requires specialist guidance (e.g., pain/palliative consult).`
      );
      return { range: null, notes };
    }
  
    // 3. Fentanyl Transdermal
    if (targetDrug === "fentanyl_tds") {
      // Fentanyl conversion: 25 mcg/h = 60–90 mg OME/day
      const standardLow = (adjustedOME / 90) * 25; 
      let standardHigh = (adjustedOME / 60) * 25; 
      
      if (frailOrElderly) {
          // Use defined constant
          standardHigh = standardHigh * FRAIL_FENTANYL_REDUCTION_FACTOR; 
          notes.push("Frail/Elderly: High end of patch range reduced by 25%.");
      }
  
      const roundLo = roundToPatch(standardLow);
      const roundHi = roundToPatch(standardHigh);
  
      notes.push(
          `2) Fentanyl conversion: ~${roundLo}–${roundHi} mcg/h patch. (Based on 60–90 OME/25 mcg/h, then rounded to standard patches: ${FENT_PATCHES.join(", ")}).`
      );
  
      return {
        range: null,
        notes,
        fentanylPatchMcgHr: [roundLo, roundHi],
      };
    }
  
    // 4. Standard conversion (oral/IV)
    const factor = getTargetFactor(targetDrug, targetRoute);
    if (!factor) {
      notes.push(
        `Error: Missing conversion factor for ${OPIOID_LABELS[targetDrug]} ${ROUTE_LABELS[targetRoute]}.`
      );
      return { range: null, notes };
    }
  
    const targetDailyMg = adjustedOME / factor;
    notes.push(
      `2) Target conversion factor is ${factor}. Calculated daily dose: ${adjustedOME.toFixed(
        1
      )} OME / ${factor} = ${targetDailyMg.toFixed(1)} mg/day`
    );
  
    let lowFactor = STANDARD_LOW_FACTOR; 
    let highFactor = STANDARD_HIGH_FACTOR; 
    
    if (frailOrElderly) {
        lowFactor = FRAIL_LOW_FACTOR; // Use defined constant
        highFactor = FRAIL_HIGH_FACTOR; // Use defined constant
        notes.push("Frail/Elderly: Range uses a more conservative 75% to 90% of calculated dose.");
    }
    
    const low = targetDailyMg * lowFactor;
    const high = targetDailyMg * highFactor;
  
    const finalLow = Math.max(0, roundToTenth(low));
    const finalHigh = Math.max(0, roundToTenth(high));
  
    notes.push(`3) Suggested daily dose range: ${finalLow.toFixed(1)}–${finalHigh.toFixed(1)} mg/day.`);
  
    return { range: [finalLow, finalHigh], notes };
  }
  
  /**
   * Calculates a PRN suggestion based on OME and severity.
   */
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
      const key = `${drug}|${route}|${severity === "breakthrough" ? "severe" : severity
        }`;
      const base = STARTING[key];
      if (!base) return { text: "Select common drug/route for naïve defaults" };
      const [lo, hi] = base;
      const drugShort = OPIOID_SHORT[drug];
      return {
        text: `${drugShort} ${fmtDose(lo)}${hi !== lo ? "–" + fmtDose(hi) : ""
          } ${ROUTE_LABELS[
            route
          ].toLowerCase()} q${Math.max(2, Math.min(12, Math.round(freqHours)))}h PRN`,
        low: lo,
        high: hi,
      };
    }
  
    if (ome <= 0) return { text: "Enter home regimen to calculate suggestions." };
    if (
      drug === "fentanyl_tds" ||
      drug === "methadone" ||
      drug === "buprenorphine"
    ) {
      return { text: `${OPIOID_LABELS[drug]} not suggested as PRN in this tool` };
    }
  
    const factor = getTargetFactor(drug, route) ?? 1;
    const targetDailyMg = ome / factor;
  
    const [loF, hiF] = PRN_FRACTIONS[severity];
    const perDoseLow = roundPerDose(drug, route, targetDailyMg * loF);
    const perDoseHigh = roundPerDose(drug, route, targetDailyMg * hiF);
  
    const drugShort = OPIOID_SHORT[drug];
  
    return {
      text: `${drugShort} ${fmtDose(perDoseLow)}${perDoseHigh !== perDoseLow ? "–" + fmtDose(perDoseHigh) : ""
        } ${ROUTE_LABELS[
          route
        ].toLowerCase()} q${Math.max(2, Math.min(12, Math.round(freqHours)))}h PRN`,
      low: perDoseLow,
      high: perDoseHigh,
      note: `${Math.round(loF * 100)}${hiF !== loF ? "–" + Math.round(hiF * 100) : ""
        }% of target daily dose`,
    };
  }
  
  
  /**
   * Cleans up the copy function to be non-blocking and return success/failure.
   */
  export async function copyToClipboard(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard && (window as any).isSecureContext !== false) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {
      console.error("Clipboard API failed:", e);
    }
  
    // Fallback (rarely needed or allowed now, but kept for robustness)
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