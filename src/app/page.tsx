// src/app/page.tsx
"use client";

import React, { useState } from "react";
import { RegimenProvider, useRegimenContext } from "../context/RegimenContext";
import { HomeRegimenInput } from "../components/HomeRegimenInput";
import { PRNSuggestionTable } from "../components/PRNSuggestionTable";
import { RegimenSummary } from "../components/RegimenSummary";
import { QuickConvert } from "../components/QuickConvert";
import { Switch } from "../components/ui/Switch";
import { AccordionStep } from "../components/AccordionStep"; // NEW IMPORT
import { ChevronRight } from "lucide-react"; // NEW IMPORT

// =========================================================
// Opioid Regimen Builder - v5.0.0 (UX Rework)
// =========================================================

function AppContent() {
  const { ome, opioidNaive } = useRegimenContext(); // Removed homeRows as it wasn't used here
  const [activeStep, setActiveStep] = useState(1);
  const [showQuick, setShowQuick] = useState(false);

  // Logic to determine if a step is complete (gates the next step)
  const isStep1Complete = opioidNaive || ome > 0;
  const isStep2Complete = isStep1Complete; 

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      
      {/* 1. Home Regimen (Step 1) */}
      <AccordionStep
        step={1}
        title="1. Patient's Home Opioid Regimen"
        subTitle={`Enter all scheduled (ER/LA) and PRN home medications. Current OME: ~${Math.round(ome)} mg/day.`}
        isOpen={activeStep === 1}
        onToggle={() => setActiveStep(activeStep === 1 ? 0 : 1)}
        isComplete={isStep1Complete}
      >
        <HomeRegimenInput />
      </AccordionStep>

      {/* 2. Inpatient Regimen Builder (Step 2) */}
      <AccordionStep
        step={2}
        title="2. Build Inpatient PRN & Multimodal Plan"
        subTitle="Select PRN opioid, route, and frequency. Add adjunctive medications."
        isOpen={activeStep === 2 && isStep1Complete}
        onToggle={() => isStep1Complete && setActiveStep(activeStep === 2 ? 0 : 2)}
        isComplete={isStep2Complete}
      >
        <PRNSuggestionTable />
      </AccordionStep>
      
      {/* Locked State for Step 2 */}
      {!isStep1Complete && (
        <div className="p-6 bg-gray-100 rounded-xl text-gray-500 flex items-center gap-2">
          <ChevronRight size={18} />
          <span>Step 2 Locked: Complete Step 1 or check "Opioid-naïve" to continue.</span>
        </div>
      )}

      {/* 3. Final Summary (Step 3) */}
      {isStep2Complete && (
        <AccordionStep
          step={3}
          title="3. Final Assessment & Plan Summary"
          subTitle="Review the complete order set and copy for easy documentation."
          isOpen={activeStep === 3}
          onToggle={() => setActiveStep(activeStep === 3 ? 0 : 3)}
          isComplete={isStep2Complete}
        >
          <RegimenSummary />
        </AccordionStep>
      )}

      {/* Quick Converter - Secondary Tool (Styled as a non-numbered Accordion) */}
      <div className={`bg-white rounded-xl shadow-lg border transition-all duration-300 ${showQuick ? 'border-indigo-400 shadow-indigo-200' : 'border-gray-200'}`}>
        <div 
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50 cursor-pointer"
          onClick={() => setShowQuick(!showQuick)}
        >
          <h3 className="text-lg font-extrabold text-gray-900">
            Quick Opioid-to-Opioid Converter
          </h3>
          <Switch checked={showQuick} onChange={setShowQuick} />
        </div>
        
        {showQuick && (
            <div className="p-6 pt-4 border-t border-gray-100">
                <QuickConvert />
            </div>
        )}
      </div>
    </div>
  );
}

export default function OpioidConversionPage() {
  return (
    <RegimenProvider>
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 font-sans text-gray-800">
        <header className="max-w-6xl mx-auto mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Opioid Conversion & Regimen Builder
          </h1>
          <p className="mt-2 text-base text-gray-600">
            A clinical tool for calculating opioid conversions and building pain regimens for hospitalized adults.
          </p>
          <p className="text-xs text-gray-500 italic mt-1 pt-1 border-t border-gray-200">
            This tool does not replace clinical judgement and is meant to assist in decision-making. Always verify
            calculations and consider patient-specific factors.
          </p>
        </header>

        <AppContent />
      </div>
    </RegimenProvider>
  );
}