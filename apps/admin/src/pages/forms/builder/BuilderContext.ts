import { createContext, useContext } from "react";
import type { FormBuilderState } from "./useFormBuilder";

/** The builder's state and actions, for its panes without threading props. */
export const BuilderContext = createContext<FormBuilderState | null>(null);

export function useBuilder(): FormBuilderState {
  const builder = useContext(BuilderContext);
  if (!builder) throw new Error("useBuilder renders inside a FormBuilder");
  return builder;
}
