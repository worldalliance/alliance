import { useEffect } from "react";
import type { SetURLSearchParams } from "react-router";

export type LinkedSelection = { field: string; from: number; to: number };

const PARAMS = ["field", "from", "to"] as const;

export const selectionSearch = ({ field, from, to }: LinkedSelection) =>
  new URLSearchParams({ field, from: String(from), to: String(to) }).toString();

export function readLinkedSelection(
  params: URLSearchParams,
): LinkedSelection | null {
  const field = params.get("field");
  const from = Number(params.get("from"));
  const to = Number(params.get("to"));
  if (!field || !Number.isInteger(from) || !Number.isInteger(to)) return null;
  return { field, from, to };
}

/**
 * Once `ready`, focuses the field a link named and selects its range, then
 * drops the link's parameters so a reload doesn't select it again.
 */
export function useLinkedSelection(params: {
  ready: boolean;
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
}) {
  const { ready, searchParams, setSearchParams } = params;
  useEffect(() => {
    if (!ready) return;
    const selection = readLinkedSelection(searchParams);
    if (!selection) return;
    const field = document.getElementById(selection.field);
    if (
      field instanceof HTMLTextAreaElement ||
      field instanceof HTMLInputElement
    ) {
      field.focus();
      field.setSelectionRange(selection.from, selection.to);
      field.scrollIntoView({ block: "center" });
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const name of PARAMS) next.delete(name);
        return next;
      },
      { replace: true },
    );
  }, [ready, searchParams, setSearchParams]);
}
