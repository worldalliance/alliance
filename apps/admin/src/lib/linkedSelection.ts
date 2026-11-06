import { R, type Result } from "@alliance/common/result";
import { useEffect } from "react";
import type { SetURLSearchParams } from "react-router";
import getCaretCoordinates from "textarea-caret";
import { z } from "zod";
import { ACTION_TEXT_FIELD_LABELS } from "./actionFieldDefs";
import { dropSearchParams } from "./dropSearchParams";

/** Action text fields a link can select in, each the id of its input. */
export enum LinkedField {
  Name = "name",
  ShortDescription = "shortDescription",
  Body = "body",
}

const LINKED_FIELD_LABELS: Record<LinkedField, string> =
  ACTION_TEXT_FIELD_LABELS;

/** `text` is the range's text when the link was made, to catch an edit since. */
export type LinkedSelection = {
  field: LinkedField;
  from: number;
  to: number;
  text: string;
};

const PARAMS = ["field", "from", "to", "text"] as const;

const offset = z
  .string()
  .regex(/^\d+$/)
  .transform((value) => Number(value));

const linkedSelectionSchema = z
  .object({
    field: z.enum(LinkedField),
    from: offset,
    to: offset,
    text: z.string(),
  })
  .refine(({ from, to }) => from <= to);

export const selectionSearch = ({ field, from, to, text }: LinkedSelection) =>
  new URLSearchParams({
    field,
    from: String(from),
    to: String(to),
    text,
  }).toString();

/** Null when the URL carries no selection. */
export function readLinkedSelection(
  params: URLSearchParams,
): Result<LinkedSelection | null, string> {
  if (!PARAMS.some((name) => params.has(name))) return R.success(null);
  const parsed = linkedSelectionSchema.safeParse(
    Object.fromEntries(PARAMS.map((name) => [name, params.get(name)])),
  );
  return parsed.success
    ? R.success(parsed.data)
    : R.failure(`Unreadable text selection link: ${params.toString()}`);
}

function scrollParent(element: Element): Element {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight
    )
      return node;
  }
  return document.scrollingElement ?? document.documentElement;
}

function selectIn({
  field: id,
  from,
  to,
  text,
}: LinkedSelection): Result<void, string> {
  const field = document.getElementById(id);
  const label = LINKED_FIELD_LABELS[id];
  if (!(field instanceof HTMLTextAreaElement)) {
    return R.failure(
      `Couldn't select the flagged text: this page has no "${label}" field.`,
    );
  }
  if (field.value.slice(from, to) !== text) {
    return R.failure(
      `Couldn't select the flagged text: "${label}" no longer reads ${JSON.stringify(text)} there, so it changed since the check.`,
    );
  }
  field.focus({ preventScroll: true });
  field.setSelectionRange(from, to);
  // Name and short description scroll inside themselves, so they scroll the
  // selection's line to their middle; the body grows to fit its text, so
  // only the pane holding it scrolls.
  const caretTop = getCaretCoordinates(field, from).top;
  field.scrollTop = caretTop - field.clientHeight / 2;
  const scroller = scrollParent(field);
  const paneTop =
    scroller === document.scrollingElement
      ? 0
      : scroller.getBoundingClientRect().top;
  scroller.scrollBy({
    top:
      field.getBoundingClientRect().top -
      paneTop +
      caretTop -
      field.scrollTop -
      scroller.clientHeight / 2,
  });
  return R.success(undefined);
}

export function useLinkedSelection(params: {
  ready: boolean;
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  onError: (message: string) => void;
}) {
  const { ready, searchParams, setSearchParams, onError } = params;
  useEffect(() => {
    if (!ready) return;
    const read = readLinkedSelection(searchParams);
    if (read.ok && !read.value) return;
    const selected = read.ok && read.value ? selectIn(read.value) : read;
    if (!selected.ok) onError(selected.error);
    dropSearchParams(setSearchParams, PARAMS);
  }, [ready, searchParams, setSearchParams, onError]);
}
