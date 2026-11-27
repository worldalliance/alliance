import type { FormulaProblemDto } from "@alliance/shared/client";
import React from "react";
import MarkedDiagnostics from "../MarkedDiagnostics";

/** A name problem's message, or each diagnostic marked in the text it is about. */
const FormulaDiagnostics: React.FC<{ problem: FormulaProblemDto }> = ({
  problem,
}) => {
  switch (problem.kind) {
    case "name":
      if (problem.message === undefined) {
        throw new Error("a name problem without its message");
      }
      return <p className="text-caption text-danger">{problem.message}</p>;
    case "named":
    case "dependent": {
      const { text, diagnostics } = problem;
      if (text === undefined || diagnostics === undefined) {
        throw new Error(`a ${problem.kind} problem without its text`);
      }
      return <MarkedDiagnostics text={text} diagnostics={diagnostics} />;
    }
    default:
      throw new Error(`unknown problem kind: ${problem.kind satisfies never}`);
  }
};

export default FormulaDiagnostics;
