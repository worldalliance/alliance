import { createContext, useContext, type ReactNode } from "react";

/**
 * Marks a form's subtree as previewed: interactive, but storing nothing. Read
 * it wherever a form would otherwise write, and wrap anything that renders a
 * stored answer rather than what the preview typed in `StoredAnswer`.
 */
const PreviewModeContext = createContext(false);

export const PreviewModeProvider = PreviewModeContext.Provider;

export const usePreviewMode = (): boolean => useContext(PreviewModeContext);

/**
 * A stored answer, never a file the preview picked and never uploaded, so it
 * renders as a key under the api even inside a previewed form.
 */
export function StoredAnswer({ children }: { children: ReactNode }) {
  return <PreviewModeProvider value={false}>{children}</PreviewModeProvider>;
}
