// src/components/PRNSuggestionTable.tsx

"use client";
import React, { useMemo, useState } from "react";
import { useRegimenContext } from "../context/RegimenContext";
import { Opioid, Route, Severity } from "../types";
import {
  ALLOWED_ROUTES,
  OPIOID_LABELS,
  ROUTE_LABELS,
  PAIN_ROWS,
  IS_COMBO,
  APAP_PER_TAB_OPTIONS,
  APAP_MAX_MG,
} from "../utils/constants";
import { LabeledToggle } from "./ui/LabeledToggle";
// Note: Removed the unused showPrnArea and setShowPrnArea props

// FIX: Removed the props from the function signature
export function PRNSuggestionTable() {
  const {
    opioidNaive,
    homeRows: rows,
    prnRows,
    painRowSelections,
    setPainRowSelections,
    continueER,
    setContinueER,
    needGeneral,
    setNeedGeneral,
    needNeuropathic,
    setNeedNeuropathic,
    needSpasm,
    setNeedSpasm,
    needLocalized,
    setNeedLocalized,
    // apapDailyMg, // Keeping this commented for now as it's not currently in your provided context
  } = useRegimenContext();

  // FIX: Renamed state to showCalcs to avoid collision and defaulted to false
  const [showCalcs, setShowCalcs] = useState(false); 

  const hasERRows = useMemo(
    () => rows.some((r) => r.isER && !r.isPRN),
    [rows]
  );
  const short = (k: Severity) =>
    k === "moderate" ? "Mod" : k === "severe" ? "Sev" : "BTP";

  const prnUsesCombo = useMemo(() => {
    return Object.values(painRowSelections).some(
      (sel) => sel?.drug && IS_COMBO[sel.drug]
    );
  }, [painRowSelections]);

  const showApapWarning = prnUsesCombo && needGeneral;
  
  return (
    <> {/* Outer Fragment for AccordionStep content */}
        <div className="flex items-center justify-between mb-2">
            <div>
            {/* Removed redundant <h3> header */}
            <p className="text-sm text-gray-600">
                Doses are calculated as percent of total daily OME.
            </p>
            <p className="text-sm text-gray-600">
                <span className="font-semibold">
                Mod = 10% Sev = 15% BTP = 10–20%
                </span>{" "}
                (Ranges are rounded to practical per-dose amounts). Adjust for
                renal/hepatic impairment, frailty, and sedation risk.
            </p>
            </div>
            {/* Removed the redundant 'Show PRN area' toggle */}
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-5 gap-3 font-semibold text-xs text-gray-600 uppercase mb-2 border-b border-gray-100 pb-2 mt-3">
            <div>Pain Intensity</div>
            <div>Drug</div>
            <div>Route</div>
            <div>Freq</div>
            <div>Proposed regimen (PRN)</div>
        </div>

        {PAIN_ROWS.map((row) => {
            const key = row.key;
            const sel = painRowSelections[key] || {};
            const suggestion = prnRows[key];
            const allowedRoutes = sel.drug ? ALLOWED_ROUTES[sel.drug] : [];
            const isCombo = sel.drug ? IS_COMBO[sel.drug] : false;

            return (
              <div key={key} className="mb-3">
                <div className="grid grid-cols-5 gap-3 items-center">
                  <div className="font-semibold text-sm text-gray-800">
                    {short(key)}
                  </div>

                  {/* Drug Selector */}
                  <select
                    className="w-full h-10 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-800 text-sm"
                    value={sel.drug ?? ""}
                    onChange={(e) => {
                      const val = (e.target.value ||
                        undefined) as Opioid | undefined;
                      setPainRowSelections((p) => ({
                        ...p,
                        [key]: {
                          ...p[key],
                          drug: val,
                          route: undefined,
                          apapPerTabMg: undefined,
                        },
                      }));
                    }}
                  >
                    <option value="" disabled>
                      — select —
                    </option>
                    {Object.keys(OPIOID_LABELS)
                      .filter(
                        (k) =>
                          k !== "fentanyl_tds" &&
                          k !== "methadone" &&
                          k !== "buprenorphine"
                      )
                      .map((k) => (
                        <option key={k} value={k}>
                          {OPIOID_LABELS[k as Opioid]}
                        </option>
                      ))}
                  </select>

                  {/* Route Selector */}
                  <select
                    className="w-full h-10 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-800 disabled:bg-gray-100 text-sm"
                    value={sel.route ?? ""}
                    disabled={!sel.drug}
                    onChange={(e) => {
                      const val = (e.target.value ||
                        undefined) as Route | undefined;
                      setPainRowSelections((p) => ({
                        ...p,
                        [key]: { ...p[key], route: val },
                      }));
                    }}
                  >
                    <option value="" disabled>
                      — select —
                    </option>
                    {allowedRoutes.map((rt) => (
                      <option key={rt} value={rt}>
                        {ROUTE_LABELS[rt]}
                      </option>
                    ))}
                  </select>

                  {/* Freq Selector */}
                  <select
                    className="w-full h-10 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-800 text-sm"
                    value={sel.freq ?? ""}
                    onChange={(e) =>
                      setPainRowSelections((p) => ({
                        ...p,
                        [key]: {
                          ...p[key],
                          freq: Number(e.target.value) || undefined,
                        },
                      }))
                    }
                  >
                    <option value="" disabled>
                      — select —
                    </option>
                    {[2, 3, 4, 6, 8, 12].map((h) => (
                      <option key={h} value={h}>
                        {`q${h}h`}
                      </option>
                    ))}
                  </select>

                  {/* Proposed Dose */}
                  <div>
                    {suggestion.text ? (
                      <input
                        readOnly
                        value={`${short(key)}: ${suggestion.text}`}
                        className="w-full h-10 px-3 py-2 border border-blue-200 rounded-lg bg-blue-50 text-blue-800 font-mono text-sm shadow-inner truncate"
                      />
                    ) : (
                      <div className="text-xs text-gray-400 p-2 border border-dashed rounded-lg h-10 flex items-center">
                        Select drug, route, and frequency
                      </div>
                    )}
                  </div>
                </div>

                {/* Only show APAP/tab dropdown if this PRN drug is a combo */}
                {isCombo && (
                  <div className="mt-2 ml-[20%] w-48">
                    <label className="text-xs font-semibold text-orange-600">
                      APAP per tab (mg)
                    </label>
                    <select
                      className="w-full h-9 px-3 py-1 border border-orange-300 rounded-lg bg-orange-50 text-sm"
                      value={sel.apapPerTabMg ?? ""}
                      onChange={(e) =>
                        setPainRowSelections((p) => ({
                          ...p,
                          [key]: {
                            ...p[key],
                            apapPerTabMg: Number(e.target.value) || undefined,
                          },
                        }))
                      }
                    >
                      <option value="">—</option>
                      {APAP_PER_TAB_OPTIONS.map((mg) => (
                        <option key={mg} value={mg}>
                          {mg}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })}

        {/* Long-acting decision */}
        {!opioidNaive && hasERRows && (
            <div className="mt-6 pt-4 border-t border-gray-100">
                <div className="font-bold text-sm text-gray-900 mb-2">
                Long-acting maintenance (from home)
                </div>
                <div
                role="radiogroup"
                aria-label="Continue long-acting home opioid"
                className="flex gap-2 text-sm"
                >
                {[
                    {
                    label: "YES — continue",
                    value: true,
                    color: "bg-green-600 border-green-600",
                    },
                    {
                    label: "NO — hold",
                    value: false,
                    color: "bg-red-500 border-red-500",
                    },
                    {
                    label: "Decide later",
                    value: null,
                    color: "bg-gray-500 border-gray-500",
                    },
                ].map((opt) => (
                    <label
                    key={String(opt.value)}
                    className={`inline-flex items-center gap-1 px-3 py-1 border rounded-lg cursor-pointer transition-colors font-medium ${
                        continueER === opt.value
                        ? `${opt.color} text-white`
                        : "bg-white text-gray-800 border-gray-300 hover:bg-gray-50"
                    }`}
                    >
                    <input
                        type="radio"
                        name="continueER"
                        value={String(opt.value)}
                        checked={continueER === opt.value}
                        onChange={() => setContinueER(opt.value)}
                        className="sr-only"
                    />
                    {opt.label}
                    </label>
                ))}
                </div>
            </div>
        )}

        {/* Multimodal */}
        <div className="mt-6 pt-4 border-t border-gray-100">
            <div className="font-bold text-base text-gray-900">
            Include Multimodal Pain Medicines
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
            <LabeledToggle
                label="General non-opioid analgesia"
                checked={needGeneral}
                onChange={setNeedGeneral}
            />
            <LabeledToggle
                label="Neuropathic agent"
                checked={needNeuropathic}
                onChange={setNeedNeuropathic}
            />
            <LabeledToggle
                label="Muscle spasm agent PRN"
                checked={needSpasm}
                onChange={setNeedSpasm}
            />
            <LabeledToggle
                label="Localized therapy"
                checked={needLocalized}
                onChange={setNeedLocalized}
            />
            </div>

            <div className="mt-4">
              <div className="font-semibold text-sm text-gray-700 mb-1">
                Selected multimodal medicines:
              </div>
              <ul className="pl-5 list-disc space-y-1 text-sm text-gray-700">
                {needGeneral ||
                needNeuropathic ||
                needSpasm ||
                needLocalized ? (
                  <>
                    {needGeneral && (
                      <li>
                        Acetaminophen 1 g PO q6h or NSAIDs (if no
                        contraindications).
                      </li>
                    )}
                    {needNeuropathic && (
                      <li>
                        Gabapentin 100–300 mg PO q8–12h (renally adjust; monitor
                        sedation).
                      </li>
                    )}
                    {needSpasm && (
                      <li>
                        Methocarbamol 500 mg PO q8h PRN spasm (sedation
                        caution).
                      </li>
                    )}
                    {needLocalized && (
                      <li>
                        Topical lidocaine or diclofenac to affected area as
                        appropriate.
                      </li>
                    )}
                  </>
                ) : (
                  <li className="text-gray-500">None selected</li>
                )}
              </ul>
            </div>

            {/* APAP warning */}
            {showApapWarning && (
              <p className="mt-3 text-sm text-orange-500">
                ⚠︎ CAUTION: Potential APAP Overdose. You are suggesting a combination opioid PRN AND a scheduled APAP. Estimate APAP/day. Max dose is {APAP_MAX_MG.toLocaleString()} mg/day.
              </p>
            )}
        </div>

        {/* Show calcs */}
        <button
            type="button"
            className="mt-6 text-sm text-gray-700 flex items-center gap-1"
            onClick={() => setShowCalcs((s) => !s)}
        >
            {showCalcs ? "▾" : "▸"} Show calculation steps
        </button>
        {showCalcs && (
            <div className="mt-2 bg-gray-50 border border-gray-100 rounded-lg p-4 text-sm text-gray-700 space-y-3">
                {PAIN_ROWS.map((row) => {
                    const s = prnRows[row.key];
                    return (
                        <div key={row.key}>
                            <div className="font-semibold uppercase text-xs text-gray-500">
                                {row.label}
                            </div>
                            {s?.calcLines?.length ? (
                                <ul className="list-disc pl-5">
                                    {s.calcLines.map((ln, idx) => (
                                        <li key={idx}>{ln}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-gray-400 text-xs">
                                    Select drug/route/freq above.
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        )}
    </>
  );
}