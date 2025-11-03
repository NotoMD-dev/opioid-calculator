// src/components/ui/MMEEquivCompactTable.tsx

import React from "react";

export function MMEEquivCompactTable() {
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