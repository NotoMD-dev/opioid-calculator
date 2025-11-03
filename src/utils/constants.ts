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

// --- Factors ---

export const MME_FACTORS: Record<Opioid, number | null> = {
  morphine: 1,
  oxycodone: 1.5,
  hydrocodone: 1,
  hydromorphone: 4,
  oxymorphone: 3,
  codeine: 0.15,
  tramadol: 0.1,
  tapentadol: 0.4,
  fentanyl_tds: null, // Calculated using a range, not a fixed factor
  methadone: null, // Complex, requires specialty guidance
  buprenorphine: null, // Not typically used for OME conversion
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
  // Fentanyl, Methadone, Buprenorphine conversions are handled separately
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
};

export const FENT_PATCHES = [12, 25, 37, 50, 62, 75, 100];

// --- Calculation Constants for Dosing Range (New/Improved) ---
// Used in rotateToTarget logic

export const STANDARD_LOW_FACTOR = 0.9;  // Standard low end: 10% below target
export const STANDARD_HIGH_FACTOR = 1.1; // Standard high end: 10% above target

export const FRAIL_LOW_FACTOR = 0.75;    // Frail low end: 25% below target
export const FRAIL_HIGH_FACTOR = 0.9;    // Frail high end: 10% below target
export const FRAIL_FENTANYL_REDUCTION_FACTOR = 0.75; // Reduces Fentanyl high end by 25% for frail

// Used in PRN Suggestion logic
export const PRN_FRACTIONS: Record<Severity, [number, number]> = {
  moderate: [0.1, 0.1],
  severe: [0.15, 0.15],
  breakthrough: [0.1, 0.2],
};