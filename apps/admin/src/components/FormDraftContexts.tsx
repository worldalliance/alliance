import type { ReactNode } from "react";
import {
  ExpressionBuffersContext,
  type ExpressionBuffersValue,
} from "./form-fields/conditions/expressionBuffers";
import {
  CustomValidatorDraftsContext,
  type CustomValidatorDraftsContextValue,
} from "./form-fields/customValidatorDrafts";
import { DerivedWriteContext } from "./form-fields/derivedWrite";

/** The parts of the builder's undoable draft its editors write directly. */
export function FormDraftContexts({
  validatorDrafts,
  expressionBuffers,
  derivedWrite,
  children,
}: {
  validatorDrafts: CustomValidatorDraftsContextValue;
  expressionBuffers: ExpressionBuffersValue;
  derivedWrite: (write: () => void) => void;
  children: ReactNode;
}) {
  return (
    <CustomValidatorDraftsContext.Provider value={validatorDrafts}>
      <ExpressionBuffersContext.Provider value={expressionBuffers}>
        <DerivedWriteContext.Provider value={derivedWrite}>
          {children}
        </DerivedWriteContext.Provider>
      </ExpressionBuffersContext.Provider>
    </CustomValidatorDraftsContext.Provider>
  );
}
