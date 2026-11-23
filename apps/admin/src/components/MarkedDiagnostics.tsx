import React from "react";

type MarkedDiagnostic = { message: string; start: number; end: number };

const MarkedDiagnostics: React.FC<{
  text: string;
  diagnostics: MarkedDiagnostic[];
}> = ({ text, diagnostics }) => (
  <ul className="space-y-2">
    {diagnostics.map(({ message, start, end }) => (
      <li key={`${start}:${end}:${message}`} className="space-y-1">
        <p className="text-sm text-red-700">{message}</p>
        <pre className="text-xs font-mono bg-zinc-50 border border-zinc-200 rounded p-2 whitespace-pre-wrap">
          {text.slice(0, start)}
          <mark className="bg-red-100 text-red-900 underline decoration-wavy decoration-red-600">
            {start === end ? "␣" : text.slice(start, end)}
          </mark>
          {text.slice(end)}
        </pre>
      </li>
    ))}
  </ul>
);

export default MarkedDiagnostics;
