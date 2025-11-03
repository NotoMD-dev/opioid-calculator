// src/components/QuickConvert.tsx
"use client";
import React, { useMemo, useState } from "react";
import { Opioid, Route } from "../types";
import {
  OPIOID_LABELS,
  ROUTE_LABELS,
  ALLOWED_ROUTES,
} from "../utils/constants";
import { exactQuickConvert } from "../utils/conversionLogic";

export function QuickConvert() {
  const [fromDrug, setFromDrug] = useState<Opioid>("oxycodone");
  const [fromRoute, setFromRoute] = useState<Route>("oral");
  const [toDrug, setToDrug] = useState<Opioid>("hydromorphone");
  const [toRoute, setToRoute] = useState<Route>("oral");

  const [includeFreq, setIncludeFreq] = useState<boolean>(true);
  const [fromFreq, setFromFreq] = useState<number>(6);
  const [toFreq, setToFreq] = useState<number>(6);

  const [perDose, setPerDose] = useState<number>(10); // if includeFreq=false, treated as DAILY mg
  const [ct, setCt] = useState<number>(0); // cross-tolerance %

  const result = useMemo(() => {
    try {
      const { text, steps } = exactQuickConvert({
        fromDrug,
        fromRoute,
        toDrug,
        toRoute,
        includeFreq,
        fromDoseMg: Number(perDose) || 0,
        fromFreqHours: includeFreq ? Number(fromFreq) || 24 : undefined,
        toFreqHours: includeFreq ? Number(toFreq) || 24 : undefined,
        crossTolerancePct: Number(ct) || 0,
      });
      return { text, steps };
    } catch {
      return { text: "Unable to compute conversion.", steps: [] as string[] };
    }
  }, [fromDrug, fromRoute, toDrug, toRoute, includeFreq, fromFreq, toFreq, perDose, ct]);

  const drugKeys = (Object.keys(OPIOID_LABELS) as Opioid[]).filter(
    (k) => !["methadone", "buprenorphine"].includes(k) // keep out as targets for clarity
  );

  const inputClass =
    "w-full h-10 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm";

  const routesFrom = ALLOWED_ROUTES[fromDrug] || ["oral"];
  const routesTo = ALLOWED_ROUTES[toDrug] || ["oral"];

  return (
    <div className="mt-4 grid gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* From */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <h4 className="font-semibold mb-3 text-gray-900">From</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Drug</label>
              <select
                className={inputClass}
                value={fromDrug}
                onChange={(e) => {
                  const d = e.target.value as Opioid;
                  setFromDrug(d);
                  setFromRoute(ALLOWED_ROUTES[d]?.[0] ?? "oral");
                }}
              >
                {(Object.keys(OPIOID_LABELS) as Opioid[]).map((k) => (
                  <option key={k} value={k}>
                    {OPIOID_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Route</label>
              <select
                className={inputClass}
                value={fromRoute}
                onChange={(e) => setFromRoute(e.target.value as Route)}
              >
                {routesFrom.map((r) => (
                  <option key={r} value={r}>
                    {ROUTE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs text-gray-600 mb-1">
                {includeFreq ? "Per-dose amount (mg)" : "Daily amount (mg)"}
              </label>
              <input
                className={inputClass}
                type="number"
                value={perDose}
                onChange={(e) => setPerDose(Number(e.target.value) || 0)}
              />
            </div>

            <div className="col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={includeFreq}
                onChange={(e) => setIncludeFreq(e.target.checked)}
              />
              <span className="text-sm text-gray-700">Include frequency</span>
            </div>

            {includeFreq && (
              <div>
                <label className="block text-xs text-gray-600 mb-1">Freq (q?h)</label>
                <input
                  className={inputClass}
                  type="number"
                  value={fromFreq}
                  onChange={(e) => setFromFreq(Number(e.target.value) || 0)}
                />
              </div>
            )}
          </div>
        </div>

        {/* To */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <h4 className="font-semibold mb-3 text-gray-900">To</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Drug</label>
              <select
                className={inputClass}
                value={toDrug}
                onChange={(e) => {
                  const d = e.target.value as Opioid;
                  setToDrug(d);
                  setToRoute(ALLOWED_ROUTES[d]?.[0] ?? "oral");
                }}
              >
                {drugKeys.map((k) => (
                  <option key={k} value={k}>
                    {OPIOID_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Route</label>
              <select
                className={inputClass}
                value={toRoute}
                onChange={(e) => setToRoute(e.target.value as Route)}
              >
                {routesTo.map((r) => (
                  <option key={r} value={r}>
                    {ROUTE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>

            {includeFreq && (
              <div className="col-span-2">
                <label className="block text-xs text-gray-600 mb-1">Target Freq (q?h)</label>
                <input
                  className={inputClass}
                  type="number"
                  value={toFreq}
                  onChange={(e) => setToFreq(Number(e.target.value) || 0)}
                />
              </div>
            )}

            <div className="col-span-2">
              <label className="block text-xs text-gray-600 mb-1">Cross-tolerance reduction (%)</label>
              <input
                className={inputClass}
                type="number"
                value={ct}
                onChange={(e) => setCt(Number(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Output */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="text-gray-900 font-semibold">
          {result.text || "—"}
        </div>
        {result.steps.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-sm font-medium">Show steps</summary>
            <ol className="mt-2 space-y-1 text-sm">
              {result.steps.map((s, i) => (
                <li key={i}>
                  {i + 1}. {s}
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>
    </div>
  );
}
