// src/types/index.ts

export type Opioid =
  | "morphine"
  | "oxycodone"
  | "hydrocodone"
  | "hydromorphone"
  | "oxymorphone"
  | "codeine"
  | "tramadol"
  | "tapentadol"
  | "fentanyl_tds"
  | "methadone"
  | "buprenorphine"
  // combo products we want to treat specially
  | "oxycodone_apap" // Percocet
  | "hydrocodone_apap"; // Norco, Vicodin-style

export type Route = "oral" | "iv" | "tds";
export type Severity = "moderate" | "severe" | "breakthrough";

export interface HomeMedRow {
  id: string;
  drug?: Opioid;
  route?: Route;
  doseMg?: number;
  freqHours?: number;
  isPRN?: boolean;
  avgPrnDosesPerDay?: number;
  isER?: boolean;
  // used only when drug is a combo (Percocet/Norco)
  apapPerTabMg?: number;
}

export interface DoseInput {
  drug: Opioid;
  route: Route;
  totalDailyDoseMg: number;
  fentanylPatchMcgPerHr?: number;
}

export interface SwitchOptions {
  crossToleranceReductionPct: number;
  frailOrElderly?: boolean;
}

export interface RotateTargetResult {
  range: [number, number] | null;
  notes: string[];
  fentanylPatchMcgHr?: [number, number];
}

export type PainRowSelection = {
  drug?: Opioid;
  route?: Route;
  freq?: number;
  // only used when the selected PRN drug is a combo
  apapPerTabMg?: number;
};

export interface PrnSuggestionResult {
  text: string;
  low?: number;
  high?: number;
  note?: string;
  calcLines?: string[];
}

export type PrnRows = Record<Severity, PrnSuggestionResult>;

export interface RegimenContextType {
  ome: number;
  details: string[];
  // NEW: real APAP tally from the home section
  apapDailyMg: number;
  apapNearMax: boolean;

  opioidNaive: boolean;
  setOpioidNaive: React.Dispatch<React.SetStateAction<boolean>>;
  homeRows: HomeMedRow[];
  updateHomeRow: (id: string, patch: Partial<HomeMedRow>) => void;
  addHomeRow: () => void;
  removeHomeRow: (id: string) => void;

  prnRows: PrnRows;
  painRowSelections: Record<Severity, PainRowSelection>;
  setPainRowSelections: React.Dispatch<
    React.SetStateAction<Record<Severity, PainRowSelection>>
  >;
  continueER: boolean | null;
  setContinueER: React.Dispatch<React.SetStateAction<boolean | null>>;

  needSpasm: boolean;
  setNeedSpasm: React.Dispatch<React.SetStateAction<boolean>>;
  needNeuropathic: boolean;
  setNeedNeuropathic: React.Dispatch<React.SetStateAction<boolean>>;
  needLocalized: boolean;
  setNeedLocalized: React.Dispatch<React.SetStateAction<boolean>>;
  needGeneral: boolean;
  setNeedGeneral: React.Dispatch<React.SetStateAction<boolean>>;
}
