import React from "react";

type MarkedDiagnostic = { message: string; start: number; end: number };

const MarkedDiagnostics: React.FC<{
  text: string;
  diagnostics: MarkedDiagnostic[];
}> = ({ text, diagnostics }) => (
  <ul className="flex flex-col gap-2">
    {diagnostics.map(({ message, start, end }) => (
      <li key={`${start}:${end}:${message}`} className="flex flex-col gap-1">
        <p className="text-caption text-danger">{message}</p>
        <pre className="rounded-md border border-line bg-surface-2 p-2 font-mono text-xs whitespace-pre-wrap text-fg">
          {text.slice(0, start)}
          <mark className="rounded-sm bg-danger-soft text-fg underline decoration-danger decoration-wavy">
            {start === end ? "␣" : text.slice(start, end)}
          </mark>
          {text.slice(end)}
        </pre>
      </li>
    ))}
  </ul>
);

export default MarkedDiagnostics;
