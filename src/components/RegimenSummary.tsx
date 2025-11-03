// src/components/RegimenSummary.tsx
"use client";
import React, { useMemo, useState, useEffect } from "react";
import { useRegimenContext } from "../context/RegimenContext";
import { Opioid } from "../types";
import { OPIOID_LABELS, ROUTE_LABELS } from "../utils/constants";
import { fmtDose, copyToClipboard } from "../utils/conversionLogic";
import { Switch } from "./ui/Switch";

export function RegimenSummary({
  showPrnArea,
  setShowPrnArea,
}: {
  showPrnArea: boolean;
  setShowPrnArea: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const {
    prnRows,
    homeRows,
    continueER,
    needSpasm,
    needNeuropathic,
    needLocalized,
    needGeneral,
  } = useRegimenContext();

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  const longActFormattedList = useMemo(
    () =>
      homeRows
        .filter((r) => r.isER && !r.isPRN)
        .map(
          (r) =>
            `${OPIOID_LABELS[r.drug as Opioid]} ${fmtDose(
              r.doseMg as number
            )} ${r.route ? ROUTE_LABELS[r.route] : ""}${
              r.freqHours ? ` q${r.freqHours}h` : ""
            }`
        ),
    [homeRows]
  );

  const scheduledParts: string[] = [];
  let action: string = "No home ER/LA documented.";

  if (continueER === true && longActFormattedList.length > 0) {
    scheduledParts.push(...longActFormattedList);
    action = `Continue home ER/LA: ${scheduledParts.join(" + ")}`;
  } else if (continueER === false && longActFormattedList.length > 0) {
    action = `HOLD home ER/LA regimen: ${longActFormattedList.join(" + ")}`;
  } else if (longActFormattedList.length === 0) {
    action = "No home ER/LA documented.";
  }

  const selectedAdjuncts: string[] = [
    needGeneral && "Add scheduled Tylenol 650–1000 mg PO q6h or NSAIDs",
    needNeuropathic && "Add Gabapentin 100–300 mg PO q8–12h",
    needSpasm && "Consider Methocarbamol 500 mg PO q8h for PRN spasms",
    needLocalized && "Add Lidocaine 5% patch to affected areas up to 12 h/day",
  ].filter(Boolean) as string[];

  const prnLines = [
    prnRows.moderate.text ? `> Mod: ${prnRows.moderate.text}` : "> Moderate Pain: —",
    prnRows.severe.text ? `> Sev: ${prnRows.severe.text}` : "> Severe Pain: —",
    prnRows.breakthrough.text ? `> BTP: ${prnRows.breakthrough.text}` : "> Breakthrough Pain: —",
  ].join("\n");

  const mmList = selectedAdjuncts.length
    ? selectedAdjuncts.map((x) => `>  * ${x}`).join("\n")
    : ">  * None selected";

  const planText = `# Pain Management
Plan:
1. Scheduled opiate: ${action}
2. PRN pain regimen:
${prnLines}
3. Multimodal Regimen:
${mmList}
`;

  async function handleCopy() {
    const ok = await copyToClipboard(planText);
    alert(ok ? "Assessment & Plan copied to clipboard!" :
      "Copy failed — check browser permissions or select text manually.");
  }

  // ✅ Make this a boolean so JSX never receives a bare number
  const showHoldWarning =
    isMounted &&
    scheduledParts.length === 0 &&
    longActFormattedList.length > 0 &&
    continueER === null;

  return (
    <section className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-900">Final Regimen Summary (A&P Format)</h3>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-600">
            {showPrnArea ? "Hide" : "Show"} text
          </span>
          <Switch checked={showPrnArea} onChange={setShowPrnArea} />
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-colors"
          onClick={handleCopy}
        >
          Copy Assessment & Plan
        </button>

        {showHoldWarning && (
          <span className="text-red-500 text-sm flex items-center">
            * Warning: Please select YES/NO for home ER/LA to finalize action.
          </span>
        )}
      </div>

      {isMounted ? (
        <div className={showPrnArea ? "mt-4 block" : "hidden"}>
          <pre className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm whitespace-pre-wrap font-mono text-gray-800">
            {planText}
          </pre>
        </div>
      ) : (
        <div className={showPrnArea ? "mt-4 block" : "hidden"} />
      )}
    </section>
  );
}
