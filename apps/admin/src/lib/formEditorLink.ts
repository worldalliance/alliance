import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";

const SELECT_PARAM = "select";
const PREVIEW_AS_PARAM = "previewAs";

/** The form's editor, opened with the question `fieldId` selected. */
export const formEditorPath = (formId: number, fieldId: string) =>
  `/forms/${formId}?${new URLSearchParams({ [SELECT_PARAM]: fieldId })}`;

/** The form's preview, opened as the member `userId`. */
export const formPreviewPath = (formId: number, userId: number) =>
  `/forms/${formId}?${new URLSearchParams({ [PREVIEW_AS_PARAM]: String(userId) })}`;

/**
 * `param`'s value when the editor mounted. The parameter leaves the URL at
 * once, so a reload doesn't apply it again.
 */
function useParamOnLoad(param: string) {
  const [searchParams, setSearchParams] = useSearchParams();
  const onLoadRef = useRef(searchParams.get(param));
  useEffect(() => {
    if (!searchParams.has(param)) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(param);
        return next;
      },
      { replace: true },
    );
  }, [param, searchParams, setSearchParams]);
  return onLoadRef;
}

/** The question `formEditorPath` named when the editor mounted. */
export const useSelectOnLoad = () => useParamOnLoad(SELECT_PARAM);

/** The member `formPreviewPath` named when the editor mounted. */
export const usePreviewAsOnLoad = () => useParamOnLoad(PREVIEW_AS_PARAM);
