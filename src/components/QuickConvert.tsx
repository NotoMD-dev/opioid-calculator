// src/components/QuickConvert.tsx

"use client";
import React, { useState, useEffect, useMemo } from "react";
// --- CORRECTED IMPORTS START ---
import { Opioid, RotateTargetResult, Route } from "../types"; 
import {
  OPIOID_LABELS,
  MME_FACTORS,
  ALLOWED_ROUTES,
  ROUTE_LABELS,
} from "../utils/constants";
import {
  rotateToTarget,
  copyToClipboard,
  roundToTenth,
  fmtDose,
} from "../utils/conversionLogic";
import { Switch } from "./ui/Switch";
// --- CORRECTED IMPORTS END ---

export function QuickConvert() {
  const [fromDrug, setFromDrug] = useState<Opioid>("morphine");
  const [fromRoute, setFromRoute] = useState<Route>("oral");
  const [perDose, setPerDose] = useState<number>(5);
  const [fromFreq, setFromFreq] = useState<number>(6);

  const [toDrug, setToDrug] = useState<Opioid>("hydromorphone");
  const [toRoute, setToRoute] = useState<Route>("oral");
  const [toFreq, setToFreq] = useState<number>(4);

  const [ct, setCt] = useState<number>(25);
  const [frail, setFrail] = useState<boolean>(false);
  const [includeFreq, setIncludeFreq] = useState<boolean>(true);
  const [copyNote, setCopyNote] = useState("");

  useEffect(() => {
    // Sync routes with selected drug
    const allowedTo = ALLOWED_ROUTES[toDrug] || [];
    if (!allowedTo.includes(toRoute)) setToRoute(allowedTo[0]);
    const allowedFrom = ALLOWED_ROUTES[fromDrug] || [];
    if (!allowedFrom.includes(fromRoute)) setFromRoute(allowedFrom[0]);
  }, [toDrug, toRoute, fromDrug, fromRoute]);

  const result = useMemo(() => {
    if (["fentanyl_tds", "methadone", "buprenorphine"].includes(fromDrug)) {
      return {
        text: "From-drug not supported in quick converter.",
        steps: [] as string[],
      };
    }
    const mf = MME_FACTORS[fromDrug];
    if (!mf)
      return { text: "Missing factor for from-drug.", steps: [] as string[] };

    const steps: string[] = [];
    const dosesPerDay = includeFreq
      ? Math.max(1, Math.round(24 / Math.max(1, fromFreq)))
      : 1;
    const dailyMg = perDose * dosesPerDay;
    const fromOME = dailyMg * mf;
    steps.push(
      `0) Input: ${perDose} mg × ${dosesPerDay}/day × ${mf} = ${fromOME.toFixed(
        1
      )} OME/day`
    );

    const adjusted = rotateToTarget(fromOME, toDrug, toRoute, {
      crossToleranceReductionPct: ct,
      frailOrElderly: frail,
    });

    // Type guard function for checking Fentanyl result
    const isFentanylResult = (
      res: RotateTargetResult
    ): res is RotateTargetResult & { fentanylPatchMcgHr: [number, number] } =>
      res.fentanylPatchMcgHr !== undefined;

    if (toDrug === "fentanyl_tds" && isFentanylResult(adjusted)) {
      const [lo, hi] = adjusted.fentanylPatchMcgHr;
      steps.push(...adjusted.notes);
      return { text: `Fentanyl patch ~${lo}–${hi} mcg/h`, steps };
    }
    if (!adjusted.range)
      return {
        text: adjusted.notes.join(" ") || "Conversion not available.",
        steps,
      };

    const [lo, hi] = adjusted.range;
    steps.push(...adjusted.notes);
    steps.push(
      `4) Daily range of target drug: ${lo.toFixed(2)}–${hi.toFixed(
        2
      )} mg/day`
    );

    let out: string;
    if (!includeFreq) {
      const perDoseLo = roundToTenth(lo);
      const perDoseHi = roundToTenth(hi);
      steps.push("5) No frequency: using daily dose range as per-dose equivalent (exact, 0.1 mg).");
      out = `${OPIOID_LABELS[toDrug]} ${fmtDose(perDoseLo)}${
        perDoseHi !== perDoseLo ? `–${fmtDose(perDoseHi)}` : ""
      } ${ROUTE_LABELS[toRoute]}`;
    } else {
      const targetDpd = Math.max(1, Math.round(24 / Math.max(1, toFreq)));
      const perDoseLo = roundToTenth(lo / targetDpd);
      const perDoseHi = roundToTenth(hi / targetDpd);
      steps.push(
        `5) Divide by doses/day (${targetDpd}) with exact 0.1 mg precision.`
      );
      out = `${OPIOID_LABELS[toDrug]} ${fmtDose(perDoseLo)}${
        perDoseHi !== perDoseLo ? `–${fmtDose(perDoseHi)}` : ""
      } ${ROUTE_LABELS[toRoute]} q${toFreq}h`;
    }
    return { text: out, steps };
  }, [
    fromDrug,
    fromRoute,
    perDose,
    fromFreq,
    toDrug,
    toRoute,
    toFreq,
    ct,
    frail,
    includeFreq,
  ]);

  async function handleCopy() {
    const ok = await copyToClipboard(result.text);
    setCopyNote(ok ? "Copied ✓" : "Copy failed — select text below.");
    setTimeout(() => setCopyNote(""), 2500);
  }

  const inputClass =
    "w-full h-10 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-800 text-sm disabled:bg-gray-100 disabled:text-gray-500";
  const labelClass = "block text-xs font-medium text-gray-500 mb-1";
  const checkboxClass = "form-checkbox h-4 w-4 text-indigo-600 rounded";

  return (
    <div className="pt-4 mt-4 border-top border-gray-100">
      <p className="text-sm text-gray-600 mb-4">
        Convert a specific dose of one opioid to another.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div>
          <label className={labelClass}>From drug</label>
          <select
            className={inputClass}
            value={fromDrug}
            onChange={(e) => setFromDrug(e.target.value as Opioid)}
          >
            {Object.keys(OPIOID_LABELS)
              .filter(
                (k) =>
                  k !== "fentanyl_tds" &&
                  k !== "methadone" &&
                  k !== "buprenorphine"
              )
              .map((k: string) => (
                <option key={k} value={k}>
                  {OPIOID_LABELS[k as Opioid]}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>From route</label>
          <select
            className={inputClass}
            value={fromRoute}
            onChange={(e) => setFromRoute(e.target.value as Route)}
          >
            {(ALLOWED_ROUTES[fromDrug] || []).map((rt: Route) => (
              <option key={rt} value={rt}>
                {ROUTE_LABELS[rt]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Per-dose (mg)</label>
          <input
            type="number"
            className={inputClass}
            value={perDose}
            onChange={(e) =>
              setPerDose(Math.max(0, Number(e.target.value) || 0))
            }
          />
        </div>
        <div>
          <label className={labelClass}>From freq (h)</label>
          <select
            className={inputClass}
            value={fromFreq}
            onChange={(e) => setFromFreq(Number(e.target.value))}
            disabled={!includeFreq}
          >
            {[2, 3, 4, 6, 8, 12].map((h) => (
              <option key={h} value={h}>{`q${h}h`}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>To drug</label>
          <select
            className={inputClass}
            value={toDrug}
            onChange={(e) => setToDrug(e.target.value as Opioid)}
          >
            {Object.keys(OPIOID_LABELS)
              .filter((k) => k !== "methadone")
              .map((k: string) => (
                <option key={k} value={k}>
                  {OPIOID_LABELS[k as Opioid]}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>To route</label>
          <select
            className={inputClass}
            value={toRoute}
            onChange={(e) => setToRoute(e.target.value as Route)}
          >
            {(ALLOWED_ROUTES[toDrug] || []).map((rt: Route) => (
              <option key={rt} value={rt}>
                {ROUTE_LABELS[rt]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>To freq (h)</label>
          <select
            className={inputClass}
            value={toFreq}
            onChange={(e) => setToFreq(Number(e.target.value))}
            disabled={!includeFreq}
          >
            {[2, 3, 4, 6, 8, 12].map((h) => (
              <option key={h} value={h}>{`q${h}h`}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Cross-tolerance %↓</label>
          <input
            type="number"
            className={inputClass}
            value={ct}
            onChange={(e) =>
              setCt(Math.max(0, Math.min(95, Number(e.target.value) || 0)))
            }
          />
        </div>
        <div className="flex items-center gap-2 mt-auto h-10">
          <input
            type="checkbox"
            id="qc-frailToggle"
            className={checkboxClass}
            checked={frail}
            onChange={(e) => setFrail(e.target.checked)}
          />
          <label htmlFor="qc-frailToggle" className="text-sm text-gray-600">
            Frail/elderly?
          </label>
        </div>
        <div className="flex items-center gap-2 mt-auto h-10">
          <input
            type="checkbox"
            id="qc-includeFreqToggle"
            className={checkboxClass}
            checked={includeFreq}
            onChange={(e) => setIncludeFreq(e.target.checked)}
          />
          <label htmlFor="qc-includeFreqToggle" className="text-sm text-gray-600">
            Include freq?
          </label>
        </div>

        <div className="col-span-full pt-4">
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
            <div className="text-sm font-semibold text-indigo-700">
              Quick Convert Result
            </div>
            <div className="text-lg font-bold text-indigo-900 mt-1">
              {result.text}
            </div>
            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
              >
                Copy result
              </button>
              {copyNote && (
                <span className="text-xs text-gray-500 flex items-center">
                  {copyNote}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      {result.steps.length > 0 && (
        <details className="text-sm mt-4">
          <summary className="font-medium text-gray-700 cursor-pointer hover:text-indigo-600 transition-colors">
            Show calculation steps
          </summary>
          <ol className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs whitespace-pre-wrap font-mono text-gray-800 list-decimal list-inside space-y-1">
            {result.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}