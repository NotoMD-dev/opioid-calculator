// src/components/RegimenSummary.tsx
"use client";

import React, { useMemo, useState } from "react";
import { useRegimenContext } from "../context/RegimenContext";
import { OPIOID_LABELS, ROUTE_LABELS } from "../utils/constants";

async function copyTextToClipboard(text: string) {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {}
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } catch {}
  document.body.removeChild(ta);
}

export function RegimenSummary() {
  const {
    homeRows,
    continueER,
    prnRows,
    needGeneral,
    needNeuropathic,
    needSpasm,
    needLocalized,
  } = useRegimenContext();

  const [includePrn, setIncludePrn] = useState(true);
  const [hideText, setHideText] = useState(false);
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

  const summaryText = useMemo(() => {
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

    // 2. PRN section
    if (includePrn) {
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
    }

    // 3. multimodal
    lines.push(`${includePrn ? "3." : "2."} Multimodal Regimen:`);

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
    includePrn,
    prnRows.moderate?.text,
    prnRows.severe?.text,
    prnRows.breakthrough?.text,
    needGeneral,
    needNeuropathic,
    needSpasm,
    needLocalized,
  ]);

  async function handleCopy() {
    if (!summaryText) return;
    await copyTextToClipboard(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <section className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 mt-6">
      <div className="flex items-center justify-between mb-4 gap-4">
        <h3 className="text-xl font-semibold text-gray-900">
          Final Regimen Summary (A&amp;P Format)
        </h3>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={includePrn}
              onChange={(e) => setIncludePrn(e.target.checked)}
              className="rounded"
            />
            Include PRN section
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            Hide text
            <button
              type="button"
              onClick={() => setHideText((s) => !s)}
              className={`w-11 h-6 rounded-full transition relative ${
                hideText ? "bg-indigo-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition ${
                  hideText ? "right-0.5" : "left-0.5"
                }`}
              />
            </button>
          </label>
        </div>
      </div>

      <button
        type="button"
        onClick={handleCopy}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold mb-4"
      >
        {copied ? "Copied ✓" : "Copy Assessment & Plan"}
      </button>

      {!hideText && (
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
          <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono leading-relaxed">
            {summaryText}
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
