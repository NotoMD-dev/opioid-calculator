// opioid-calc-final.tsx

"use client";
import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
} from "react";

/* ======================= Types & Constants ======================= */
type Opioid =
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
  | "buprenorphine";

type Route = "oral" | "iv" | "tds";
type Severity = "moderate" | "severe" | "breakthrough";

interface HomeMedRow {
  id: string;
  drug?: Opioid;
  route?: Route;
  doseMg?: number;
  freqHours?: number;
  isPRN?: boolean;
  avgPrnDosesPerDay?: number;
  isER?: boolean;
}

interface DoseInput {
  drug: Opioid;
  route: Route;
  totalDailyDoseMg: number;
  fentanylPatchMcgPerHr?: number;
}

interface SwitchOptions {
  crossToleranceReductionPct: number;
  frailOrElderly?: boolean;
}

// *** MISSING TYPE ADDED TO FIX TS(2304) ERROR ***
interface RotateTargetResult {
  range: [number, number] | null; // [low daily mg, high daily mg] of target drug
  notes: string[];
  fentanylPatchMcgHr?: [number, number]; // [low mcg/h, high mcg/h] for fentanyl
}

const OPIOID_LABELS: Record<Opioid, string> = {
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

const OPIOID_SHORT: Record<Opioid, string> = {
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

const ROUTE_LABELS: Record<Route, string> = {
  oral: "PO",
  iv: "IV/SC",
  tds: "Transdermal",
};

const PAIN_ROWS: { key: Severity; label: string }[] = [
  { key: "moderate", label: "Moderate" },
  { key: "severe", label: "Severe" },
  { key: "breakthrough", label: "Breakthrough" },
];

const MME_FACTORS: Record<Opioid, number | null> = {
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
};

const TARGET_FACTORS: Partial<Record<Opioid, Partial<Record<Route, number>>>> = {
  morphine: { oral: 1, iv: 3 },
  oxycodone: { oral: 1.5 },
  hydrocodone: { oral: 1 },
  hydromorphone: { oral: 4, iv: 20 },
  oxymorphone: { oral: 3 },
  codeine: { oral: 0.15 },
  tramadol: { oral: 0.1 },
  tapentadol: { oral: 0.4 },
};

const ALLOWED_ROUTES: Record<Opioid, Route[]> = {
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

const FENT_PATCHES = [12, 25, 37, 50, 62, 75, 100];

/* ======================= Helpers ======================= */

function generateUniqueId() {
  return typeof crypto !== "undefined" && (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : String(Date.now() + Math.random());
}

function getTargetFactor(drug: Opioid, route: Route): number | null {
  if (
    drug === "fentanyl_tds" ||
    drug === "methadone" ||
    drug === "buprenorphine"
  )
    return null;
  const byRoute = TARGET_FACTORS[drug];
  if (!byRoute) return null;
  return (
    (byRoute as Record<string, number>)[route] ??
    (byRoute as Record<string, number>).oral ??
    null
  );
}

function mmeOf(input: DoseInput): number | null {
  if (input.drug === "buprenorphine") return null;
  if (input.drug === "fentanyl_tds") {
    const mid = 75; // 60–90 OME per 25 mcg/h midpoint
    const mcg = input.fentanylPatchMcgPerHr || 0;
    if (!mcg) return null;
    return (mcg / 25) * mid;
  }
  if (input.drug === "methadone") return null;
  const factor = MME_FACTORS[input.drug];
  if (!factor) return null;
  return input.totalDailyDoseMg * factor;
}

function roundPerDose(drug: Opioid, route: Route, mg: number): number {
  const clean = (x: number) => Number(x.toFixed(2));
  if (drug === "hydromorphone" && route === "iv")
    return clean(Math.max(0.2, Math.ceil(mg / 0.2) * 0.2));
  if (drug === "hydromorphone" && route === "oral")
    return clean(Math.max(2, Math.ceil(mg / 2) * 2));
  if (drug === "oxycodone" && route === "oral")
    return clean(Math.max(5, Math.ceil(mg / 5) * 5));
  if (drug === "morphine" && route === "iv")
    return clean(Math.max(1, Math.ceil(mg / 1) * 1));
  return clean(Math.round(mg * 10) / 10);
}

function roundToTenth(mg: number) {
  if (!Number.isFinite(mg)) return 0;
  return Number(mg.toFixed(1));
}

function fmtDose(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = Number(n.toFixed(2));
  return Math.abs(rounded - Math.round(rounded)) < 1e-9
    ? String(Math.round(rounded))
    : String(rounded);
}

function roundToPatch(mcgPerHr: number): number {
  let best = FENT_PATCHES[0];
  let bestDiff = Math.abs(mcgPerHr - best);
  for (const p of FENT_PATCHES) {
    const d = Math.abs(mcgPerHr - p);
    if (d < bestDiff) {
      best = p;
      bestDiff = d;
    }
  }
  return best;
}

/* ======================= New Compact “Dosing Equivalents” Table ======================= */
function MMEEquivCompactTable() {
  const rows = [
    { agent: "Morphine",       po: "30 mg",  iv: "10 mg" },
    { agent: "Hydromorphone",  po: "7.5 mg", iv: "1.5 mg" },
    { agent: "Oxymorphone",    po: "10 mg",  iv: "1 mg" },
    { agent: "Meperidine",     po: "300 mg", iv: "75 mg" },
    { agent: "Fentanyl",       po: "—",      iv: "0.1 mg" },
    { agent: "Oxycodone",      po: "20 mg",  iv: "—" },
    { agent: "Hydrocodone",    po: "30 mg",  iv: "—" },
    { agent: "Codeine",        po: "120 mg", iv: "—" },
  ];

  return (
    <div className="overflow-x-auto w-full">
      <table className="min-w-[520px] w-full border border-gray-200 rounded-xl overflow-hidden">
        <thead className="bg-gray-50 text-xs font-semibold text-gray-600">
          <tr>
            <th className="text-left px-3 py-2 w-1/2">Agent</th>
            <th className="text-left px-3 py-2 w-1/4">PO dose</th>
            <th className="text-left px-3 py-2 w-1/4">IV dose</th>
          </tr>
        </thead>
        <tbody className="text-sm text-gray-800">
          {rows.map((r) => (
            <tr key={r.agent} className="border-t border-gray-100">
              <td className="px-3 py-2">{r.agent}</td>
              <td className="px-3 py-2">{r.po}</td>
              <td className="px-3 py-2">{r.iv}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


/* ======================= Utility UI ======================= */

function Switch({
  checked,
  onChange,
  title,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title?: string;
}) {
  return (
    <div
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onKeyDown={(e) =>
        (e.key === "Enter" || e.key === " ") && onChange(!checked)
      }
      className={`relative w-14 h-8 rounded-full border border-gray-200 cursor-pointer transition-colors duration-200 ease-in-out ${checked ? "bg-indigo-600" : "bg-gray-300"
        }`}
      title={title || (checked ? "On" : "Off")}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-7 h-7 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${checked ? "translate-x-6" : "translate-x-0"
          }`}
      />
    </div>
  );
}

function LabeledToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 border border-gray-200 rounded-xl bg-white shadow-sm">
      <div className="font-bold text-base text-gray-900">{label}</div>
      <Switch checked={checked} onChange={onChange} />
    </div>
  );
}

/* ======================= Context ======================= */

type PainRowSelection = { drug?: Opioid; route?: Route; freq?: number };
type ConversionResult = {
  adjPerDose: [number, number] | null;
  trace: string[];
  fentanylPatchMcgHr?: [number, number];
};
type PrnSuggestionResult = {
  text: string;
  low?: number;
  high?: number;
  note?: string;
};
type PrnRows = Record<Severity, PrnSuggestionResult>;

interface RegimenContextType {
  ome: number;
  details: string[];
  opioidNaive: boolean;
  setOpioidNaive: React.Dispatch<React.SetStateAction<boolean>>;
  homeRows: HomeMedRow[];
  updateHomeRow: (id: string, patch: Partial<HomeMedRow>) => void;
  addHomeRow: () => void;
  removeHomeRow: (id: string) => void;

  conversion: ConversionResult;
  targetDrug: Opioid;
  setTargetDrug: React.Dispatch<React.SetStateAction<Opioid>>;
  targetRoute: Route;
  setTargetRoute: React.Dispatch<React.SetStateAction<Route>>;
  schedFreqHours: number;
  setSchedFreqHours: React.Dispatch<React.SetStateAction<number>>;
  intensityPct: number;
  setIntensityPct: React.Dispatch<React.SetStateAction<number>>;
  reduction: number;
  setReduction: React.Dispatch<React.SetStateAction<number>>;
  frail: boolean;
  setFrail: React.Dispatch<React.SetStateAction<boolean>>;

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

const RegimenContext = createContext<RegimenContextType | undefined>(undefined);

const useRegimenContext = () => {
  const context = useContext(RegimenContext);
  if (context === undefined) {
    throw new Error("useRegimenContext must be used within a RegimenProvider");
  }
  return context;
};

// *** MISSING FUNCTION ADDED TO FIX TS(2304) ERROR for 'rotateToTarget' ***
function rotateToTarget(
  ome: number,
  targetDrug: Opioid,
  targetRoute: Route,
  options: SwitchOptions
): RotateTargetResult {
  const { crossToleranceReductionPct, frailOrElderly } = options;
  const notes: string[] = [];

  // 1. Cross-tolerance reduction
  const adjustedOME = ome * (1 - crossToleranceReductionPct / 100);
  notes.push(
    `3) Cross-tolerance reduction: ${ome.toFixed(1)} OME × (1 - ${crossToleranceReductionPct}%) = ${adjustedOME.toFixed(1)} OME/day`
  );
  
  // 2. Special agents (Methadone/Bupe)
  if (targetDrug === "methadone" || targetDrug === "buprenorphine") {
    notes.push(
      `Special agent: ${OPIOID_LABELS[targetDrug]} conversion is complex and requires specialist guidance (e.g., pain/palliative consult).`
    );
    return { range: null, notes };
  }

  // 3. Fentanyl Transdermal
  if (targetDrug === "fentanyl_tds") {
    // Fentanyl conversion: 25 mcg/h = 60–90 mg OME/day
    const standardLow = (adjustedOME / 90) * 25; 
    let standardHigh = (adjustedOME / 60) * 25; 
    
    if (frailOrElderly) {
        standardHigh = standardHigh * 0.75; // 25% extra reduction on the high end for frail/elderly
        notes.push("Frail/Elderly: High end of patch range reduced by 25%.");
    }

    const roundLo = roundToPatch(standardLow);
    const roundHi = roundToPatch(standardHigh);

    notes.push(
        `4) Fentanyl conversion: ~${roundLo}–${roundHi} mcg/h patch. (Based on 60–90 OME/25 mcg/h, then rounded to standard patches: ${FENT_PATCHES.join(", ")}).`
    );

    return {
      range: null,
      notes,
      fentanylPatchMcgHr: [roundLo, roundHi],
    };
  }

  // 4. Standard conversion (oral/IV)
  const factor = getTargetFactor(targetDrug, targetRoute);
  if (!factor) {
    notes.push(
      `Error: Missing conversion factor for ${OPIOID_LABELS[targetDrug]} ${ROUTE_LABELS[targetRoute]}.`
    );
    return { range: null, notes };
  }

  const targetDailyMg = adjustedOME / factor;
  notes.push(
    `4) Target conversion factor is ${factor}. Calculated daily dose: ${adjustedOME.toFixed(
      1
    )} OME / ${factor} = ${targetDailyMg.toFixed(1)} mg/day`
  );

  let lowFactor = 0.9; // Default 10% below target
  let highFactor = 1.1; // Default 10% above target
  
  if (frailOrElderly) {
      lowFactor = 0.75; // 25% lower for frail
      highFactor = 0.9;  // Max 10% lower for frail
      notes.push("Frail/Elderly: Range uses a more conservative 75% to 90% of calculated dose.");
  }
  
  const low = targetDailyMg * lowFactor;
  const high = targetDailyMg * highFactor;

  const finalLow = Math.max(0, roundToTenth(low));
  const finalHigh = Math.max(0, roundToTenth(high));

  notes.push(`5) Suggested daily dose range: ${finalLow.toFixed(1)}–${finalHigh.toFixed(1)} mg/day.`);

  return { range: [finalLow, finalHigh], notes };
}

// *** MISSING FUNCTION ADDED TO FIX TS(2304) ERROR for 'totalHomeOME' ***
function totalHomeOME(rows: HomeMedRow[]): { ome: number; details: string[] } {
  let total = 0;
  const details: string[] = [];

  for (const r of rows) {
    if (!r.drug || !r.route || !r.doseMg) continue;

    let totalDailyDoseMg = 0;
    let dosesPerDay = 0;
    let doseType = "";

    if (r.drug === "fentanyl_tds" && r.doseMg) {
      // Fentanyl Patch (doseMg is mcg/hr)
      totalDailyDoseMg = r.doseMg;
      doseType = "patch (mcg/h)";
    } else if (r.isPRN && r.avgPrnDosesPerDay && r.doseMg) {
      // PRN
      dosesPerDay = r.avgPrnDosesPerDay;
      totalDailyDoseMg = r.doseMg * dosesPerDay;
      doseType = `PRN (avg ${fmtDose(dosesPerDay)}/day)`;
    } else if (!r.isPRN && r.doseMg && r.freqHours) {
      // Scheduled
      dosesPerDay = 24 / r.freqHours;
      totalDailyDoseMg = r.doseMg * dosesPerDay;
      doseType = `Scheduled q${r.freqHours}h`;
      if (r.isER) doseType += " ER/LA";
    } else if (!r.isPRN && r.doseMg) {
        // Scheduled, but freq missing (assume dose is daily)
        totalDailyDoseMg = r.doseMg;
        doseType = r.isER ? "Scheduled ER/LA (Daily dose assumed)" : "Scheduled (Daily dose assumed)";
    }
    
    if (totalDailyDoseMg > 0 || r.drug === "fentanyl_tds") {
      const doseInput: DoseInput = {
        drug: r.drug,
        route: r.route,
        totalDailyDoseMg: totalDailyDoseMg,
        fentanylPatchMcgPerHr: r.drug === "fentanyl_tds" ? r.doseMg : undefined,
      };

      const dailyOME = mmeOf(doseInput);

      if (dailyOME !== null) {
        total += dailyOME;
        details.push(
          `${OPIOID_SHORT[r.drug]} ${fmtDose(r.doseMg)} ${ROUTE_LABELS[r.route]} ${doseType}: ~${Math.round(dailyOME)} OME/day`
        );
      } else {
        details.push(
          `! ${OPIOID_SHORT[r.drug]} ${ROUTE_LABELS[r.route]} ${doseType}: OME N/A (methadone/bupe or missing factor)`
        );
      }
    }
  }

  return { ome: total, details };
}

/* ======================= QuickConvert ======================= */

function QuickConvert() {
  const [fromDrug, setFromDrug] = useState<Opioid>("morphine");
  const [fromRoute, setFromRoute] = useState<Route>("oral");
  const [perDose, setPerDose] = useState<number>(5);
  const [fromFreq, setFromFreq] = useState<number>(6);

  const [toDrug, setToDrug] = useState<Opioid>("hydromorphone");
  const [toRoute, setToRoute] = useState<Route>("oral");
  const [toFreq, setToFreq] = useState<number>(4);

  const [ct, setCt] = useState<number>(25);
  const [frail, setFrail] = useState<boolean>(false);
  const [includeFreq, setIncludeFreq] = useState<boolean>(true);
  const [copyNote, setCopyNote] = useState("");

  useEffect(() => {
    const allowed = ALLOWED_ROUTES[toDrug] || [];
    if (!allowed.includes(toRoute)) setToRoute(allowed[0]);
    const allowedFrom = ALLOWED_ROUTES[fromDrug] || [];
    if (!allowedFrom.includes(fromRoute)) setFromRoute(allowedFrom[0]);
  }, [toDrug, toRoute, fromDrug, fromRoute]);

  const result = useMemo(() => {
    if (["fentanyl_tds", "methadone", "buprenorphine"].includes(fromDrug)) {
      return {
        text: "From-drug not supported in quick converter.",
        steps: [] as string[],
      };
    }
    const mf = MME_FACTORS[fromDrug];
    if (!mf) return { text: "Missing factor for from-drug.", steps: [] as string[] };

    const steps: string[] = [];
    const dosesPerDay = includeFreq
      ? Math.max(1, Math.round(24 / Math.max(1, fromFreq)))
      : 1;
    const dailyMg = perDose * dosesPerDay;
    const fromOME = dailyMg * mf;
    steps.push(
      `1) Base OME: ${perDose} mg × ${dosesPerDay}/day × ${mf} = ${fromOME.toFixed(
        1
      )}`
    );

    const adjusted = rotateToTarget(fromOME, toDrug, toRoute, {
      crossToleranceReductionPct: ct,
      frailOrElderly: frail,
    });

    const isFentanylResult = (
      res: RotateTargetResult
    ): res is RotateTargetResult & { fentanylPatchMcgHr: [number, number] } =>
      res.fentanylPatchMcgHr !== undefined;

    if (toDrug === "fentanyl_tds" && isFentanylResult(adjusted)) {
      const [lo, hi] = adjusted.fentanylPatchMcgHr;
      steps.push(
        "2) Cross-tolerance reduction; OME → patch using 60–90 mg OME ≈ 25 mcg/h."
      );
      return { text: `Fentanyl patch ~${lo}–${hi} mcg/h`, steps };
    }
    if (!adjusted.range)
      return { text: adjusted.notes.join(" ") || "Conversion not available.", steps };

    const [lo, hi] = adjusted.range;
    steps.push(
      `2) After reduction: ${lo.toFixed(2)}–${hi.toFixed(
        2
      )} mg/day (target drug basis)`
    );

    let out: string;
    if (!includeFreq) {
      const perDoseLo = roundToTenth(lo);
      const perDoseHi = roundToTenth(hi);
      steps.push("3) No frequency → per-dose equivalents (exact, 0.1 mg).");
      out = `${OPIOID_LABELS[toDrug]} ${fmtDose(perDoseLo)}${perDoseHi !== perDoseLo ? `–${fmtDose(perDoseHi)}` : ""} ${ROUTE_LABELS[toRoute]}`;
    } else {
      const targetDpd = Math.max(1, Math.round(24 / Math.max(1, toFreq)));
      const perDoseLo = roundToTenth(lo / targetDpd);
      const perDoseHi = roundToTenth(hi / targetDpd);
      steps.push(`3) Divide by doses/day (${targetDpd}) with exact 0.1 mg precision.`);
      out = `${OPIOID_LABELS[toDrug]} ${fmtDose(perDoseLo)}${perDoseHi !== perDoseLo ? `–${fmtDose(perDoseHi)}` : ""} ${ROUTE_LABELS[toRoute]} q${toFreq}h`;
    }
    return { text: out, steps };
  }, [
    fromDrug,
    fromRoute,
    perDose,
    fromFreq,
    toDrug,
    toRoute,
    toFreq,
    ct,
    frail,
    includeFreq,
  ]);

  async function handleCopy() {
    const ok = await copyToClipboard(result.text);
    setCopyNote(ok ? "Copied ✓" : "Copy failed — select text below.");
    setTimeout(() => setCopyNote(""), 2500);
  }

  const inputClass =
    "w-full h-10 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-800 text-sm disabled:bg-gray-100 disabled:text-gray-500";
  const labelClass = "block text-xs font-medium text-gray-500 mb-1";
  const checkboxClass = "form-checkbox h-4 w-4 text-indigo-600 rounded";

  return (
    <div className="pt-4 mt-4 border-top border-gray-100">
      <p className="text-sm text-gray-600 mb-4">
        Convert a specific dose of one opioid to another.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div>
          <label className={labelClass}>From drug</label>
          <select
            className={inputClass}
            value={fromDrug}
            onChange={(e) => setFromDrug(e.target.value as Opioid)}
          >
            {Object.keys(OPIOID_LABELS)
              .filter(
                (k) =>
                  k !== "fentanyl_tds" && k !== "methadone" && k !== "buprenorphine"
              )
              .map((k: string) => (
                <option key={k} value={k}>
                  {OPIOID_LABELS[k as Opioid]}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>From route</label>
          <select
            className={inputClass}
            value={fromRoute}
            onChange={(e) => setFromRoute(e.target.value as Route)}
          >
            {(ALLOWED_ROUTES[fromDrug] || []).map((rt: Route) => (
              <option key={rt} value={rt}>
                {ROUTE_LABELS[rt]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Per-dose (mg)</label>
          <input
            type="number"
            className={inputClass}
            value={perDose}
            onChange={(e) =>
              setPerDose(Math.max(0, Number(e.target.value) || 0))
            }
          />
        </div>
        <div>
          <label className={labelClass}>From freq (h)</label>
          <select
            className={inputClass}
            value={fromFreq}
            onChange={(e) => setFromFreq(Number(e.target.value))}
            disabled={!includeFreq}
          >
            {[2, 3, 4, 6, 8, 12].map((h) => (
              <option key={h} value={h}>{`q${h}h`}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>To drug</label>
          <select
            className={inputClass}
            value={toDrug}
            onChange={(e) => setToDrug(e.target.value as Opioid)}
          >
            {Object.keys(OPIOID_LABELS)
              .filter((k) => k !== "methadone")
              .map((k: string) => (
                <option key={k} value={k}>
                  {OPIOID_LABELS[k as Opioid]}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>To route</label>
          <select
            className={inputClass}
            value={toRoute}
            onChange={(e) => setToRoute(e.target.value as Route)}
          >
            {(ALLOWED_ROUTES[toDrug] || []).map((rt: Route) => (
              <option key={rt} value={rt}>
                {ROUTE_LABELS[rt]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>To freq (h)</label>
          <select
            className={inputClass}
            value={toFreq}
            onChange={(e) => setToFreq(Number(e.target.value))}
            disabled={!includeFreq}
          >
            {[2, 3, 4, 6, 8, 12].map((h) => (
              <option key={h} value={h}>{`q${h}h`}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Cross-tolerance %↓</label>
          <input
            type="number"
            className={inputClass}
            value={ct}
            onChange={(e) =>
              setCt(Math.max(0, Math.min(95, Number(e.target.value) || 0)))
            }
          />
        </div>
        <div className="flex items-center gap-2 mt-auto h-10">
          <input
            type="checkbox"
            id="qc-frailToggle"
            className={checkboxClass}
            checked={frail}
            onChange={(e) => setFrail(e.target.checked)}
          />
          <label htmlFor="qc-frailToggle" className="text-sm text-gray-600">
            Frail/elderly?
          </label>
        </div>
        <div className="flex items-center gap-2 mt-auto h-10">
          <input
            type="checkbox"
            id="qc-includeFreqToggle"
            className={checkboxClass}
            checked={includeFreq}
            onChange={(e) => setIncludeFreq(e.target.checked)}
          />
          <label htmlFor="qc-includeFreqToggle" className="text-sm text-gray-600">
            Include freq?
          </label>
        </div>
        
        <div className="col-span-full pt-4">
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
            <div className="text-sm font-semibold text-indigo-700">
              Quick Convert Result
            </div>
            <div className="text-lg font-bold text-indigo-900 mt-1">
              {result.text}
            </div>
            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
              >
                Copy result
              </button>
              {copyNote && (
                <span className="text-xs text-gray-500 flex items-center">
                  {copyNote}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      {result.steps.length > 0 && (
        <details className="text-sm mt-4">
          <summary className="font-medium text-gray-700 cursor-pointer hover:text-indigo-600 transition-colors">
            Show calculation steps
          </summary>
          <ol className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs whitespace-pre-wrap font-mono text-gray-800 list-decimal list-inside space-y-1">
            {result.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

/* ======================= HomeRegimenInput (FIXED GRID) ======================= */

function HomeRegimenInput() {
  const {
    opioidNaive,
    setOpioidNaive,
    homeRows: rows,
    addHomeRow,
    updateHomeRow,
    removeHomeRow,
    ome,
    details,
  } = useRegimenContext();

  const isFentanyl = (drug?: Opioid) => drug === "fentanyl_tds";
  const inputClass =
    "w-full h-10 px-2 py-2 border border-gray-300 rounded-lg bg-white text-gray-800 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow disabled:bg-gray-100 disabled:text-gray-500";
  const checkClass =
    "form-checkbox h-5 w-5 rounded transition-colors text-indigo-600 focus:ring-indigo-500";

  // 8-column grid
  const rowGridStyle = {
    gridTemplateColumns:
      "1.5fr 1fr 1.2fr 1.2fr 0.5fr 1.3fr 0.7fr 0.2fr",
  } as const;

  const cardStyle = "bg-white p-6 rounded-2xl shadow-lg border border-gray-100";
  const headerStyle = "text-xl font-bold text-gray-900";
  const buttonStyle = "px-4 py-2 text-sm font-semibold rounded-lg transition-colors shadow-md";
  const removeButtonStyle =
    "p-1 border border-transparent text-red-500 rounded-md hover:bg-red-50 hover:border-red-300 transition-colors h-8 w-8 text-lg flex items-center justify-center";

  return (
    <section className={cardStyle}>
      <div className="flex justify-between items-center gap-3 mb-4">
        <h3 className={headerStyle}>Home Opioid Regimen</h3>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-base font-semibold text-gray-800 cursor-pointer">
            <input
              type="checkbox"
              className="form-checkbox h-5 w-5 text-indigo-600 rounded focus:ring-indigo-500"
              checked={opioidNaive}
              onChange={(e) => setOpioidNaive(e.target.checked)}
            />
            Opioid-naïve
          </label>
          <button
            type="button"
            className={`${buttonStyle} ${opioidNaive
                ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700 text-white"
              }`}
            onClick={addHomeRow}
            disabled={opioidNaive}
          >
            + Add item
          </button>
        </div>
      </div>

      {rows.length === 0 && opioidNaive ? (
        <div className="p-4 text-center text-gray-500 bg-gray-50 rounded-lg text-sm">
          Input disabled because the patient is marked as opioid naïve.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            {/* LABELS */}
            <div
              className="grid gap-3 text-xs font-semibold text-gray-600 uppercase mb-2 px-1"
              style={rowGridStyle}
            >
              <div>Drug</div>
              <div>Route</div>
              <div>Dose (mg)</div>
              <div>Freq (hours)</div>
              <div>PRN?</div>
              <div className="text-gray-400">Avg PRN/Day</div>
              <div>ER / LA?</div>
              <div />
            </div>

            {/* ROWS */}
            {rows.map((r: HomeMedRow) => {
              const needsAvg =
                !!r.isPRN && !Number.isFinite(r.avgPrnDosesPerDay as number);
              return (
                <div
                  key={r.id}
                  className="grid gap-3 items-start p-2 mb-2 border-b border-gray-100 last:border-b-0"
                  style={rowGridStyle}
                >
                  {/* 1: Drug */}
                  <select
                    className={inputClass}
                    disabled={opioidNaive}
                    value={r.drug ?? ""}
                    onChange={(e) =>
                      updateHomeRow(r.id, {
                        drug: (e.target.value || undefined) as Opioid | undefined,
                        route: undefined,
                      })
                    }
                  >
                    <option value="" disabled>
                      — select —
                    </option>
                    {Object.keys(OPIOID_LABELS).map((k: string) => (
                      <option key={k} value={k}>
                        {OPIOID_LABELS[k as Opioid]}
                      </option>
                    ))}
                  </select>

                  {/* 2: Route */}
                  <select
                    className={inputClass}
                    disabled={opioidNaive || !r.drug}
                    value={r.route ?? ""}
                    onChange={(e) => {
                      const next = (e.target.value || undefined) as
                        | Route
                        | undefined;
                      updateHomeRow(r.id, { route: next });
                    }}
                  >
                    <option value="" disabled>
                      — select —
                    </option>
                    {(r.drug ? ALLOWED_ROUTES[r.drug] : []).map(
                      (rt: Route) => (
                        <option key={rt} value={rt}>
                          {ROUTE_LABELS[rt]}
                        </option>
                      )
                    )}
                  </select>

                  {/* 3: Dose */}
                  <input
                    disabled={opioidNaive || !r.drug}
                    type="number"
                    placeholder={isFentanyl(r.drug) ? "mcg/h" : "mg"}
                    className={inputClass}
                    value={r.doseMg ?? ""}
                    onChange={(e) =>
                      updateHomeRow(r.id, {
                        doseMg: Number(e.target.value) || undefined,
                      })
                    }
                  />

                  {/* 4: Freq */}
                  <input
                    disabled={opioidNaive || !r.drug || isFentanyl(r.drug)}
                    type="number"
                    placeholder={isFentanyl(r.drug) ? "N/A" : ""}
                    className={inputClass}
                    value={r.freqHours ?? ""}
                    onChange={(e) =>
                      updateHomeRow(r.id, {
                        freqHours: Number(e.target.value) || undefined,
                      })
                    }
                  />

                  {/* 5: PRN? */}
                  <div className="flex items-center justify-start h-10 pt-1">
                    <input
                      disabled={opioidNaive || !r.drug || !!r.isER}
                      type="checkbox"
                      className={`${checkClass} ${r.isER ? "text-gray-400" : "text-indigo-600"
                        }`}
                      checked={!!r.isPRN}
                      onChange={(e) =>
                        updateHomeRow(r.id, {
                          isPRN: e.target.checked,
                          isER: e.target.checked ? false : r.isER,
                        })
                      }
                    />
                  </div>

                  {/* 6: Avg PRN/day */}
                  <div
                    className={`transition-all duration-100 ${r.isPRN ? "visible opacity-100" : "invisible opacity-0"
                      }`}
                  >
                    <input
                      disabled={opioidNaive || !r.drug || !r.isPRN}
                      type="number"
                      placeholder={needsAvg ? "Req." : "e.g., 4"}
                      className={`${inputClass} h-10 ${needsAvg ? "border-red-500 bg-red-50" : ""
                        }`}
                      value={r.avgPrnDosesPerDay ?? ""}
                      onChange={(e) =>
                        updateHomeRow(r.id, {
                          avgPrnDosesPerDay:
                            Number(e.target.value) || undefined,
                        })
                      }
                    />
                    {needsAvg && (
                      <p className="text-red-500 text-[10px] mt-1 font-semibold">
                        Needed for OME calc.
                      </p>
                    )}
                  </div>

                  {/* 7: ER/LA? */}
                  <div className="flex items-center justify-start h-10 pt-1">
                    <input
                      disabled={opioidNaive || !r.drug || !!r.isPRN}
                      type="checkbox"
                      className={`${checkClass} ${r.isPRN ? "text-gray-400" : "text-indigo-600"
                        }`}
                      checked={!!r.isER}
                      onChange={(e) =>
                        updateHomeRow(r.id, {
                          isER: e.target.checked,
                          isPRN: e.target.checked ? false : r.isPRN,
                        })
                      }
                    />
                  </div>

                  {/* 8: Remove */}
                  <div className="flex items-center justify-start h-10 pt-1">
                    {rows.length > 1 && (
                      <button
                        title="Remove"
                        type="button"
                        onClick={() => removeHomeRow(r.id)}
                        className={removeButtonStyle}
                      >
                        &times;
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* OME Summary Bar — LEFT: breakdown+equivalents, RIGHT: total OME */}
      {!opioidNaive && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* LEFT */}
            <div className="space-y-3">
              <details className="text-sm">
                <summary className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 cursor-pointer">
                  OME breakdown
                </summary>
                <ul className="mt-2 pl-5 list-disc space-y-1 text-gray-700">
                  {details.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </details>

              <details className="text-sm">
                <summary className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 cursor-pointer">
                  Dosing equivalents (reference)
                </summary>
                <div className="mt-2">
                  <MMEEquivCompactTable />
                </div>
              </details>
            </div>

            {/* RIGHT */}
            <div className="flex lg:justify-end">
              <div className="text-xl lg:text-2xl font-extrabold text-gray-900">
                Total estimated HOME OME:
                <span className="text-indigo-700 ml-2">~{Math.round(ome)} mg/day</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ======================= PRN Suggestions + Multimodal (merged) ======================= */

function prnSuggestion(
  ome: number,
  drug: Opioid,
  route: Route,
  freqHours: number,
  severity: Severity,
  opts?: { opioidNaive?: boolean }
): PrnSuggestionResult {
  const STARTING: Record<string, [number, number]> = {
    "oxycodone|oral|moderate": [5, 10],
    "oxycodone|oral|severe": [10, 15],
    "hydromorphone|iv|moderate": [0.2, 0.4],
    "hydromorphone|iv|severe": [0.4, 0.8],
    "hydromorphone|oral|moderate": [2, 4],
    "hydromorphone|oral|severe": [4, 6],
    "morphine|oral|moderate": [5, 10],
    "morphine|oral|severe": [10, 15],
    "morphine|iv|moderate": [1, 2],
    "morphine|iv|severe": [2, 4],
  };

  if (opts?.opioidNaive) {
    const key = `${drug}|${route}|${severity === "breakthrough" ? "severe" : severity
      }`;
    const base = STARTING[key];
    if (!base) return { text: "Select common drug/route for naïve defaults" };
    const [lo, hi] = base;
    const drugShort = OPIOID_SHORT[drug];
    return {
      text: `${drugShort} ${fmtDose(lo)}${hi !== lo ? "–" + fmtDose(hi) : ""
        } ${ROUTE_LABELS[
          route
        ].toLowerCase()} q${Math.max(2, Math.min(12, Math.round(freqHours)))}h PRN`,
      low: lo,
      high: hi,
    };
  }

  if (ome <= 0) return { text: "Enter home regimen to calculate suggestions." };
  if (
    drug === "fentanyl_tds" ||
    drug === "methadone" ||
    drug === "buprenorphine"
  ) {
    return { text: `${OPIOID_LABELS[drug]} not suggested as PRN in this tool` };
  }

  const factor = getTargetFactor(drug, route) ?? 1;
  const targetDailyMg = ome / factor;

  const FRACTIONS: Record<Severity, [number, number]> = {
    moderate: [0.1, 0.1],
    severe: [0.15, 0.15],
    breakthrough: [0.1, 0.2],
  };

  const [loF, hiF] = FRACTIONS[severity];
  const perDoseLow = roundPerDose(drug, route, targetDailyMg * loF);
  const perDoseHigh = roundPerDose(drug, route, targetDailyMg * hiF);

  const drugShort = OPIOID_SHORT[drug];

  return {
    text: `${drugShort} ${fmtDose(perDoseLow)}${perDoseHigh !== perDoseLow ? "–" + fmtDose(perDoseHigh) : ""
      } ${ROUTE_LABELS[
        route
      ].toLowerCase()} q${Math.max(2, Math.min(12, Math.round(freqHours)))}h PRN`,
    low: perDoseLow,
    high: perDoseHigh,
    note: `${Math.round(loF * 100)}${hiF !== loF ? "–" + Math.round(hiF * 100) : ""
      }% of target daily dose`,
  };
}

function copyToClipboard(text: string) {
  try {
    if (navigator.clipboard && (window as any).isSecureContext !== false) {
      navigator.clipboard.writeText(text);
      alert("Copied to clipboard ✓");
      return true;
    }
  } catch { }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    alert("Copied to clipboard (fallback) ✓");
    return true;
  } catch {
    alert("Copy failed — text shown below.");
    return false;
  }
}

function PRNSuggestionTable({
  showPrnArea, setShowPrnArea,
}: { showPrnArea: boolean; setShowPrnArea: React.Dispatch<React.SetStateAction<boolean>>; }) {
  const {
    opioidNaive,
    homeRows: rows,
    prnRows,
    painRowSelections,
    setPainRowSelections,
    continueER,
    setContinueER,
    needGeneral, setNeedGeneral,
    needNeuropathic, setNeedNeuropathic,
    needSpasm, setNeedSpasm,
    needLocalized, setNeedLocalized,
  } = useRegimenContext();

  const hasERRows = useMemo(() => rows.some((r) => r.isER && !r.isPRN), [rows]);
  const short = (k: Severity) => (k === "moderate" ? "Mod" : k === "severe" ? "Sev" : "BTP");

  return (
    <section className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
      <h3 className="text-xl font-bold text-gray-900">Inpatient Regimen</h3>
      <p className="text-sm text-gray-600 mt-1">
        Doses are calculated as percent of total daily OME.
      </p>
      <p className="text-sm text-gray-600">
        <span className="font-semibold">Mod = 10% Sev = 15% BTP = 10–20%</span> (Ranges are rounded to practical per-dose amounts).
      </p>

      {/* Column headers */}
      <div className="grid grid-cols-5 gap-3 font-semibold text-xs text-gray-600 uppercase mb-2 border-b border-gray-100 pb-2 mt-3">
        <div>Pain Intensity</div><div>Drug</div><div>Route</div><div>Freq</div><div>Proposed regimen (PRN)</div>
      </div>

      {PAIN_ROWS.map((row) => {
        const key = row.key;
        const sel = painRowSelections[key] || {};
        const suggestion = prnRows[key];
        const allowedRoutes = sel.drug ? ALLOWED_ROUTES[sel.drug] : [];
        return (
          <div key={key} className="grid grid-cols-5 gap-3 items-center mb-3">
            <div className="font-semibold text-sm text-gray-800">{short(key)}</div>

            {/* Drug */}
            <select
              className="w-full h-10 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-800 text-sm"
              value={sel.drug ?? ""}
              onChange={(e) => {
                const val = (e.target.value || undefined) as Opioid | undefined;
                setPainRowSelections((p) => ({ ...p, [key]: { ...p[key], drug: val, route: undefined } }));
              }}
            >
              <option value="" disabled>— select —</option>
              {Object.keys(OPIOID_LABELS)
                .filter((k) => k !== "fentanyl_tds" && k !== "methadone" && k !== "buprenorphine")
                .map((k) => <option key={k} value={k}>{OPIOID_LABELS[k as Opioid]}</option>)}
            </select>

            {/* Route */}
            <select
              className="w-full h-10 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-800 disabled:bg-gray-100 text-sm"
              value={sel.route ?? ""}
              disabled={!sel.drug}
              onChange={(e) => {
                const val = (e.target.value || undefined) as Route | undefined;
                setPainRowSelections((p) => ({ ...p, [key]: { ...p[key], route: val } }));
              }}
            >
              <option value="" disabled>— select —</option>
              {allowedRoutes.map((rt) => <option key={rt} value={rt}>{ROUTE_LABELS[rt]}</option>)}
            </select>

            {/* Freq */}
            <select
              className="w-full h-10 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-800 text-sm"
              value={sel.freq ?? ""}
              onChange={(e) =>
                setPainRowSelections((p) => ({ ...p, [key]: { ...p[key], freq: Number(e.target.value) || undefined } }))
              }
            >
              <option value="" disabled>— select —</option>
              {[2, 3, 4, 6, 8, 12].map((h) => <option key={h} value={h}>{`q${h}h`}</option>)}
            </select>

            {/* Proposed */}
            <div>
              {suggestion.text ? (
                <input
                  readOnly
                  value={`${short(key)}: ${suggestion.text}`}
                  className="w-full h-10 px-3 py-2 border border-blue-200 rounded-lg bg-blue-50 text-blue-800 font-mono text-sm shadow-inner truncate"
                />
              ) : (
                <div className="text-xs text-gray-400 p-2 border border-dashed rounded-lg h-10 flex items-center">
                  Select drug, route, and frequency
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Long-acting decision */}
      {!opioidNaive && hasERRows && (
        <div className="mt-6 pt-4 border-t border-gray-100">
          <div className="font-bold text-sm text-gray-900 mb-2">Long-acting maintenance (from home)</div>
          <div role="radiogroup" aria-label="Continue long-acting home opioid" className="flex gap-2 text-sm">
            {[
              { label: 'YES — continue', value: true, color: 'bg-green-600 border-green-600' },
              { label: 'NO — hold', value: false, color: 'bg-red-500 border-red-500' },
              { label: 'Decide later', value: null, color: 'bg-gray-500 border-gray-500' },
            ].map((opt) => (
              <label
                key={String(opt.value)}
                className={`inline-flex items-center gap-1 px-3 py-1 border rounded-lg cursor-pointer transition-colors font-medium ${continueER === opt.value ? `${opt.color} text-white` : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
                  }`}
              >
                <input type="radio" name="continueER" value={String(opt.value)} checked={continueER === opt.value} onChange={() => setContinueER(opt.value)} className="sr-only" />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Multimodal merged here */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <div className="font-bold text-base text-gray-900">Include Multimodal Pain Medicines</div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
          <LabeledToggle label="Generalized pain?" checked={needGeneral} onChange={setNeedGeneral} />
          <LabeledToggle label="Neuropathy?" checked={needNeuropathic} onChange={setNeedNeuropathic} />
          <LabeledToggle label="Muscle spasms?" checked={needSpasm} onChange={setNeedSpasm} />
          <LabeledToggle label="Localized pain?" checked={needLocalized} onChange={setNeedLocalized} />
        </div>

        <div className="mt-4">
          <div className="font-semibold text-sm text-gray-700 mb-1">Selected multimodal medicines:</div>
          <ul className="pl-5 list-disc space-y-1 text-sm text-gray-700">
            {(needGeneral || needNeuropathic || needSpasm || needLocalized) ? (
              <>
                {needGeneral && <li>Tylenol 650–1000 mg PO q6h or NSAIDs (if no contraindications).</li>}
                {needNeuropathic && <li>Gabapentin 100–300 mg PO q8–12h (renally adjust; caution oversedation).</li>}
                {needSpasm && <li>Methocarbamol 500 mg PO q8h PRN spasm (sedation caution).</li>}
                {needLocalized && <li>Lidocaine 5% patch: apply up to 12 h/day (max 3; avoid broken skin).</li>}
              </>
            ) : (
              <li className="text-gray-500">None selected</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ======================= ScheduledRegimenCreator ======================= */

function ScheduledRegimenCreator({
  showEqui,
  setShowEqui,
}: {
  showEqui: boolean;
  setShowEqui: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const {
    conversion,
    targetDrug,
    targetRoute,
    schedFreqHours,
    setTargetDrug,
    setTargetRoute,
    setSchedFreqHours,
    setReduction,
    reduction,
    setIntensityPct,
    intensityPct,
    setFrail,
    frail,
    ome,
    opioidNaive,
  } = useRegimenContext();

  const suggestedDose = useMemo(() => {
    if (opioidNaive) return "Scheduled regimen not calculated for opioid-naïve patient.";
    if (ome === 0) return "Enter home regimen (OME > 0) to calculate a scheduled dose.";

    if (conversion.fentanylPatchMcgHr) {
      const [lo, hi] = conversion.fentanylPatchMcgHr;
      return `Fentanyl Patch ${lo}–${hi} mcg/h`;
    }
    if (conversion.adjPerDose) {
      const [lo, hi] = conversion.adjPerDose;
      const routeLabel = ROUTE_LABELS[targetRoute];
      return `${OPIOID_LABELS[targetDrug]} ${fmtDose(lo)}–${fmtDose(
        hi
      )} ${routeLabel} q${schedFreqHours}h`;
    }
    return conversion.trace.join(" ") || "Conversion not available or requires specialist guidance.";
  }, [conversion, targetDrug, targetRoute, schedFreqHours, ome, opioidNaive]);

  const inputClass =
    "w-full h-10 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-800 text-sm disabled:bg-gray-100 disabled:text-gray-500";
  const labelClass = "block text-xs font-medium text-gray-500 mb-1";
  const checkboxClass = "form-checkbox h-4 w-4 text-indigo-600 rounded";

  return (
    <section className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-900">
          Build Scheduled Regimen (opioid-tolerant only)
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-600">Show</span>
          <Switch checked={showEqui} onChange={setShowEqui} />
        </div>
      </div>

      {showEqui && !opioidNaive && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className={labelClass}>Target drug</label>
              <select
                className={inputClass}
                value={targetDrug}
                onChange={(e) => setTargetDrug(e.target.value as Opioid)}
              >
                {Object.keys(OPIOID_LABELS).map((k: string) => (
                  <option key={k} value={k}>
                    {OPIOID_LABELS[k as Opioid]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Route</label>
              <select
                className={inputClass}
                value={targetRoute}
                onChange={(e) => setTargetRoute(e.target.value as Route)}
              >
                {(ALLOWED_ROUTES[targetDrug] || []).map((rt: Route) => (
                  <option key={rt} value={rt}>
                    {ROUTE_LABELS[rt]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>qHours (scheduled)</label>
              <select
                className={inputClass}
                value={schedFreqHours}
                onChange={(e) =>
                  setSchedFreqHours(Number(e.target.value) || 4)
                }
                disabled={targetDrug === "fentanyl_tds"}
              >
                {[2, 3, 4, 6, 8, 12].map((h) => (
                  <option key={h} value={h}>{`q${h}h`}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Cross-tolerance %↓</label>
              <input
                className={inputClass}
                type="number"
                value={reduction}
                onChange={(e) =>
                  setReduction(
                    Math.max(0, Math.min(95, Number(e.target.value) || 0))
                  )
                }
              />
            </div>
            <div>
              <label className={labelClass}>Intensity adjust (%)</label>
              <input
                className={inputClass}
                type="number"
                value={intensityPct}
                onChange={(e) =>
                  setIntensityPct(
                    Math.max(-50, Math.min(100, Number(e.target.value) || 0))
                  )
                }
              />
              <p className="text-gray-500 text-[10px] mt-1 font-medium">
                OME × (1 + adjust/100)
              </p>
            </div>
            <div className="flex items-center gap-2 mt-auto h-10">
              <input
                type="checkbox"
                id="sched-frail"
                className={checkboxClass}
                checked={frail}
                onChange={(e) => setFrail(e.target.checked)}
              />
              <label htmlFor="sched-frail" className="text-sm text-gray-600">
                Frail / elderly?
              </label>
            </div>
          </div>

          <div className="mt-6 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
            <div className="text-sm font-semibold text-indigo-700">
              Suggested Scheduled Dose
            </div>
            <div className="text-lg font-bold text-indigo-900 mt-1">
              {suggestedDose}
            </div>
          </div>

          <details className="text-sm mt-4">
            <summary className="font-medium text-gray-700 cursor-pointer hover:text-indigo-600 transition-colors">
              View calculation steps
            </summary>
            <ol className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs whitespace-pre-wrap font-mono text-gray-800 list-decimal list-inside space-y-1">
              {conversion.trace.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </details>
        </div>
      )}
      {showEqui && opioidNaive && (
        <p className="mt-4 text-red-500 text-sm">
          Scheduled regimen calculations are disabled for opioid-naïve patients.
        </p>
      )}
    </section>
  );
}

/* ======================= RegimenSummary (A&P format + toggle here) ======================= */

/* ======================= RegimenSummary (A&P format + toggle here) ======================= */

function RegimenSummary({
  showEqui,
  showPrnArea,
  setShowPrnArea,
}: {
  showEqui: boolean;
  showPrnArea: boolean;
  setShowPrnArea: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const {
    prnRows,
    homeRows,
    continueER,
    conversion,
    targetDrug,
    targetRoute,
    schedFreqHours,
    needSpasm,
    needNeuropathic,
    needLocalized,
    needGeneral,
  } = useRegimenContext();

  const longActFormattedList = useMemo(
    () =>
      homeRows
        .filter((r) => r.isER && !r.isPRN)
        .map(
          (r) =>
            `${OPIOID_LABELS[r.drug as Opioid]} ${fmtDose(
              r.doseMg as number
            )} ${r.route ? ROUTE_LABELS[r.route] : ""}${
              r.freqHours ? ` q${r.freqHours}h` : ""
            }`
        ),
    [homeRows]
  );

  const scheduledParts: string[] = [];

  if (showEqui && conversion.adjPerDose) {
    const [lo, hi] = conversion.adjPerDose;
    scheduledParts.push(
      `${OPIOID_LABELS[targetDrug]} ${fmtDose(lo)}–${fmtDose(
        hi
      )} ${ROUTE_LABELS[targetRoute]} q${schedFreqHours}h`
    );
  } else if (showEqui && conversion.fentanylPatchMcgHr) {
    const [loP, hiP] = conversion.fentanylPatchMcgHr;
    scheduledParts.push(`Fentanyl patch ~${loP}–${hiP} mcg/h`);
  }

  if (continueER === true && longActFormattedList.length) {
    scheduledParts.push(...longActFormattedList);
  } else if (continueER === false && scheduledParts.length === 0) {
    scheduledParts.push(
      "Scheduled Opioid: Held (home ER/LA held, no new basal ordered)"
    );
  }

  const scheduledLine = scheduledParts.length
    ? scheduledParts.join(" + ")
    : "Scheduled Opioid: None / Not Calculated";

  const selectedAdjuncts: string[] = [
    needGeneral &&
      "Add scheduled Tylenol 650–1000 mg PO q6h or NSAIDs",
    needNeuropathic &&
      "Add Gabapentin 100–300 mg PO q8–12h",
    needSpasm &&
      "Consider Methocarbamol 500 mg PO q8h for PRN spasm ",
    needLocalized &&
      "Add Lidocaine 5% patch to affected areas up to 12 h/day",
  ].filter(Boolean) as string[];

  // A&P-friendly block
  const prnLines = [
    prnRows.moderate.text ? `> ${prnRows.moderate.text}` : "> —",
    prnRows.severe.text ? `> ${prnRows.severe.text}` : "> —",
    prnRows.breakthrough.text ? `> ${prnRows.breakthrough.text}` : "> —",
  ].join("\n");

  const mmList = selectedAdjuncts.length
    ? selectedAdjuncts.map((x) => `>  * ${x}`).join("\n")
    : ">  * None selected";

  const planText = `# Pain Management
Plan:
1. Continue ${scheduledLine}
2. For moderate, severe, and breakthrough pain:
${prnLines}
3. Multimodal regimen
${mmList}

`;

  return (
    <section className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-900">Final Regimen Summary</h3>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-600">
            {showPrnArea ? "Hide" : "Show"} text
          </span>
          <Switch checked={showPrnArea} onChange={setShowPrnArea} />
        </div>
      </div>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-colors"
          onClick={() => copyToClipboard(planText)}
        >
          Copy A&P Block
        </button>
      </div>

      {/* Full, auto-expanding readout (no scrollbar) */}
      <div className={showPrnArea ? "mt-4 block" : "hidden"}>
        <pre
          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg
                     text-sm whitespace-pre-wrap font-mono text-gray-800"
        >
          {planText}
        </pre>
      </div>
    </section>
  );
}


/* ======================= Main ======================= */

export default function OpioidConversionDemo() {
  const [opioidNaive, setOpioidNaive] = useState(false);
  const [homeRows, setHomeRows] = useState<HomeMedRow[]>([
    { id: generateUniqueId(), isPRN: false },
  ]);

  const [targetDrug, setTargetDrug] = useState<Opioid>("hydromorphone");
  const [targetRoute, setTargetRoute] = useState<Route>("iv");
  const [intensityPct, setIntensityPct] = useState<number>(0);
  const [schedFreqHours, setSchedFreqHours] = useState<number>(4);
  const [reduction, setReduction] = useState<number>(25);
  const [frail, setFrail] = useState<boolean>(false);
  const [showEqui, setShowEqui] = useState(false);

  const [painRowSelections, setPainRowSelections] = useState<
    Record<Severity, PainRowSelection>
  >({ moderate: {}, severe: {}, breakthrough: {} });
  const [continueER, setContinueER] = useState<boolean | null>(null);
  const [showPrnArea, setShowPrnArea] = useState(true);

  // Multimodal toggles live in context; no separate section anymore
  const [needSpasm, setNeedSpasm] = useState(false);
  const [needNeuropathic, setNeedNeuropathic] = useState(false);
  const [needLocalized, setNeedLocalized] = useState(false);
  const [needGeneral, setNeedGeneral] = useState(false);

  const [showQuick, setShowQuick] = useState(false);

  const updateHomeRow = useCallback((id: string, patch: Partial<HomeMedRow>) => {
    setHomeRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const next: HomeMedRow = { ...r, ...patch };
        if (next.drug && next.route) {
          const allowed = ALLOWED_ROUTES[next.drug];
          if (!allowed.includes(next.route)) next.route = allowed[0];
        }
        return next;
      })
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
    const allowed = ALLOWED_ROUTES[targetDrug] || [];
    if (!allowed.includes(targetRoute)) setTargetRoute(allowed[0]);
  }, [targetDrug, targetRoute]);

  useEffect(() => {
    if (opioidNaive) {
      setHomeRows([]);
      setShowEqui(false);
    } else if (!opioidNaive && homeRows.length === 0) {
      setHomeRows([{ id: generateUniqueId(), isPRN: false }]);
    }
  }, [opioidNaive]); // eslint-disable-line

  const { ome, details } = useMemo(() => totalHomeOME(homeRows), [homeRows]);

  const conversion: ConversionResult = useMemo(() => {
    const dosesPerDay = Math.max(
      1,
      Math.round(24 / Math.max(1, schedFreqHours))
    );
    const baseOME = ome;
    const fromOME = baseOME * (1 + intensityPct / 100);

    const adjusted = rotateToTarget(fromOME, targetDrug, targetRoute, {
      crossToleranceReductionPct: reduction,
      frailOrElderly: frail,
    });

    const trace = [`1) Total home OME ≈ ${Math.round(baseOME)} mg/day`];
    trace.push(
      `2) Intensity adjust: ${baseOME.toFixed(1)} × (1 + ${intensityPct}/100) = ${fromOME.toFixed(
        1
      )} OME/day`
    );
    trace.push(...adjusted.notes);

    let adjPerDose: [number, number] | null = null;
    if (adjusted.range) {
      const [lo, hi] = adjusted.range;
      adjPerDose = [
        roundPerDose(targetDrug, targetRoute, Math.max(0, lo / dosesPerDay)),
        roundPerDose(targetDrug, targetRoute, Math.max(0, hi / dosesPerDay)),
      ];
      trace.push(
        `4) Doses/day = ${dosesPerDay}. Adjusted per-dose: ${adjPerDose[0]}–${adjPerDose[1]} mg q${schedFreqHours}h`
      );
    }

    return {
      adjPerDose,
      trace,
      fentanylPatchMcgHr: adjusted.fentanylPatchMcgHr,
    };
  }, [
    ome,
    targetDrug,
    targetRoute,
    schedFreqHours,
    reduction,
    frail,
    intensityPct,
  ]);

  const prnRows: PrnRows = useMemo(() => {
    const build = (sev: Severity) => {
      const sel = painRowSelections[sev];
      if (!sel?.drug || !sel?.route || !sel?.freq)
        return { text: "" } as PrnSuggestionResult;
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

  const regimenContextValue: RegimenContextType = useMemo(
    () => ({
      ome,
      details,
      opioidNaive,
      setOpioidNaive,
      homeRows,
      updateHomeRow,
      addHomeRow,
      removeHomeRow,
      conversion,
      targetDrug,
      setTargetDrug,
      targetRoute,
      setTargetRoute,
      schedFreqHours,
      setSchedFreqHours,
      intensityPct,
      setIntensityPct,
      reduction,
      setReduction,
      frail,
      setFrail,
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
      conversion,
      targetDrug,
      targetRoute,
      schedFreqHours,
      intensityPct,
      reduction,
      frail,
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
    <RegimenContext.Provider value={regimenContextValue}>
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 font-sans text-gray-800">
        <header className="max-w-6xl mx-auto mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Opioid Conversion & Regimen Builder
          </h1>
          <p className="mt-2 text-base text-gray-600">
            A clinical tool combining OME conversion, PRN suggestions, and multimodal pain medicines.
            <span className="font-bold text-blue-600 ml-1">
              This supports clinical decision-making and does not replace clinical judgement.
            </span>
          </p>
        </header>

        <div className="max-w-6xl mx-auto space-y-6">
          <HomeRegimenInput />

          {/* PRN + Multimodal merged */}
          <PRNSuggestionTable showPrnArea={showPrnArea} setShowPrnArea={setShowPrnArea} />

          {/* Final Summary with A&P format + its own toggle */}
          <RegimenSummary
            showEqui={showEqui}
            showPrnArea={showPrnArea}
            setShowPrnArea={setShowPrnArea}
          />

          {/* Quick converter */}
          <section className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900">Quick Opioid-to-Opioid Converter</h3>
              <Switch checked={showQuick} onChange={setShowQuick} />
            </div>
            {showQuick && <QuickConvert />}
          </section>

          {/* Scheduled builder */}
          <ScheduledRegimenCreator showEqui={showEqui} setShowEqui={setShowEqui} />
        </div>
      </div>
    </RegimenContext.Provider>
  );
}
