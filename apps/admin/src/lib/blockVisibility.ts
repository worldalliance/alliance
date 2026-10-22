import type { DisplayBlock } from "@alliance/common/forms/display-blocks";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";

/** Per-user content carries its own condition, which renderers prefer. */
export function withBlockVisibility(
  block: DisplayBlock,
  formula: VisibleIfFormula | undefined,
): DisplayBlock {
  const { visibleIfFormula: _previous, ...rest } = block;
  const next = formula ? { ...rest, visibleIfFormula: formula } : rest;
  if (!block.manualUserContent) return next;
  const manualUserContent = Object.fromEntries(
    Object.entries(block.manualUserContent).map(([userId, content]) => {
      const { visibleIfFormula: _previousForUser, ...contentRest } = content;
      return [
        userId,
        formula ? { ...contentRest, visibleIfFormula: formula } : contentRest,
      ];
    }),
  );
  return { ...next, manualUserContent };
}
