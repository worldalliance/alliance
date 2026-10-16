import { useCallback, useMemo, useRef, type ReactNode } from "react";
import type { useFormDraft } from "../lib/useFormDraft";
import { ExpressionBuffersContext } from "./form-fields/conditions/expressionBuffers";
import { CustomValidatorDraftsContext } from "./form-fields/customValidatorDrafts";
import { DerivedWriteContext } from "./form-fields/derivedWrite";

/** The parts of the builder's undoable draft its editors write directly. */
export function FormDraftContexts({
  formDraft,
  children,
}: {
  formDraft: ReturnType<typeof useFormDraft>;
  children: ReactNode;
}) {
  const {
    validatorDrafts,
    setValidatorDraft,
    removeValidatorDraft,
    expressions,
    setExpression,
  } = formDraft;
  const draftValidatorIdRef = useRef(-1);
  const createDraftId = useCallback(() => {
    const nextId = draftValidatorIdRef.current;
    draftValidatorIdRef.current -= 1;
    return nextId;
  }, []);
  const customValidatorDraftContext = useMemo(
    () => ({
      drafts: validatorDrafts,
      setDraft: setValidatorDraft,
      removeDraft: removeValidatorDraft,
      createDraftId,
    }),
    [createDraftId, removeValidatorDraft, setValidatorDraft, validatorDrafts],
  );
  const expressionBuffers = useMemo(
    () => ({ buffers: expressions, setBuffer: setExpression }),
    [expressions, setExpression],
  );

  return (
    <CustomValidatorDraftsContext.Provider value={customValidatorDraftContext}>
      <ExpressionBuffersContext.Provider value={expressionBuffers}>
        <DerivedWriteContext.Provider value={formDraft.withoutStep}>
          {children}
        </DerivedWriteContext.Provider>
      </ExpressionBuffersContext.Provider>
    </CustomValidatorDraftsContext.Provider>
  );
}
