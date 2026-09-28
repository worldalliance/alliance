import { useCallback, useState } from "react";
import { formulaSourcesChangedRefreshed } from "../lib/copy";
import { formulaSourcesChanged, type SubmitResult } from "./formulaChoices";

/**
 * Refetches the histories a form's options read when the server says they
 * changed, keeping the form's answers. `reload` goes to the renderer's
 * `reloadSourceHistories`.
 */
export function useFormulaSourcesRefetch(setError: (message: string) => void): {
  reload: number;
  refetchIfSourcesChanged: (result: SubmitResult) => boolean;
} {
  const [reload, setReload] = useState(0);
  const refetchIfSourcesChanged = useCallback(
    (result: SubmitResult) => {
      if (!formulaSourcesChanged(result)) return false;
      setError(formulaSourcesChangedRefreshed);
      setReload((n) => n + 1);
      return true;
    },
    [setError],
  );
  return { reload, refetchIfSourcesChanged };
}
