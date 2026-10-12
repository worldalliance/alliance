import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";

const SELECT_PARAM = "select";

/** The form's editor, opened with the question `fieldId` selected. */
export const formEditorPath = (formId: number, fieldId: string) =>
  `/forms/${formId}?${new URLSearchParams({ [SELECT_PARAM]: fieldId })}`;

/**
 * The question `formEditorPath` named when the editor mounted. The parameter
 * leaves the URL at once, so a reload doesn't select the question again.
 */
export function useSelectOnLoad() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectOnLoadRef = useRef(searchParams.get(SELECT_PARAM));
  useEffect(() => {
    if (!searchParams.has(SELECT_PARAM)) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(SELECT_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);
  return selectOnLoadRef;
}
