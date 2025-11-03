// src/components/HomeRegimenInput.tsx
"use client";
import React, { useMemo } from "react";
import { useRegimenContext } from "../context/RegimenContext";
import {
  OPIOID_LABELS,
  ALLOWED_ROUTES,
  ROUTE_LABELS,
  IS_COMBO,
  APAP_PER_TAB,
} from "../utils/constants";
import { HomeMedRow, Opioid, Route } from "../types";

export function HomeRegimenInput() {
  const {
    opioidNaive,
    setOpioidNaive,
    homeRows,
    updateHomeRow,
    addHomeRow,
    removeHomeRow,
  } = useRegimenContext();

  const opioidOptions = useMemo(
    () =>
      Object.keys(OPIOID_LABELS) as Opioid[], // includes combo products
    []
  );

  const inputClass =
    "w-full h-10 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm";

  const cellClass = "p-2 align-top";

  const isFentanyl = (d?: Opioid) => d === "fentanyl_tds";

  return (
    <section className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Home Regimen</h2>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={opioidNaive}
            onChange={(e) => setOpioidNaive(e.target.checked)}
          />
          Opioid-naïve
        </label>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        Enter the patient’s home regimen. If using combo products (Percocet/Norco),
        set the **APAP per tab**; APAP (acetaminophen) is not counted in MME but is
        tallied toward daily APAP total.
      </p>

      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-700">
              <th className={cellClass}>Drug</th>
              <th className={cellClass}>Route</th>
              <th className={cellClass}>Dose</th>
              <th className={cellClass}>Freq (h)</th>
              <th className={cellClass}>PRN?</th>
              <th className={cellClass}>Avg PRN/day</th>
              <th className={cellClass}>ER/LA</th>
              <th className={cellClass}>Remove</th>
            </tr>
          </thead>
          <tbody>
            {homeRows.map((r) => {
              const routes = r.drug ? ALLOWED_ROUTES[r.drug] : (["oral"] as Route[]);
              const needAvgPrn = r.isPRN && !r.avgPrnDosesPerDay;
              return (
                <tr key={r.id} className="border-t">
                  {/* Drug */}
                  <td className={cellClass} style={{ minWidth: 220 }}>
                    <select
                      className={inputClass}
                      value={r.drug || ""}
                      onChange={(e) =>
                        updateHomeRow(r.id, {
                          drug: e.target.value as Opioid,
                          route: undefined,
                          doseMg: undefined,
                          avgPrnDosesPerDay: undefined,
                          apapPerTabMg: undefined,
                        })
                      }
                      disabled={opioidNaive}
                    >
                      <option value="">Select drug</option>
                      {opioidOptions.map((k) => (
                        <option key={k} value={k}>
                          {OPIOID_LABELS[k]}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Route */}
                  <td className={cellClass} style={{ minWidth: 140 }}>
                    <select
                      className={inputClass}
                      value={r.route || ""}
                      onChange={(e) =>
                        updateHomeRow(r.id, { route: e.target.value as Route })
                      }
                      disabled={opioidNaive || !r.drug}
                    >
                      <option value="">Select route</option>
                      {routes?.map((rt) => (
                        <option key={rt} value={rt}>
                          {ROUTE_LABELS[rt]}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Dose + APAP selector for combos */}
                  <td className={cellClass} style={{ minWidth: 200 }}>
                    <div className="grid gap-2">
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
                      {r.drug && IS_COMBO(r.drug) && (
                        <div>
                          <label className="block text-[11px] text-gray-600 mb-1">
                            APAP per tab (mg)
                          </label>
                          <select
                            className={`${inputClass} h-9`}
                            value={r.apapPerTabMg ?? 325}
                            onChange={(e) =>
                              updateHomeRow(r.id, {
                                apapPerTabMg: Number(e.target.value) || undefined,
                              })
                            }
                          >
                            {APAP_PER_TAB.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                          <p className="text-[10px] text-gray-500 mt-1">
                            APAP is excluded from MME but summed toward daily maximum.
                          </p>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Freq */}
                  <td className={cellClass} style={{ minWidth: 120 }}>
                    <input
                      disabled={
                        opioidNaive || !r.drug || isFentanyl(r.drug) || r.isPRN
                      }
                      type="number"
                      placeholder="q?h"
                      className={inputClass}
                      value={r.freqHours ?? ""}
                      onChange={(e) =>
                        updateHomeRow(r.id, {
                          freqHours: Number(e.target.value) || undefined,
                        })
                      }
                    />
                  </td>

                  {/* PRN */}
                  <td className={cellClass} style={{ minWidth: 80 }}>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={!!r.isPRN}
                      disabled={opioidNaive || isFentanyl(r.drug)}
                      onChange={(e) =>
                        updateHomeRow(r.id, {
                          isPRN: e.target.checked,
                          // clear freq if switching to PRN
                          freqHours: e.target.checked ? undefined : r.freqHours,
                        })
                      }
                    />
                  </td>

                  {/* Avg PRN/day */}
                  <td className={cellClass} style={{ minWidth: 140 }}>
                    <input
                      disabled={!r.isPRN || opioidNaive}
                      type="number"
                      placeholder="avg/day"
                      className={`${inputClass} ${
                        needAvgPrn ? "border-red-400 ring-red-300" : ""
                      }`}
                      value={r.avgPrnDosesPerDay ?? ""}
                      onChange={(e) =>
                        updateHomeRow(r.id, {
                          avgPrnDosesPerDay: Number(e.target.value) || undefined,
                        })
                      }
                    />
                    {needAvgPrn && (
                      <p className="text-[10px] text-red-600 mt-1">
                        avg PRN/day needed for calculation
                      </p>
                    )}
                  </td>

                  {/* ER/LA */}
                  <td className={cellClass} style={{ minWidth: 80 }}>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={!!r.isER}
                      disabled={opioidNaive || isFentanyl(r.drug) || r.isPRN}
                      onChange={(e) =>
                        updateHomeRow(r.id, { isER: e.target.checked })
                      }
                    />
                  </td>

                  {/* Remove */}
                  <td className={cellClass} style={{ minWidth: 90 }}>
                    <button
                      className="px-3 py-2 rounded-md text-sm bg-gray-100 hover:bg-gray-200"
                      onClick={() => removeHomeRow(r.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex gap-3">
        <button
          className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50"
          disabled={opioidNaive}
          onClick={addHomeRow}
        >
          Add item
        </button>
        <button
          className="px-4 py-2 rounded-md bg-gray-100 text-gray-800 text-sm hover:bg-gray-200"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          Back to top
        </button>
      </div>
    </section>
  );
}
