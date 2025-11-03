// src/components/ui/Switch.tsx

import React from "react";

export function Switch({
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
      className={`relative w-14 h-8 rounded-full border border-gray-200 cursor-pointer transition-colors duration-200 ease-in-out ${
        checked ? "bg-indigo-600" : "bg-gray-300"
      }`}
      title={title || (checked ? "On" : "Off")}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-7 h-7 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
          checked ? "translate-x-6" : "translate-x-0"
        }`}
      />
    </div>
  );
}