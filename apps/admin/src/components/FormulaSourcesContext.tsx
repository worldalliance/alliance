import { createContext, use, type ReactNode } from "react";
import type { InputSources } from "./VariableInputPickers";

export type FormulaSources = {
  sources: InputSources;
  formListFailed: boolean;
};

const FormulaSourcesContext = createContext<FormulaSources | null>(null);

export function FormulaSourcesProvider({
  value,
  children,
}: {
  value: FormulaSources;
  children: ReactNode;
}) {
  return (
    <FormulaSourcesContext value={value}>{children}</FormulaSourcesContext>
  );
}

export function useFormulaSources(): FormulaSources {
  const sources = use(FormulaSourcesContext);
  if (sources === null) {
    throw new Error("useFormulaSources needs a FormulaSourcesProvider");
  }
  return sources;
}
