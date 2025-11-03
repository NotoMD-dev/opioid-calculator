// src/utils/constants.ts
import { Opioid, Route, Severity } from "../types";

/* ======================= Labels ======================= */
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
  // combo products (opioid/APAP)
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
  oxycodone_apap: "Oxy/APAP",
  hydrocodone_apap: "Hydro/APAP",
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

/* ======================= Factors ======================= */
/** NOTE:
 * - Fentanyl, methadone, buprenorphine handled specially.
 * - Combo products use the base opioid factor; APAP is tallied separately.
 */
export const MME_FACTORS: Record<Opioid, number | null> = {
  morphine: 1,
  oxycodone: 1.5,
  hydrocodone: 1,
  hydromorphone: 4,
  oxymorphone: 3,
  codeine: 0.15,
  tramadol: 0.1,
  tapentadol: 0.4,
  fentanyl_tds: null, // patch mapping, not a fixed factor
  methadone: null,    // non-linear
  buprenorphine: null,// partial agonist
  oxycodone_apap: 1.5,     // base opioid factor
  hydrocodone_apap: 1,     // base opioid factor
};

export const TARGET_FACTORS: Partial<Record<Opioid, Partial<Record<Route, number>>>> = {
  morphine: { oral: 1, iv: 3 },
  oxycodone: { oral: 1.5 },
  hydrocodone: { oral: 1 },
  hydromorphone: { oral: 4, iv: 20 },
  oxymorphone: { oral: 3 },
  codeine: { oral: 0.15 },
  tramadol: { oral: 0.1 },
  tapentadol: { oral: 0.4 },
  // others handled specially (fentanyl/methadone/buprenorphine)
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

/* ======================= Ranges & PRN ======================= */
// Used in rotateToTarget logic
export const STANDARD_LOW_FACTOR = 0.9;   // 10% below
export const STANDARD_HIGH_FACTOR = 1.1;  // 10% above
export const FRAIL_LOW_FACTOR = 0.75;     // 25% below
export const FRAIL_HIGH_FACTOR = 0.9;     // 10% below
export const FRAIL_FENTANYL_REDUCTION_FACTOR = 0.75; // reduce hi-end by 25% if frail

// Used in PRN Suggestion logic
export const PRN_FRACTIONS: Record<Severity, [number, number]> = {
  moderate: [0.1, 0.1],
  severe: [0.15, 0.15],
  breakthrough: [0.1, 0.2],
};

/* ======================= APAP helpers ======================= */
export const APAP_PER_TAB = [300, 325, 500];
export const IS_COMBO = (d: Opioid) => d === "oxycodone_apap" || d === "hydrocodone_apap";

/** Daily acetaminophen “soft” and “hard” thresholds (mg) */
export const APAP_CAUTION_MG = 3000;
export const APAP_MAX_MG = 4000;
