import { useCallback, useRef, useState } from "react";
import { textContext } from "../lib/textContext";
import ConfirmDialog from "./ConfirmDialog";

const LEGACY_TEXT = /worldalliance/gi;

const stringsIn = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value !== null && typeof value === "object") {
    return Object.values(value).flatMap(stringsIn);
  }
  return [];
};

/** The text around each mention of worldalliance in any string `value` holds, at any depth. */
export function worldallianceExcerpts(value: unknown): string[] {
  const excerpts = stringsIn(value).flatMap((text) =>
    [...text.matchAll(LEGACY_TEXT)].map((match) => {
      const start = match.index;
      const end = start + match[0].length;
      const { before, flagged, after, cutBefore, cutAfter } = textContext({
        text,
        start,
        end,
      });
      // The context window can cut an emoji's surrogate pair in half.
      const excerpt = [
        cutBefore ? "…" : "",
        before.replace(/^[\uDC00-\uDFFF]/, ""),
        flagged,
        after.replace(/[\uD800-\uDBFF]$/, ""),
        cutAfter ? "…" : "",
      ].join("");
      return excerpt.replace(/\s+/g, " ");
    }),
  );
  return [...new Set(excerpts)];
}

/**
 * `confirmSave(value)` resolves true at once when `value` doesn't mention
 * worldalliance, and otherwise opens `dialog` and resolves with the admin's
 * choice. A call that finds worldalliance while the dialog is open replaces
 * it, resolving the earlier call false.
 */
export function useWorldallianceConfirm() {
  const [excerpts, setExcerpts] = useState<string[] | null>(null);
  const resolveOpen = useRef<((confirmed: boolean) => void) | null>(null);

  const confirmSave = useCallback((value: unknown): Promise<boolean> => {
    const found = worldallianceExcerpts(value);
    if (found.length === 0) return Promise.resolve(true);
    resolveOpen.current?.(false);
    setExcerpts(found);
    return new Promise((resolve) => {
      resolveOpen.current = resolve;
    });
  }, []);

  const settle = (confirmed: boolean) => {
    resolveOpen.current?.(confirmed);
    resolveOpen.current = null;
    setExcerpts(null);
  };

  const dialog = (
    <ConfirmDialog
      isOpen={excerpts !== null}
      title="Save with worldalliance text?"
      message={[
        "This mentions worldalliance. Links to worldalliance.org still redirect, but new ones should use thealliance.org. Names that still use worldalliance, such as the GitHub organization, can stay.",
        "",
        ...(excerpts ?? []).map((excerpt) => `• ${excerpt}`),
      ].join("\n")}
      confirmLabel="Save anyway"
      onCancel={() => settle(false)}
      onConfirm={() => settle(true)}
    />
  );

  return { confirmSave, dialog };
}
