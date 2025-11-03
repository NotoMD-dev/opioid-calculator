// src/components/PRNSuggestionTable.tsx

"use client";
import React, { useMemo } from "react";
import { useRegimenContext } from "../context/RegimenContext";
import { Opioid, Route, Severity } from "../types";
import { ALLOWED_ROUTES, OPIOID_LABELS, ROUTE_LABELS, PAIN_ROWS } from "../utils/constants";
import { LabeledToggle } from "./ui/LabeledToggle";

export function PRNSuggestionTable({
  showPrnArea, setShowPrnArea,
}: { showPrnArea: boolean; setShowPrnArea: React.Dispatch<React.SetStateAction<boolean>>; }) {
  const {
    opioidNaive,
    homeRows: rows,
    prnRows,
    painRowSelections,
    setPainRowSelections,
    continueER,
    setContinueER,
    needGeneral, setNeedGeneral,
    needNeuropathic, setNeedNeuropathic,
    needSpasm, setNeedSpasm,
    needLocalized, setNeedLocalized,
  } = useRegimenContext();

  const hasERRows = useMemo(() => rows.some((r) => r.isER && !r.isPRN), [rows]);
  const short = (k: Severity) => (k === "moderate" ? "Mod" : k === "severe" ? "Sev" : "BTP");

  return (
    <section className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
      <h3 className="text-xl font-bold text-gray-900">Inpatient Regimen Builder</h3>
      <p className="text-sm text-gray-600 mt-1">
        Doses are calculated as percent of total daily OME.
      </p>
      <p className="text-sm text-gray-600">
        <span className="font-semibold">Mod = 10% Sev = 15% BTP = 10–20%</span> (Ranges are rounded to practical per-dose amounts).
      </p>

      {/* Column headers */}
      <div className="grid grid-cols-5 gap-3 font-semibold text-xs text-gray-600 uppercase mb-2 border-b border-gray-100 pb-2 mt-3">
        <div>Pain Intensity</div><div>Drug</div><div>Route</div><div>Freq</div><div>Proposed regimen (PRN)</div>
      </div>

      {PAIN_ROWS.map((row) => {
        const key = row.key;
        const sel = painRowSelections[key] || {};
        const suggestion = prnRows[key];
        const allowedRoutes = sel.drug ? ALLOWED_ROUTES[sel.drug] : [];
        return (
          <div key={key} className="grid grid-cols-5 gap-3 items-center mb-3">
            <div className="font-semibold text-sm text-gray-800">{short(key)}</div>

            {/* Drug */}
            <select
              className="w-full h-10 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-800 text-sm"
              value={sel.drug ?? ""}
              onChange={(e) => {
                const val = (e.target.value || undefined) as Opioid | undefined;
                setPainRowSelections((p) => ({ ...p, [key]: { ...p[key], drug: val, route: undefined } }));
              }}
            >
              <option value="" disabled>— select —</option>
              {Object.keys(OPIOID_LABELS)
                .filter((k) => k !== "fentanyl_tds" && k !== "methadone" && k !== "buprenorphine")
                .map((k) => <option key={k} value={k}>{OPIOID_LABELS[k as Opioid]}</option>)}
            </select>

            {/* Route */}
            <select
              className="w-full h-10 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-800 disabled:bg-gray-100 text-sm"
              value={sel.route ?? ""}
              disabled={!sel.drug}
              onChange={(e) => {
                const val = (e.target.value || undefined) as Route | undefined;
                setPainRowSelections((p) => ({ ...p, [key]: { ...p[key], route: val } }));
              }}
            >
              <option value="" disabled>— select —</option>
              {allowedRoutes.map((rt) => <option key={rt} value={rt}>{ROUTE_LABELS[rt]}</option>)}
            </select>

            {/* Freq */}
            <select
              className="w-full h-10 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-800 text-sm"
              value={sel.freq ?? ""}
              onChange={(e) =>
                setPainRowSelections((p) => ({ ...p, [key]: { ...p[key], freq: Number(e.target.value) || undefined } }))
              }
            >
              <option value="" disabled>— select —</option>
              {[2, 3, 4, 6, 8, 12].map((h) => <option key={h} value={h}>{`q${h}h`}</option>)}
            </select>

            {/* Proposed */}
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
        );
      })}

      {/* Long-acting decision */}
      {!opioidNaive && hasERRows && (
        <div className="mt-6 pt-4 border-t border-gray-100">
          <div className="font-bold text-sm text-gray-900 mb-2">Long-acting maintenance (from home)</div>
          <div role="radiogroup" aria-label="Continue long-acting home opioid" className="flex gap-2 text-sm">
            {[
              { label: 'YES — continue', value: true, color: 'bg-green-600 border-green-600' },
              { label: 'NO — hold', value: false, color: 'bg-red-500 border-red-500' },
              { label: 'Decide later', value: null, color: 'bg-gray-500 border-gray-500' },
            ].map((opt) => (
              <label
                key={String(opt.value)}
                className={`inline-flex items-center gap-1 px-3 py-1 border rounded-lg cursor-pointer transition-colors font-medium ${continueER === opt.value ? `${opt.color} text-white` : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
                  }`}
              >
                <input type="radio" name="continueER" value={String(opt.value)} checked={continueER === opt.value} onChange={() => setContinueER(opt.value)} className="sr-only" />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Multimodal merged here */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <div className="font-bold text-base text-gray-900">Include Multimodal Pain Medicines</div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
          <LabeledToggle label="Generalized pain?" checked={needGeneral} onChange={setNeedGeneral} />
          <LabeledToggle label="Neuropathy?" checked={needNeuropathic} onChange={setNeedNeuropathic} />
          <LabeledToggle label="Muscle spasms?" checked={needSpasm} onChange={setNeedSpasm} />
          <LabeledToggle label="Localized pain?" checked={needLocalized} onChange={setNeedLocalized} />
        </div>

        <div className="mt-4">
          <div className="font-semibold text-sm text-gray-700 mb-1">Selected multimodal medicines:</div>
          <ul className="pl-5 list-disc space-y-1 text-sm text-gray-700">
            {(needGeneral || needNeuropathic || needSpasm || needLocalized) ? (
              <>
                {needGeneral && <li>Tylenol 650–1000 mg PO q6h or NSAIDs (if no contraindications).</li>}
                {needNeuropathic && <li>Gabapentin 100–300 mg PO q8–12h (renally adjust; caution oversedation).</li>}
                {needSpasm && <li>Methocarbamol 500 mg PO q8h PRN spasm (sedation caution).</li>}
                {needLocalized && <li>Lidocaine 5% patch: apply up to 12 h/day (max 3; avoid broken skin).</li>}
              </>
            ) : (
              <li className="text-gray-500">None selected</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}