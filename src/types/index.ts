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
  // NEW combo products (opioid + acetaminophen)
  | "oxycodone_apap"
  | "hydrocodone_apap";

export type Route = "oral" | "iv" | "tds";
export type Severity = "moderate" | "severe" | "breakthrough";

export interface HomeMedRow {
  id: string;
  drug?: Opioid;
  route?: Route;
  doseMg?: number;              // opioid component dose (mg) or mcg/h for fentanyl_tds
  freqHours?: number;           // q?h for scheduled meds
  isPRN?: boolean;
  avgPrnDosesPerDay?: number;   // required if PRN to include in OME
  isER?: boolean;               // extended-release/long-acting flag
  apapPerTabMg?: number;        // ONLY for combo products (Percocet/Norco)
}

export interface DoseInput {
  drug: Opioid;
  route: Route;
  totalDailyDoseMg: number;     // daily opioid mg (not APAP)
  fentanylPatchMcgPerHr?: number;
}

export interface SwitchOptions {
  crossToleranceReductionPct: number;
  frailOrElderly?: boolean;
}

export interface RotateTargetResult {
  range: [number, number] | null;     // [low daily mg, high daily mg] of target drug
  notes: string[];
  fentanylPatchMcgHr?: [number, number]; // [low mcg/h, high mcg/h] for fentanyl
}

export type PainRowSelection = { drug?: Opioid; route?: Route; freq?: number };

export interface PrnSuggestionResult {
  text: string;
  low?: number;
  high?: number;
  note?: string;
}
export type PrnRows = Record<Severity, PrnSuggestionResult>;

export interface RegimenContextType {
  ome: number;
  details: string[];
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
