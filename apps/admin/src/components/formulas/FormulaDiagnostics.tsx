import type { FormulaProblemDto } from "@alliance/shared/client";
import React from "react";

/** A name problem's message, or each diagnostic marked in the text it is about. */
const FormulaDiagnostics: React.FC<{ problem: FormulaProblemDto }> = ({
  problem,
}) => {
  switch (problem.kind) {
    case "name":
      if (problem.message === undefined) {
        throw new Error("a name problem without its message");
      }
      return <p className="text-sm text-red-700">{problem.message}</p>;
    case "named":
    case "dependent": {
      const { text, diagnostics } = problem;
      if (text === undefined || diagnostics === undefined) {
        throw new Error(`a ${problem.kind} problem without its text`);
      }
      return (
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
    }
    default:
      throw new Error(`unknown problem kind: ${problem.kind satisfies never}`);
  }
};

export default FormulaDiagnostics;
