import type { ReactNode } from "react";
import {
  CustomValidatorDraftsContext,
  type CustomValidatorDraftsContextValue,
} from "./form-fields/customValidatorDrafts";
import { DerivedWriteContext } from "./form-fields/derivedWrite";

/** The parts of the builder's undoable draft its editors write directly. */
export function FormDraftContexts({
  validatorDrafts,
  derivedWrite,
  children,
}: {
  validatorDrafts: CustomValidatorDraftsContextValue;
  derivedWrite: (write: () => void) => void;
  children: ReactNode;
}) {
  return (
    <CustomValidatorDraftsContext.Provider value={validatorDrafts}>
      <DerivedWriteContext.Provider value={derivedWrite}>
        {children}
      </DerivedWriteContext.Provider>
    </CustomValidatorDraftsContext.Provider>
  );
}
