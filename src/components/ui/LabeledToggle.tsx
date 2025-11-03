// src/components/ui/LabeledToggle.tsx

import React from "react";
import { Switch } from "./Switch";

export function LabeledToggle({
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