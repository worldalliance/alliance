import { useCallback, useEffect, useRef } from "react";
import { useBeforeUnload, useBlocker } from "react-router";

/**
 * Asks before leaving the page, in the app or the browser, while there are
 * unsaved changes. The returned function runs a navigation the page's own
 * save starts, which would otherwise still see the stale dirty state.
 */
export function useUnsavedChangesPrompt({
  hasUnsavedChanges,
}: {
  hasUnsavedChanges: boolean;
}) {
  useBeforeUnload(
    useCallback(
      (event) => {
        if (!hasUnsavedChanges) return;
        event.preventDefault();
        event.returnValue = "";
      },
      [hasUnsavedChanges],
    ),
  );

  const skipRef = useRef(false);
  const blocker = useBlocker(
    useCallback(
      () => hasUnsavedChanges && !skipRef.current,
      [hasUnsavedChanges],
    ),
  );

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (
      window.confirm(
        "You have unsaved changes. Are you sure you want to leave this page?",
      )
    ) {
      blocker.proceed();
    } else {
      blocker.reset();
    }
  }, [blocker]);

  return useCallback((navigate: () => void) => {
    skipRef.current = true;
    navigate();
    skipRef.current = false;
  }, []);
}
