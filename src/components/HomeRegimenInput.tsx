// src/components/HomeRegimenInput.tsx

"use client";
import React, { useMemo } from "react";
import { useRegimenContext } from "../context/RegimenContext";
import { HomeMedRow, Opioid, Route } from "../types";
import { OPIOID_LABELS, ALLOWED_ROUTES, ROUTE_LABELS } from "../utils/constants";
import { fmtDose } from "../utils/conversionLogic";
import { MMEEquivCompactTable } from "./ui/MMEEquivCompactTable";

export function HomeRegimenInput() {
  const {
    opioidNaive,
    setOpioidNaive,
    homeRows: rows,
    addHomeRow,
    updateHomeRow,
    removeHomeRow,
    ome,
    details,
  } = useRegimenContext();

  const isFentanyl = (drug?: Opioid) => drug === "fentanyl_tds";
  const inputClass =
    "w-full h-10 px-2 py-2 border border-gray-300 rounded-lg bg-white text-gray-800 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow disabled:bg-gray-100 disabled:text-gray-500";
  const checkClass =
    "form-checkbox h-5 w-5 rounded transition-colors text-indigo-600 focus:ring-indigo-500";

  // 8-column grid
  const rowGridStyle = {
    gridTemplateColumns:
      "1.5fr 1fr 1.2fr 1.2fr 0.5fr 1.3fr 0.7fr 0.2fr",
  } as const;

  const buttonStyle = "px-4 py-2 text-sm font-semibold rounded-lg transition-colors shadow-md";
  const removeButtonStyle =
    "p-1 border border-transparent text-red-500 rounded-md hover:bg-red-50 hover:border-red-300 transition-colors h-8 w-8 text-lg flex items-center justify-center";

  return (
    <> {/* Replaced outer section and its classes with a fragment */}
      <div className="flex justify-between items-center gap-3 mb-4">
        {/* Removed redundant <h3> header */}
        <div className="flex items-center gap-4 ml-auto">
          <label className="flex items-center gap-2 text-base font-semibold text-gray-800 cursor-pointer">
            <input
              type="checkbox"
              className="form-checkbox h-5 w-5 text-indigo-600 rounded focus:ring-indigo-500"
              checked={opioidNaive}
              onChange={(e) => setOpioidNaive(e.target.checked)}
            />
            Opioid-naïve
          </label>
          <button
            type="button"
            className={`${buttonStyle} ${opioidNaive
                ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700 text-white"
              }`}
            onClick={addHomeRow}
            disabled={opioidNaive}
          >
            + Add item
          </button>
        </div>
      </div>

      {rows.length === 0 && opioidNaive ? (
        <div className="p-4 text-center text-gray-500 bg-gray-50 rounded-lg text-sm">
          Input disabled because the patient is marked as opioid naïve.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            {/* LABELS */}
            <div
              className="grid gap-3 text-xs font-semibold text-gray-600 uppercase mb-2 px-1"
              style={rowGridStyle}
            >
              <div>Drug</div>
              <div>Route</div>
              <div>Dose (mg)</div>
              <div>Freq (hours)</div>
              <div>PRN?</div>
              <div className="text-gray-400">Avg PRN/Day</div>
              <div>ER / LA?</div>
              <div />
            </div>

            {/* ROWS */}
            {rows.map((r: HomeMedRow) => {
              const needsAvg =
                !!r.isPRN && !Number.isFinite(r.avgPrnDosesPerDay as number);
              return (
                <div
                  key={r.id}
                  className="grid gap-3 items-start p-2 mb-2 border-b border-gray-100 last:border-b-0"
                  style={rowGridStyle}
                >
                  {/* ... Row Content ... (omitted for brevity, it is unchanged) */}
                  {/* 1: Drug */}
                  <select
                    className={inputClass}
                    disabled={opioidNaive}
                    value={r.drug ?? ""}
                    onChange={(e) =>
                      updateHomeRow(r.id, {
                        drug: (e.target.value || undefined) as Opioid | undefined,
                        route: undefined,
                      })
                    }
                  >
                    <option value="" disabled>
                      — select —
                    </option>
                    {Object.keys(OPIOID_LABELS).map((k: string) => (
                      <option key={k} value={k}>
                        {OPIOID_LABELS[k as Opioid]}
                      </option>
                    ))}
                  </select>

                  {/* 2: Route */}
                  <select
                    className={inputClass}
                    disabled={opioidNaive || !r.drug}
                    value={r.route ?? ""}
                    onChange={(e) => {
                      const next = (e.target.value || undefined) as
                        | Route
                        | undefined;
                      updateHomeRow(r.id, { route: next });
                    }}
                  >
                    <option value="" disabled>
                      — select —
                    </option>
                    {(r.drug ? ALLOWED_ROUTES[r.drug] : []).map(
                      (rt: Route) => (
                        <option key={rt} value={rt}>
                          {ROUTE_LABELS[rt]}
                        </option>
                      )
                    )}
                  </select>

                  {/* 3: Dose */}
                  <input
                    disabled={opioidNaive || !r.drug}
                    type="number"
                    placeholder={isFentanyl(r.drug) ? "mcg/h" : "mg"}
                    className={inputClass}
                    value={r.doseMg ?? ""}
                    onChange={(e) =>
                      updateHomeRow(r.id, {
                        doseMg: Number(e.target.value) || undefined,
                      })
                    }
                  />

                  {/* 4: Freq */}
                  <input
                    disabled={opioidNaive || !r.drug || isFentanyl(r.drug)}
                    type="number"
                    placeholder={isFentanyl(r.drug) ? "N/A" : ""}
                    className={inputClass}
                    value={r.freqHours ?? ""}
                    onChange={(e) =>
                      updateHomeRow(r.id, {
                        freqHours: Number(e.target.value) || undefined,
                      })
                    }
                  />

                  {/* 5: PRN? */}
                  <div className="flex items-center justify-start h-10 pt-1">
                    <input
                      disabled={opioidNaive || !r.drug || !!r.isER}
                      type="checkbox"
                      className={`${checkClass} ${r.isER ? "text-gray-400" : "text-indigo-600"
                        }`}
                      checked={!!r.isPRN}
                      onChange={(e) =>
                        updateHomeRow(r.id, {
                          isPRN: e.target.checked,
                          isER: e.target.checked ? false : r.isER,
                        })
                      }
                    />
                  </div>

                  {/* 6: Avg PRN/day */}
                  <div
                    className={`transition-all duration-100 ${r.isPRN ? "visible opacity-100" : "invisible opacity-0"
                      }`}
                  >
                    <input
                      disabled={opioidNaive || !r.drug || !r.isPRN}
                      type="number"
                      placeholder={needsAvg ? "Req." : "e.g., 4"}
                      className={`${inputClass} h-10 ${needsAvg ? "border-red-500 bg-red-50" : ""
                        }`}
                      value={r.avgPrnDosesPerDay ?? ""}
                      onChange={(e) =>
                        updateHomeRow(r.id, {
                          avgPrnDosesPerDay:
                            Number(e.target.value) || undefined,
                        })
                      }
                    />
                    {needsAvg && (
                      <p className="text-red-500 text-[10px] mt-1 font-semibold">
                        Needed for OME calc.
                      </p>
                    )}
                  </div>

                  {/* 7: ER/LA? */}
                  <div className="flex items-center justify-start h-10 pt-1">
                    <input
                      disabled={opioidNaive || !r.drug || !!r.isPRN}
                      type="checkbox"
                      className={`${checkClass} ${r.isPRN ? "text-gray-400" : "text-indigo-600"
                        }`}
                      checked={!!r.isER}
                      onChange={(e) =>
                        updateHomeRow(r.id, {
                          isER: e.target.checked,
                          isPRN: e.target.checked ? false : r.isPRN,
                        })
                      }
                    />
                  </div>

                  {/* 8: Remove */}
                  <div className="flex items-center justify-start h-10 pt-1">
                    {rows.length > 1 && (
                      <button
                        title="Remove"
                        type="button"
                        onClick={() => removeHomeRow(r.id)}
                        className={removeButtonStyle}
                      >
                        &times;
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* OME Summary Bar — LEFT: breakdown+equivalents, RIGHT: total OME */}
      {!opioidNaive && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* LEFT */}
            <div className="space-y-3">
              <details className="text-sm">
                <summary className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 cursor-pointer">
                  OME breakdown
                </summary>
                <ul className="mt-2 pl-5 list-disc space-y-1 text-gray-700">
                  {details.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </details>

              <details className="text-sm">
                <summary className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 cursor-pointer">
                  Dosing equivalents (reference)
                </summary>
                <div className="mt-2">
                  <MMEEquivCompactTable />
                </div>
              </details>
            </div>

            {/* RIGHT */}
            <div className="flex lg:justify-end">
              <div className="text-xl lg:text-2xl font-extrabold text-gray-900">
                Total estimated HOME OME:
                <span className="text-indigo-700 ml-2">~{Math.round(ome)} mg/day</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </> // Closing Fragment
  );
}