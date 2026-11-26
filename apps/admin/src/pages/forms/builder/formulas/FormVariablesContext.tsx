import type { FormVariable } from "@alliance/common/forms/variables";
import { createContext, use, type ReactNode } from "react";

const NO_VARIABLES: FormVariable[] = [];

const FormVariablesContext = createContext<FormVariable[]>(NO_VARIABLES);

export function FormVariablesProvider({
  variables,
  children,
}: {
  variables: FormVariable[] | undefined;
  children: ReactNode;
}) {
  return (
    <FormVariablesContext value={variables ?? NO_VARIABLES}>
      {children}
    </FormVariablesContext>
  );
}

export function useFormVariables(): FormVariable[] {
  return use(FormVariablesContext);
}
