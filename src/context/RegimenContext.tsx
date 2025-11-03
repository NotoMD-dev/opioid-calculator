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
  totalHomeOME,
  prnSuggestion,
} from "../utils/conversionLogic";
import { APAP_CAUTION_MG } from "../utils/constants";

const RegimenContext = createContext<RegimenContextType | undefined>(undefined);

export const useRegimenContext = () => {
  const context = useContext(RegimenContext);
  if (context === undefined) {
    throw new Error("useRegimenContext must be used within a RegimenProvider");
  }
  return context;
};

export function RegimenProvider({ children }: { children: React.ReactNode }) {
  const [opioidNaive, setOpioidNaive] = useState(false);
  const [homeRows, setHomeRows] = useState<HomeMedRow[]>([
    { id: generateUniqueId(), isPRN: false },
  ]);
  const [continueER, setContinueER] = useState<boolean | null>(null);

  const [painRowSelections, setPainRowSelections] = useState<
    Record<Severity, PainRowSelection>
  >({ moderate: {}, severe: {}, breakthrough: {} });

  const [needSpasm, setNeedSpasm] = useState(false);
  const [needNeuropathic, setNeedNeuropathic] = useState(false);
  const [needLocalized, setNeedLocalized] = useState(false);
  const [needGeneral, setNeedGeneral] = useState(false);

  const updateHomeRow = useCallback((id: string, patch: Partial<HomeMedRow>) => {
    setHomeRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  }, []);

  const addHomeRow = useCallback(() => {
    if (opioidNaive) return;
    setHomeRows((prev) => [...prev, { id: generateUniqueId(), isPRN: false }]);
  }, [opioidNaive]);

  const removeHomeRow = useCallback((id: string) => {
    setHomeRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  useEffect(() => {
    if (opioidNaive) {
      setHomeRows([]);
    } else if (!opioidNaive && homeRows.length === 0) {
      setHomeRows([{ id: generateUniqueId(), isPRN: false }]);
    }
  }, [opioidNaive]); // eslint-disable-line react-hooks/exhaustive-deps

  const { ome, details, apapDailyMg } = useMemo(
    () => totalHomeOME(homeRows),
    [homeRows]
  );

  const prnRows: PrnRows = useMemo(() => {
    const build = (sev: Severity) => {
      const sel = painRowSelections[sev];
      if (!sel?.drug || !sel?.route || !sel?.freq)
        return { text: "" } as PrnRows[Severity];
      return prnSuggestion(ome, sel.drug, sel.route, sel.freq, sev, {
        opioidNaive,
        apapPerTabMg: sel.apapPerTabMg,
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
      apapDailyMg,
      apapNearMax: apapDailyMg >= APAP_CAUTION_MG,
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
      apapDailyMg,
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
