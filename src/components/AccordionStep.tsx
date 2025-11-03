// src/components/AccordionStep.tsx

import React from "react";
import { ChevronDown, Check, X } from "lucide-react";

interface AccordionStepProps {
  step: number;
  title: string;
  subTitle: string;
  isOpen: boolean;
  onToggle: () => void;
  isComplete: boolean;
  children: React.ReactNode;
}

const statusClasses = {
  complete: "bg-green-100 text-green-700",
  incomplete: "bg-gray-100 text-gray-500",
};

export function AccordionStep({
  step,
  title,
  subTitle,
  isOpen,
  onToggle,
  isComplete,
  children,
}: AccordionStepProps) {
  const currentStatus = isComplete ? "complete" : "incomplete";

  return (
    <div 
      className={`bg-white rounded-xl shadow-lg border transition-all duration-300 overflow-hidden ${
        isOpen ? 'border-indigo-400 shadow-indigo-200' : 'border-gray-200'
      }`}
    >
      {/* HEADER */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-6 transition-colors duration-200 ${
          isOpen ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-gray-50'
        }`}
        aria-expanded={isOpen}
      >
        <div className="flex items-center text-left">
          {/* STEP NUMBER & STATUS */}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mr-4 shrink-0 ${statusClasses[currentStatus]}`}>
            {isComplete ? <Check size={18} /> : step}
          </div>
          
          <div>
            <h2 className={`text-lg font-extrabold ${isOpen ? 'text-indigo-800' : 'text-gray-900'}`}>{title}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{subTitle}</p>
          </div>
        </div>

        {/* TOGGLE ICON */}
        <ChevronDown 
            className={`w-5 h-5 text-gray-500 transition-transform ${isOpen ? 'rotate-180 text-indigo-600' : ''}`}
        />
      </button>

      {/* CONTENT */}
      {/* Only render content if it's open */}
      {isOpen && (
        <div className="p-6 pt-4 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  );
}