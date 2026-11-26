import type { DisplayKind } from "@alliance/common/forms/display-blocks";
import { isDisplayOnlyBlockKind } from "@alliance/common/forms/display-only-schema";
import {
  ADDABLE_FIELD_KINDS,
  DISPLAY_KIND_NAMES,
  DISPLAY_KINDS,
  FIELD_KIND_NAMES,
} from "@alliance/common/forms/element-descriptors";
import type {
  FieldKind,
  Page,
  PageItem,
} from "@alliance/common/forms/form-schema";
import { Plus } from "lucide-react";
import { InsertPicker } from "./InsertPicker";
import { ButtonVariant, buttonVariants } from "../../../../ui/Button";
import { cn } from "../../../../ui/cn";
import { Popover, PopoverContent, PopoverTrigger } from "../../../../ui/Popover";

/** `groupKey` marks an insert point inside a visibility group. */
export type InsertLoc = { groupKey: string | null; index: number };

export const sameInsertLoc = (a: InsertLoc | null, b: InsertLoc) =>
  a != null && a.groupKey === b.groupKey && a.index === b.index;

export type AvailableElement =
  | { id: FieldKind; name: string; type: "field" }
  | { id: DisplayKind; name: string; type: "block"; kind: DisplayKind }
  | { id: "copy-existing"; name: "Copy an existing element…"; type: "copy" };

export const AVAILABLE_ELEMENTS: AvailableElement[] = [
  ...ADDABLE_FIELD_KINDS.map((kind) => ({
    id: kind,
    name: FIELD_KIND_NAMES[kind],
    type: "field" as const,
  })),
  ...DISPLAY_KINDS.map((kind) => ({
    id: kind,
    name: DISPLAY_KIND_NAMES[kind],
    type: "block" as const,
    kind,
  })),
  { id: "copy-existing", name: "Copy an existing element…", type: "copy" },
];

export const DISPLAY_ONLY_ELEMENTS = AVAILABLE_ELEMENTS.filter(
  (element) => element.type === "block" && isDisplayOnlyBlockKind(element.kind),
);

export enum InsertMode {
  Search = "search",
  Copy = "copy",
}

type InsertPointProps = {
  loc: InsertLoc;
  /** The picker open here, if any. */
  mode: InsertMode | null;
  onOpen: () => void;
  onClose: () => void;
  elements: AvailableElement[];
  onPick: (element: AvailableElement) => void;
  pages: Page[];
  onCopy: (source: PageItem) => void;
  /** The page's own "Add element" button, rather than a gap's "+". */
  prominent?: boolean;
};

/**
 * A place to add an element: the 24 px gap between two, the member page's own
 * spacing, whose "+" shows on pointer hover; or the page's "Add element"
 * button. Keyboard readers add from the selection's "Add element below…" or
 * `a`, so the gaps take no tab stop.
 */
export function InsertPoint({
  loc,
  mode,
  onOpen,
  onClose,
  elements,
  onPick,
  pages,
  onCopy,
  prominent = false,
}: InsertPointProps) {
  const open = mode !== null;
  return (
    <Popover open={open} onOpenChange={(next) => (next ? onOpen() : onClose())}>
      {prominent ? (
        <PopoverTrigger
          className={cn(
            buttonVariants({ variant: ButtonVariant.Default }),
            "mt-6 flex w-full justify-center font-sans",
          )}
        >
          <Plus aria-hidden="true" className="size-4" />
          Add element
        </PopoverTrigger>
      ) : (
        <div className="group/gap relative h-6">
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-x-0 top-1/2 h-px bg-accent/40 opacity-0 group-hover/gap:opacity-100",
              open && "opacity-100",
            )}
          />
          <PopoverTrigger
            tabIndex={-1}
            aria-label="Add element here"
            title="Add element here"
            className={cn(
              "absolute left-1/2 top-0 z-10 flex size-6 -translate-x-1/2 items-center justify-center rounded-full border border-accent bg-surface text-accent opacity-0 shadow-pop outline-none hover:bg-accent-soft group-hover/gap:opacity-100 focus-visible:opacity-100",
              open && "opacity-100",
            )}
          >
            <Plus aria-hidden="true" className="size-3.5" />
          </PopoverTrigger>
        </div>
      )}
      <PopoverContent className="p-0" align="center">
        <InsertPicker
          mode={mode ?? InsertMode.Search}
          elements={
            loc.groupKey === null
              ? elements
              : elements.filter((element) => element.type !== "copy")
          }
          onPick={onPick}
          pages={pages}
          onCopy={onCopy}
          onCancel={onClose}
        />
      </PopoverContent>
    </Popover>
  );
}
