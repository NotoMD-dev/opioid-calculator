"use client";
import React, { useState } from "react";
import { RegimenProvider } from "../context/RegimenContext";
import { HomeRegimenInput } from "../components/HomeRegimenInput";
import { PRNSuggestionTable } from "../components/PRNSuggestionTable";
import { RegimenSummary } from "../components/RegimenSummary";
import { QuickConvert } from "../components/QuickConvert";
import { Switch } from "../components/ui/Switch";

// =========================================================
// Opioid Regimen Builder  - v4.0.0 
// Author: Yasmine Abbey, MD (NotoDev) - https://notodev.com
// Complete with Inpatient regimen builder, quick convert, and multimodal suggestions
// =========================================================


// Renamed from OpioidConversionDemo to match Next.js App Router convention (page.tsx)
export default function OpioidConversionPage() {
  // Only minimal UI state remains here
  const [showPrnArea, setShowPrnArea] = useState(true);
  const [showQuick, setShowQuick] = useState(false);
  
  // Note: All scheduled regimen state (targetDrug, reduction, showEqui, etc.) has been removed.

  return (
    <RegimenProvider>
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8 font-sans text-gray-800">
        <header className="max-w-6xl mx-auto mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Opioid Conversion & Regimen Builder
          </h1>
          <p className="mt-2 text-base text-gray-600">
            A clinical tool for calculating opioid conversions and building pain regimens for hospitalized adults. 
            
            <span className="font-extrabold text-black-600 ml-1">
              This tool does not replace clinical judgement and is meant to assist in decision-making. Always verify calculations and consider patient-specific factors.
            </span>
          </p>
        </header>
        <div className="max-w-6xl mx-auto space-y-6">
          <HomeRegimenInput />

          {/* PRN + Multimodal merged */}
          <PRNSuggestionTable showPrnArea={showPrnArea} setShowPrnArea={setShowPrnArea} />

          {/* Quick converter */}
          <section className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900">Quick Opioid-to-Opioid Converter</h3>
              <Switch checked={showQuick} onChange={setShowQuick} />
            </div>
            {showQuick && <QuickConvert />}
          </section>
          
          {/* Note: The ScheduledRegimenCreator section has been removed */}
        </div>
      </div>
    </RegimenProvider>
  );
}