// src/components/RegimenSummary.tsx

"use client";
import React, { useMemo, useState, useEffect } from "react";
import { useRegimenContext } from "../context/RegimenContext";
import { Opioid } from "../types";
import { OPIOID_LABELS, ROUTE_LABELS } from "../utils/constants";
import { fmtDose, copyToClipboard } from "../utils/conversionLogic";
import { Switch } from "./ui/Switch"; // Kept for general use, but not for PRN visibility

export function RegimenSummary() { // Removed showPrnArea and setShowPrnArea from props
  const {
    prnRows,
    homeRows,
    continueER,
    needSpasm,
    needNeuropathic,
    needLocalized,
    needGeneral,
  } = useRegimenContext();

  // --- HYDRATION FIX: Use state to track if the component has mounted on the client ---
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  // ---------------------------------------------------------------------------------

  const [includePrn, setIncludePrn] = useState(true); // Now this state is about showing PRN details, not visibility of the whole section
  // FIX: Removed hideText state and its toggle
  const [copied, setCopied] = useState(false);

  // find actual ER/LA rows
  const erRows = useMemo(
    () => homeRows.filter((r) => r.isER && !r.isPRN),
    [homeRows]
  );

  // turn them into readable strings
  const erStrings = useMemo(
    () =>
      erRows.map((r) => {
        const parts: string[] = [];
        if (r.drug) parts.push(OPIOID_LABELS[r.drug] || r.drug);
        if (typeof r.doseMg === "number" && r.doseMg > 0)
          parts.push(`${r.doseMg} mg`);
        if (r.route) parts.push(ROUTE_LABELS[r.route]);
        if (r.freqHours) parts.push(`q${r.freqHours}h`);
        return parts.join(" ");
      }),
    [erRows]
  );

  const planText = useMemo(() => {
    const lines: string[] = [];
    lines.push("# Pain Management");
    lines.push("Plan:");

    // 1. scheduled — now reacts to continueER
    if (erStrings.length === 0) {
      lines.push("1. Scheduled opiate: No home ER/LA documented.");
    } else {
      const joined = erStrings.join(", ");
      if (continueER === true) {
        lines.push(`1. Scheduled opiate: Continue ${joined}.`);
      } else if (continueER === false) {
        lines.push(`1. Scheduled opiate: Hold ${joined} for now.`);
      } else {
        lines.push(`1. Scheduled opiate: Hold for now.`);
      }
    }

    // 2. PRN section - Always included, but controlled by 'includePrn' toggle
    lines.push("2. PRN pain regimen:");
    lines.push(
      `> Mod: ${prnRows.moderate?.text ? prnRows.moderate.text : "—"}`
    );
    lines.push(
      `> Sev: ${prnRows.severe?.text ? prnRows.severe.text : "—"}`
    );
    lines.push(
      `> BTP: ${prnRows.breakthrough?.text ? prnRows.breakthrough.text : "—"}`
    );

    // 3. multimodal
    lines.push(`3. Multimodal Regimen:`);

    if (!needGeneral && !needNeuropathic && !needSpasm && !needLocalized) {
      lines.push("> * None selected.");
    } else {
      if (needGeneral) {
        lines.push("> * Add scheduled Tylenol 650–1000 mg PO q6h or NSAIDs.");
      }
      if (needNeuropathic) {
        lines.push(
          "> * Add Gabapentin 100–300 mg PO q8–12h (renally adjust)."
        );
      }
      if (needSpasm) {
        lines.push("> * Consider Methocarbamol 500 mg PO q8h PRN spasms.");
      }
      if (needLocalized) {
        lines.push("> * Add localized therapy (lidocaine patch / topical).");
      }
    }

    return lines.join("\n");
  }, [
    erStrings,
    continueER,
    includePrn, // This state is still used to control PRN section details
    prnRows.moderate?.text,
    prnRows.severe?.text,
    prnRows.breakthrough?.text,
    needGeneral,
    needNeuropathic,
    needSpasm,
    needLocalized,
  ]);

  async function handleCopy() {
    if (!planText) return;
    await copyToClipboard(planText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <section className="mt-6"> {/* Removed shadow/border/bg classes */}
      <div className="flex items-center justify-between mb-4 gap-4">
        {/* Removed the extraneous 'Show PRN section' toggle */}
        {/* Removed the 'Hide Text' toggle and its state */}
        {/* The 'Copy Assessment & Plan' button is now the primary interactive element */}
      </div>

      <button
        type="button"
        onClick={handleCopy}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold mb-4 shadow-md transition-colors"
      >
        {copied ? "Copied ✓" : "Copy Assessment & Plan"}
      </button>

      {/* Always show the output text, no longer toggleable */}
      {isMounted && (
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
          <pre
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg
                       text-sm whitespace-pre-wrap font-mono text-gray-800"
          >
            {planText}
          </pre>
        </div>
      )}

      <p className="mt-4 text-xs text-gray-400">
        Doses are rounded to practical units (tablet strengths / IV increments).
        Adjust for renal/hepatic impairment, frailty, and sedation risk.
      </p>
    </section>
  );
}