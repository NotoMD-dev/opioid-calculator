// src/components/PRNSuggestionTable.tsx
"use client";
import React from "react";
import { useRegimenContext } from "../context/RegimenContext";
import { OPIOID_LABELS, ALLOWED_ROUTES, ROUTE_LABELS } from "../utils/constants";
import { Opioid, Route, Severity } from "../types";

export function PRNSuggestionTable({
  showPrnArea,
  setShowPrnArea,
}: {
  showPrnArea: boolean;
  setShowPrnArea: (v: boolean) => void;
}) {
  const {
    opioidNaive,
    prnRows,
    painRowSelections,
    setPainRowSelections,
    needSpasm,
    setNeedSpasm,
    needNeuropathic,
    setNeedNeuropathic,
    needLocalized,
    setNeedLocalized,
    needGeneral,
    setNeedGeneral,
  } = useRegimenContext();

  const severities: Severity[] = ["moderate", "severe", "breakthrough"];
  const inputClass =
    "w-full h-10 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm";
  const cellClass = "p-2 align-top";

  const handleSel = (
    sev: Severity,
    patch: Partial<{
      drug: Opioid;
      route: Route;
      freq: number;
    }>
  ) => {
    setPainRowSelections({
      ...painRowSelections,
      [sev]: { ...painRowSelections[sev], ...patch },
    });
  };

  return (
    <section className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-900">Inpatient PRN & Multimodal</h3>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={showPrnArea}
            onChange={(e) => setShowPrnArea(e.target.checked)}
          />
          Show PRN area
        </label>
      </div>

      <p className="text-sm text-gray-600 mt-2">
        Computed from total daily OME, then rounded to practical units.{" "}
        <span className="font-medium">Mod ≈10%, Sev ≈15%, BTP ≈10–20% of daily OME.</span> Adjust for renal/hepatic impairment, frailty, and sedation risk.
      </p>

      {showPrnArea && (
        <div className="mt-4 overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-700">
                <th className={cellClass}>Severity</th>
                <th className={cellClass}>Drug</th>
                <th className={cellClass}>Route</th>
                <th className={cellClass}>Freq (h)</th>
                <th className={cellClass}>Suggestion</th>
              </tr>
            </thead>
            <tbody>
              {severities.map((sev) => {
                const sel = painRowSelections[sev] || {};
                const routes = sel.drug ? ALLOWED_ROUTES[sel.drug] : (["oral"] as Route[]);
                const suggestion = prnRows[sev]?.text ?? "";
                return (
                  <tr key={sev} className="border-t">
                    <td className={cellClass}>
                      {sev === "moderate" ? "Moderate" : sev === "severe" ? "Severe" : "Breakthrough"}
                    </td>
                    <td className={cellClass} style={{ minWidth: 220 }}>
                      <select
                        className={inputClass}
                        disabled={opioidNaive}
                        value={sel.drug || ""}
                        onChange={(e) =>
                          handleSel(sev, { drug: e.target.value as Opioid, route: undefined })
                        }
                      >
                        <option value="">Select drug</option>
                        {Object.keys(OPIOID_LABELS)
                          .filter((k) => !["fentanyl_tds", "methadone", "buprenorphine"].includes(k))
                          .map((k) => (
                            <option key={k} value={k}>
                              {OPIOID_LABELS[k as Opioid]}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className={cellClass} style={{ minWidth: 140 }}>
                      <select
                        className={inputClass}
                        disabled={opioidNaive || !sel.drug}
                        value={sel.route || ""}
                        onChange={(e) => handleSel(sev, { route: e.target.value as Route })}
                      >
                        <option value="">Select route</option>
                        {routes?.map((rt) => (
                          <option key={rt} value={rt}>
                            {ROUTE_LABELS[rt]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={cellClass} style={{ minWidth: 120 }}>
                      <input
                        className={inputClass}
                        type="number"
                        placeholder="q?h"
                        disabled={opioidNaive || !sel.drug}
                        value={sel.freq ?? ""}
                        onChange={(e) => handleSel(sev, { freq: Number(e.target.value) || undefined })}
                      />
                    </td>
                    <td className={cellClass} style={{ minWidth: 320 }}>
                      <div className="text-gray-900">{suggestion || <span className="text-gray-400">—</span>}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Multimodal toggles */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Toggle label="Muscle spasm agent PRN" checked={needSpasm} onChange={setNeedSpasm} />
            <Toggle label="Neuropathic agent" checked={needNeuropathic} onChange={setNeedNeuropathic} />
            <Toggle label="Localized therapy" checked={needLocalized} onChange={setNeedLocalized} />
            <Toggle label="General non-opioid analgesia" checked={needGeneral} onChange={setNeedGeneral} />
          </div>
        </div>
      )}
    </section>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="h-4 w-4"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
