// src/utils/constants.ts
import { Opioid, Route, Severity } from "../types";

// --- Labels ---

export const OPIOID_LABELS: Record<Opioid, string> = {
  morphine: "Morphine",
  oxycodone: "Oxycodone",
  hydrocodone: "Hydrocodone",
  hydromorphone: "Hydromorphone",
  oxymorphone: "Oxymorphone",
  codeine: "Codeine",
  tramadol: "Tramadol",
  tapentadol: "Tapentadol",
  fentanyl_tds: "Fentanyl (transdermal)",
  methadone: "Methadone",
  buprenorphine: "Buprenorphine",
  oxycodone_apap: "Oxycodone/APAP (Percocet)",
  hydrocodone_apap: "Hydrocodone/APAP (Norco)",
};

export const OPIOID_SHORT: Record<Opioid, string> = {
  morphine: "MS",
  oxycodone: "Oxy",
  hydrocodone: "Hydro",
  hydromorphone: "HM",
  oxymorphone: "OxyM",
  codeine: "Codeine",
  tramadol: "Tram",
  tapentadol: "Tap",
  fentanyl_tds: "Fentanyl",
  methadone: "Methadone",
  buprenorphine: "Bupe",
  oxycodone_apap: "Percocet",
  hydrocodone_apap: "Norco",
};

export const ROUTE_LABELS: Record<Route, string> = {
  oral: "PO",
  iv: "IV/SC",
  tds: "Transdermal",
};

export const PAIN_ROWS: { key: Severity; label: string }[] = [
  { key: "moderate", label: "Moderate" },
  { key: "severe", label: "Severe" },
  { key: "breakthrough", label: "Breakthrough" },
];

// --- Factors (MME etc) ---

export const MME_FACTORS: Record<Opioid, number | null> = {
  morphine: 1,
  oxycodone: 1.5,
  hydrocodone: 1,
  hydromorphone: 4,
  oxymorphone: 3,
  codeine: 0.15,
  tramadol: 0.1,
  tapentadol: 0.4,
  fentanyl_tds: null,
  methadone: null,
  buprenorphine: null,
  // combos use the opioid part
  oxycodone_apap: 1.5,
  hydrocodone_apap: 1,
};

export const TARGET_FACTORS: Partial<
  Record<Opioid, Partial<Record<Route, number>>>
> = {
  morphine: { oral: 1, iv: 3 },
  oxycodone: { oral: 1.5 },
  hydrocodone: { oral: 1 },
  hydromorphone: { oral: 4, iv: 20 },
  oxymorphone: { oral: 3 },
  codeine: { oral: 0.15 },
  tramadol: { oral: 0.1 },
  tapentadol: { oral: 0.4 },
  // combos behave like their base opioid
  oxycodone_apap: { oral: 1.5 },
  hydrocodone_apap: { oral: 1 },
};

export const ALLOWED_ROUTES: Record<Opioid, Route[]> = {
  morphine: ["oral", "iv"],
  oxycodone: ["oral"],
  hydrocodone: ["oral"],
  hydromorphone: ["oral", "iv"],
  oxymorphone: ["oral"],
  codeine: ["oral"],
  tramadol: ["oral"],
  tapentadol: ["oral"],
  fentanyl_tds: ["tds"],
  methadone: ["oral"],
  buprenorphine: ["oral"],
  oxycodone_apap: ["oral"],
  hydrocodone_apap: ["oral"],
};

export const FENT_PATCHES = [12, 25, 37, 50, 62, 75, 100];

// --- PRN range / rounding constants ---

export const STANDARD_LOW_FACTOR = 0.9;
export const STANDARD_HIGH_FACTOR = 1.1;

export const FRAIL_LOW_FACTOR = 0.75;
export const FRAIL_HIGH_FACTOR = 0.9;
export const FRAIL_FENTANYL_REDUCTION_FACTOR = 0.75;

export const PRN_FRACTIONS: Record<Severity, [number, number]> = {
  moderate: [0.1, 0.1],
  severe: [0.15, 0.15],
  breakthrough: [0.1, 0.2],
};

// --- APAP / combo helpers ---

export const IS_COMBO: Record<Opioid, boolean> = {
  morphine: false,
  oxycodone: false,
  hydrocodone: false,
  hydromorphone: false,
  oxymorphone: false,
  codeine: false,
  tramadol: false,
  tapentadol: false,
  fentanyl_tds: false,
  methadone: false,
  buprenorphine: false,
  oxycodone_apap: true,
  hydrocodone_apap: true,
};

// typical dropdown values you showed
export const APAP_PER_TAB_OPTIONS = [325, 300];

export const APAP_CAUTION_MG = 3000; // show "be careful" ≥ 3 g
export const APAP_MAX_MG = 4000; // hard upper limit 4 g/day

// real-world tablet strengths for PRN building
export const COMBO_TABLES: Record<
  Opioid,
  { opioidMg: number; apapMg: number; maxTabsPerDay: number }[]
> = {
  oxycodone_apap: [
    { opioidMg: 2.5, apapMg: 325, maxTabsPerDay: 12 },
    { opioidMg: 5, apapMg: 325, maxTabsPerDay: 12 },
    { opioidMg: 7.5, apapMg: 325, maxTabsPerDay: 8 },
    { opioidMg: 10, apapMg: 325, maxTabsPerDay: 6 },
  ],
  hydrocodone_apap: [
    { opioidMg: 5, apapMg: 325, maxTabsPerDay: 8 },
    { opioidMg: 7.5, apapMg: 325, maxTabsPerDay: 6 },
    { opioidMg: 10, apapMg: 300, maxTabsPerDay: 6 },
  ],
  // others: no entries
  morphine: [],
  oxycodone: [],
  hydrocodone: [],
  hydromorphone: [],
  oxymorphone: [],
  codeine: [],
  tramadol: [],
  tapentadol: [],
  fentanyl_tds: [],
  methadone: [],
  buprenorphine: [],
};
