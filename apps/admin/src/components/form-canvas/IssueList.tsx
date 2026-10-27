import { elementInternalDescriptor } from "@alliance/common/forms/element-descriptors";
import {
  PlaceKind,
  type FormPlace,
} from "@alliance/common/forms/form-conditions";
import type {
  FormSchema,
  Page,
  PageItem,
} from "@alliance/common/forms/form-schema";
import { withCount } from "@alliance/common/plural";
import { cn } from "@alliance/shared/styles/util";
import { LoaderCircle, TriangleAlert, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import {
  IssueTargetKind,
  type FormIssue,
  type IssueIndex,
  type IssueTarget,
} from "../../lib/formIssues";
import {
  CanvasTargetKind,
  ChildKind,
  describeElement,
  pageTitle,
  placeTarget,
  type CanvasTarget,
  type ResolvedTarget,
} from "./canvasSelection";
import { SidebarSection } from "./sidebarSections";
import { useRestoreFocusWithin } from "./useRestoreFocusWithin";

export enum IssueGate {
  Save = "save",
  Preview = "preview",
}

const GATED_ACTION: Record<IssueGate, string> = {
  [IssueGate.Save]: "saving",
  [IssueGate.Preview]: "previewing",
};

/** Where an issue sits, as the issue list names it. */
export function issueLocation(schema: FormSchema, target: IssueTarget): string {
  switch (target.kind) {
    case IssueTargetKind.Place: {
      const { place } = target;
      const page = schema.pages[place.pageIndex]!;
      if (place.kind === PlaceKind.Page) return pageTitle(page);
      const element = page.fields[place.index]!;
      const sub =
        place.kind === PlaceKind.SubField && element.kind === "list"
          ? element.fields[place.subIndex]
          : undefined;
      return [pageTitle(page), describeElement(element)]
        .concat(sub ? describeElement(sub) : [])
        .join(" › ");
    }
    case IssueTargetKind.Group:
      return `${pageTitle(schema.pages[target.pageIndex]!)} › Shared visibility`;
    case IssueTargetKind.OutputView: {
      const view = schema.outputViews?.find(({ id }) => id === target.viewId);
      return `Output view: ${view?.title || "Untitled view"}`;
    }
    case IssueTargetKind.Variables:
      return "Variables";
    case IssueTargetKind.Rows:
      return "Rows";
    case IssueTargetKind.SkipIf:
      return "Skip";
    case IssueTargetKind.Form:
      return "Form";
    default:
      throw new Error(
        `unknown target: ${JSON.stringify(target satisfies never)}`,
      );
  }
}

/** Shows where `issue` is repaired. */
export function openIssue(
  { target, inConditions }: FormIssue,
  {
    pages,
    select,
    showOutputView,
    showVariables,
    showRows,
    showSkipIf,
  }: {
    pages: readonly Page[];
    select: (
      pageIndex: number,
      target: CanvasTarget,
      section: SidebarSection,
    ) => void;
    showOutputView: (viewId: string) => void;
    showVariables: () => void;
    showRows: () => void;
    showSkipIf: () => void;
  },
): void {
  switch (target.kind) {
    case IssueTargetKind.Place:
      return select(
        target.place.pageIndex,
        placeTarget(pages, target.place),
        inConditions ? SidebarSection.Conditions : SidebarSection.Content,
      );
    case IssueTargetKind.Group:
      return select(
        target.pageIndex,
        { kind: CanvasTargetKind.Group, key: target.key },
        SidebarSection.Conditions,
      );
    case IssueTargetKind.OutputView:
      return showOutputView(target.viewId);
    case IssueTargetKind.Variables:
      return showVariables();
    case IssueTargetKind.Rows:
      return showRows();
    case IssueTargetKind.SkipIf:
      return showSkipIf();
    case IssueTargetKind.Form:
      return;
    default:
      throw new Error(
        `unknown target: ${JSON.stringify(target satisfies never)}`,
      );
  }
}

export type IssueRow = {
  location: string;
  message: string;
  /** Null where no editor can show the issue's target. */
  onGo: (() => void) | null;
};

export type SourceCheck = {
  pending: number;
  failed: number;
  onRetry: () => void;
};

export type LoadFailure = {
  message: string;
  retryLabel: string;
  onRetry: () => void;
};

/**
 * The header's count of what blocks Save and Preview, opening a list that
 * links each issue to where it's repaired. `gate` names the action that
 * opened it, which moves focus into the list.
 */
export function IssueList({
  rows,
  sources,
  loadFailure,
  open,
  gate,
  onOpenChange,
}: {
  rows: readonly IssueRow[];
  sources: SourceCheck;
  loadFailure: LoadFailure | null;
  open: boolean;
  gate: IssueGate | null;
  onOpenChange: (open: boolean) => void;
}) {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const count = rows.length + (loadFailure ? 1 : 0);

  useEffect(() => {
    if (open && gate) panelRef.current?.focus();
  }, [open, gate]);

  const restorePanelFocus = useRestoreFocusWithin(panelRef);
  // A row that goes away while focused, as a successful Retry's does, leaves
  // focus on the page, out of reach of the list's Escape.
  useEffect(() => {
    restorePanelFocus();
  });

  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        rootRef.current?.contains(event.target)
      ) {
        return;
      }
      onOpenChange(false);
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open, onOpenChange]);

  const closeAndReturn = () => {
    onOpenChange(false);
    toggleRef.current?.focus();
  };

  if (count === 0 && sources.pending === 0 && sources.failed === 0 && !open) {
    return null;
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape") closeAndReturn();
      }}
    >
      <button
        ref={toggleRef}
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-md px-2 text-sm font-medium",
          count > 0
            ? "text-red-700 hover:bg-red-50"
            : "text-gray-600 hover:bg-gray-100",
        )}
      >
        {count > 0 ? (
          <>
            <TriangleAlert className="h-4 w-4" aria-hidden="true" />
            {withCount(count, "issue")}
          </>
        ) : sources.pending > 0 ? (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            Checking
          </>
        ) : (
          "No issues"
        )}
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          tabIndex={-1}
          aria-label="Issues"
          role="region"
          className="absolute right-0 top-full z-30 mt-1 max-h-[60vh] w-96 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 text-left shadow-lg focus:outline-none"
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900">
              {count === 0
                ? "No issues"
                : gate
                  ? `Fix ${withCount(count, "issue")} before ${GATED_ACTION[gate]}`
                  : withCount(count, "issue")}
            </p>
            <button
              type="button"
              onClick={closeAndReturn}
              aria-label="Close issues"
              title="Close issues"
              className="rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          {sources.pending > 0 && (
            <p role="status" className="mb-2 text-xs text-gray-600">
              Loading the questions of {withCount(sources.pending, "form")} that
              formulas read. Some issues may clear once they load.
            </p>
          )}
          {sources.failed > 0 && (
            <p className="mb-2 flex items-center gap-2 text-xs text-red-700">
              {`Couldn't load the questions of ${withCount(sources.failed, "form")} that formulas read.`}
              <button
                type="button"
                onClick={sources.onRetry}
                className="rounded border border-red-300 px-1.5 py-0.5 font-medium hover:bg-red-50"
              >
                Retry
              </button>
            </p>
          )}
          <ul className="space-y-1">
            {loadFailure && (
              <li className="rounded-md px-2 py-1 text-sm">
                <span className="block font-medium text-gray-900">
                  The form didn&apos;t load
                </span>
                <span className="block text-red-700">
                  {loadFailure.message}
                </span>
                <button
                  type="button"
                  onClick={loadFailure.onRetry}
                  className="mt-1 rounded border border-red-300 px-1.5 py-0.5 text-xs font-medium text-red-700 hover:bg-red-50"
                >
                  {loadFailure.retryLabel}
                </button>
              </li>
            )}
            {rows.map(({ location, message, onGo }, index) => {
              const body = (
                <>
                  <span className="block truncate font-medium text-gray-900">
                    {location}
                  </span>
                  <span className="block text-red-700">{message}</span>
                </>
              );
              return (
                <li key={index}>
                  {onGo ? (
                    <button
                      type="button"
                      onClick={() => {
                        onGo();
                        onOpenChange(false);
                      }}
                      className="block w-full rounded-md px-2 py-1 text-left text-sm hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      {body}
                    </button>
                  ) : (
                    <div className="px-2 py-1 text-sm">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** The selected item's issues, above its settings. */
export function SidebarIssues({ messages }: { messages: readonly string[] }) {
  if (messages.length === 0) return null;
  return (
    <ul
      aria-label="Issues here"
      className="space-y-1 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800"
    >
      {messages.map((message, index) => (
        <li key={index} className="flex gap-1.5">
          <TriangleAlert
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
            aria-hidden="true"
          />
          {message}
        </li>
      ))}
    </ul>
  );
}

/** The canvas and outline marker on an entry with issues. */
export function IssueMarker({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count === 0) return null;
  const label = withCount(count, "issue");
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn("shrink-0 text-red-600", className)}
    >
      <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
    </span>
  );
}

const shortName = (item: PageItem) =>
  elementInternalDescriptor(item, { maxTextLength: 40 });

/** The issues the sidebar lists above what `target` selects on the page. */
export function selectionIssues({
  index,
  page,
  pageIndex,
  target,
}: {
  index: IssueIndex;
  page: Page;
  pageIndex: number;
  target: ResolvedTarget;
}): string[] {
  const place = (at: FormPlace) =>
    index.at({ kind: IssueTargetKind.Place, place: at });
  const ofElement = (at: number, { labelled }: { labelled: boolean }) => {
    const element = page.fields[at]!;
    const prefix = labelled ? `${shortName(element)}: ` : "";
    const own = place({ kind: PlaceKind.Element, pageIndex, index: at }).map(
      (message) => prefix + message,
    );
    if (element.kind !== "list") return own;
    return own.concat(
      element.fields.flatMap((sub, subIndex) =>
        place({ kind: PlaceKind.SubField, pageIndex, index: at, subIndex }).map(
          (message) => `${shortName(sub)}: ${message}`,
        ),
      ),
    );
  };
  switch (target.kind) {
    case CanvasTargetKind.Page:
      return place({ kind: PlaceKind.Page, pageIndex });
    case CanvasTargetKind.Element:
      return target.child?.kind === ChildKind.SubField
        ? place({
            kind: PlaceKind.SubField,
            pageIndex,
            index: target.index,
            subIndex: target.child.index,
          })
        : ofElement(target.index, { labelled: false });
    case CanvasTargetKind.Group: {
      const members = Array.from(
        { length: target.end - target.start },
        (_, offset) => ofElement(target.start + offset, { labelled: true }),
      );
      return index
        .at({ kind: IssueTargetKind.Group, pageIndex, key: target.key })
        .concat(...members);
    }
    case CanvasTargetKind.Range:
      return [];
    default:
      throw new Error(
        `unknown target: ${JSON.stringify(target satisfies never)}`,
      );
  }
}
