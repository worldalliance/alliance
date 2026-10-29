import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { dropSearchParams } from "./dropSearchParams";

const SELECT_PARAM = "select";

/** The form's editor, opened with the page or element `id` selected. */
export const formEditorPath = (formId: number, id: string) =>
  `/forms/${formId}?${new URLSearchParams({ [SELECT_PARAM]: id })}`;

/**
 * The page or element `formEditorPath` named when the editor mounted. The
 * parameter leaves the URL at once, so a reload doesn't select it again.
 */
export function useSelectOnLoad() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectOnLoadRef = useRef(searchParams.get(SELECT_PARAM));
  useEffect(() => {
    if (!searchParams.has(SELECT_PARAM)) return;
    dropSearchParams(setSearchParams, [SELECT_PARAM]);
  }, [searchParams, setSearchParams]);
  return selectOnLoadRef;
}
