import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { dropSearchParams } from "./dropSearchParams";

const SELECT_PARAM = "select";
const PREVIEW_AS_PARAM = "previewAs";

/** The form's editor, opened with the page or element `id` selected. */
export const formEditorPath = (formId: number, id: string) =>
  `/forms/${formId}?${new URLSearchParams({ [SELECT_PARAM]: id })}`;

export const formPreviewPath = ({
  formId,
  userId,
}: {
  formId: number;
  userId: number;
}) =>
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
    dropSearchParams(setSearchParams, [param]);
  }, [param, searchParams, setSearchParams]);
  return onLoadRef;
}

/** The page or element `formEditorPath` named when the editor mounted. */
export const useSelectOnLoad = () => useParamOnLoad(SELECT_PARAM);

/** The member `formPreviewPath` named when the editor mounted. */
export const usePreviewAsOnLoad = () => useParamOnLoad(PREVIEW_AS_PARAM);
