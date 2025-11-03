// src/components/RegimenSummary.tsx
"use client";
import React, { useMemo, useState } from "react";
import { useRegimenContext } from "../context/RegimenContext";
import { copyToClipboard } from "../utils/conversionLogic";

export function RegimenSummary({
  showPrnArea,
  setShowPrnArea,
}: {
  showPrnArea: boolean;
  setShowPrnArea: (v: boolean) => void;
}) {
  const {
    ome,
    details,
    painRowSelections,
    prnRows,
    needSpasm,
    needNeuropathic,
    needLocalized,
    needGeneral,
    continueER,
  } = useRegimenContext();

  const [copied, setCopied] = useState<null | "plan" | "ap">(null);

  // Build A&P text (simple + readable)
  const planText = useMemo(() => {
    const lines: string[] = [];

    lines.push(`Total OME/day: ${Math.round(ome)} mg`);
    // 'details' already includes APAP/day and per-med lines (plus notes)
    details.forEach((d) => lines.push(d));

    lines.push("");
    lines.push("# Inpatient Regimen");
    if (continueER === true) lines.push("- Continue home ER/LA opioid as ordered.");
    if (continueER === false) lines.push("- Hold ER/LA opioid (reassess daily).");

    if (showPrnArea) {
      const sections = [
        { label: "Moderate", txt: prnRows.moderate?.text || "" },
        { label: "Severe", txt: prnRows.severe?.text || "" },
        { label: "Breakthrough", txt: prnRows.breakthrough?.text || "" },
      ];
      for (const s of sections) {
        if (s.txt) lines.push(`- ${s.label}: ${s.txt}`);
      }
    }

    if (needGeneral) {
      lines.push("- General analgesia: Acetaminophen 1 g PO q6h or NSAIDs if no contraindications.");
    }
    if (needSpasm) {
      lines.push("- Muscle spasm: Methocarbamol 500 mg PO q8h PRN (or tizanidine if preferred).");
    }
    if (needNeuropathic) {
      lines.push("- Neuropathic: Gabapentin 100–300 mg PO q8–12h (renally adjust; monitor sedation).");
    }
    if (needLocalized) {
      lines.push("- Localized therapy: Topical lidocaine or diclofenac to affected area as appropriate.");
    }

    lines.push("");
    lines.push(
      "Rounding: suggested doses are rounded to practical units (tablet strengths / IV increments). Adjust for renal/hepatic impairment, frailty, and sedation risk. Non-linear conversions (e.g., methadone, buprenorphine) shown as conservative estimates."
    );
    lines.push(
      "This tool does not replace clinical judgment. Verify all calculations and consider patient-specific factors."
    );

    return lines.join("\n");
  }, [
    ome,
    details,
    prnRows.moderate?.text,
    prnRows.severe?.text,
    prnRows.breakthrough?.text,
    needSpasm,
    needNeuropathic,
    needLocalized,
    needGeneral,
    continueER,
    showPrnArea,
  ]);

  return (
    <section className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-900">Assessment & Plan</h3>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={showPrnArea}
            onChange={(e) => setShowPrnArea(e.target.checked)}
          />
          Include PRN section
        </label>
      </div>

      <div className="mt-3">
        <pre className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm whitespace-pre-wrap break-words">
          {planText}
        </pre>

        <div className="mt-3 flex gap-3">
          <button
            className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700"
            onClick={async () => {
              const ok = await copyToClipboard(planText);
              setCopied(ok ? "plan" : null);
              setTimeout(() => setCopied(null), 1500);
            }}
          >
            Copy Assessment & Plan
          </button>
          {copied === "plan" && (
            <span className="text-sm text-green-700 self-center">Copied!</span>
          )}
        </div>

        <p className="mt-3 text-xs text-gray-600">
          Doses are rounded to practical units (tablet strengths / IV increments). Adjust for renal/hepatic impairment, frailty, and sedation risk. Non-linear conversions (e.g., methadone, buprenorphine) are displayed conservatively.
        </p>
      </div>
    </section>
  );
}
