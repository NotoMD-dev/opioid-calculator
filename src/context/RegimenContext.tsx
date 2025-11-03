// src/context/RegimenContext.tsx

"use client";
import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
} from "react";
import {
  HomeMedRow,
  RegimenContextType,
  Severity,
  PainRowSelection,
  PrnRows,
} from "../types";
import {
  generateUniqueId,
  prnSuggestion,
  // NEW: APAP-aware rollup + safety warning
  sumOMEAndAPAP,
  apapSafetyWarning,
} from "../utils/conversionLogic";

const RegimenContext = createContext<RegimenContextType | undefined>(undefined);

export const useRegimenContext = () => {
  const context = useContext(RegimenContext);
  if (context === undefined) {
    throw new Error("useRegimenContext must be used within a RegimenProvider");
  }
  return context;
};

export function RegimenProvider({ children }: { children: React.ReactNode }) {
  // --- Home Regimen State ---
  const [opioidNaive, setOpioidNaive] = useState(false);
  const [homeRows, setHomeRows] = useState<HomeMedRow[]>([
    { id: generateUniqueId(), isPRN: false },
  ]);
  const [continueER, setContinueER] = useState<boolean | null>(null);

  // --- PRN & Multimodal State ---
  const [painRowSelections, setPainRowSelections] = useState<
    Record<Severity, PainRowSelection>
  >({ moderate: {}, severe: {}, breakthrough: {} });
  const [needSpasm, setNeedSpasm] = useState(false);
  const [needNeuropathic, setNeedNeuropathic] = useState(false);
  const [needLocalized, setNeedLocalized] = useState(false);
  const [needGeneral, setNeedGeneral] = useState(false);

  // --- Home Regimen Actions ---
  const updateHomeRow = useCallback(
    (id: string, patch: Partial<HomeMedRow>) => {
      setHomeRows((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r;
          return { ...r, ...patch };
        })
      );
    },
    []
  );

  const addHomeRow = useCallback(() => {
    if (opioidNaive) return;
    setHomeRows((prev) => [...prev, { id: generateUniqueId(), isPRN: false }]);
  }, [opioidNaive]);

  const removeHomeRow = useCallback((id: string) => {
    setHomeRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // --- Side Effects ---
  useEffect(() => {
    if (opioidNaive) {
      setHomeRows([]);
    } else if (!opioidNaive && homeRows.length === 0) {
      setHomeRows([{ id: generateUniqueId(), isPRN: false }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opioidNaive]);

  // --- Calculated Values (OME, APAP, Details) ---
  // NOTE: We keep the public shape { ome, details } so other components don't break.
  const { ome, details } = useMemo(() => {
    const { ome, apap, details: detailLines, notes } = sumOMEAndAPAP(homeRows);
    const lines: string[] = [];

    // Prepend APAP/day line with warning if present
    const warn = apapSafetyWarning(apap);
    lines.push(
      `APAP/day: ${Math.round(apap)} mg${warn ? ` — ${warn.replace(/^⚠️\s*/, "")}` : ""}`
    );

    // Existing detail lines (per-med OME summaries)
    lines.push(...detailLines);

    // Any non-linear / special-case notes
    if (notes.length) lines.push(...notes);

    return { ome, details: lines };
  }, [homeRows]);

  // --- Calculated Values (PRN Suggestions) ---
  const prnRows: PrnRows = useMemo(() => {
    const build = (sev: Severity) => {
      const sel = painRowSelections[sev];
      if (!sel?.drug || !sel?.route || !sel?.freq)
        return { text: "" } as PrnRows[Severity];
      return prnSuggestion(ome, sel.drug, sel.route, sel.freq, sev, {
        opioidNaive,
      });
    };
    return {
      moderate: build("moderate"),
      severe: build("severe"),
      breakthrough: build("breakthrough"),
    };
  }, [ome, painRowSelections, opioidNaive]);

  const contextValue: RegimenContextType = useMemo(
    () => ({
      ome,
      details,
      opioidNaive,
      setOpioidNaive,
      homeRows,
      updateHomeRow,
      addHomeRow,
      removeHomeRow,
      prnRows,
      painRowSelections,
      setPainRowSelections,
      continueER,
      setContinueER,
      needSpasm,
      setNeedSpasm,
      needNeuropathic,
      setNeedNeuropathic,
      needLocalized,
      setNeedLocalized,
      needGeneral,
      setNeedGeneral,
    }),
    [
      ome,
      details,
      opioidNaive,
      homeRows,
      updateHomeRow,
      addHomeRow,
      removeHomeRow,
      prnRows,
      painRowSelections,
      continueER,
      needSpasm,
      needNeuropathic,
      needLocalized,
      needGeneral,
    ]
  );

  return (
    <RegimenContext.Provider value={contextValue}>
      {children}
    </RegimenContext.Provider>
  );
}
