import type { Page, PageItem } from "@alliance/common/forms/form-schema";
import { withCount } from "@alliance/common/plural";
import { cn } from "@alliance/shared/styles/util";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { IssueTargetKind, type IssueIndex } from "../../lib/formIssues";
import {
  pageSegments,
  SegmentKind,
  type VisibilityGroups,
} from "../../lib/visibilityGroups";
import {
  CanvasTargetKind,
  ChildKind,
  describeElement,
  elementTarget,
  pageTitle,
  targetKey,
  type CanvasTarget,
  type ResolvedChild,
  type ResolvedTarget,
} from "./canvasSelection";
import { DropLine } from "./DropLine";
import { isContainer, OutlineContents } from "./OutlineContents";
import { OutlineRow, type RowProps } from "./OutlineRow";
import {
  checkStateOf,
  inRange,
  rangeFocus,
  toggleChecked,
  type Span,
} from "./rangeSelection";
import { useListDrag, type ListDrag, type ListMove } from "./useListDrag";

const PAGES = "pages";

const pageKey = (page: Page) => `page:${page.id}`;
const groupKey = (key: string) => `group:${key}`;
const elementKey = (page: Page, index: number, child?: ResolvedChild) =>
  targetKey(page, { kind: CanvasTargetKind.Element, index, child });

/** The entries holding `child`, outermost first. */
function containersOf(page: Page, index: number, child: ResolvedChild) {
  const element = elementKey(page, index);
  switch (child.kind) {
    case ChildKind.SubField:
    case ChildKind.Section:
      return [element];
    case ChildKind.SectionBlock:
      return [
        element,
        elementKey(page, index, {
          kind: ChildKind.Section,
          section: child.section,
        }),
      ];
    default:
      throw new Error(
        `unknown child: ${JSON.stringify(child satisfies never)}`,
      );
  }
}

type FormOutlineProps = {
  pages: Page[];
  groups: VisibilityGroups;
  /** A display-only form lists the open page's blocks, without pages. */
  displayOnly: boolean;
  pageIndex: number;
  selected: ResolvedTarget;
  /** Changes with the selection, revealing its entry. */
  selectionKey: string;
  onSelect: (pageIndex: number, target: CanvasTarget) => void;
  /** Shift-click's selection on the open page through `clicked`, else `alone`. Null where ranges are off. */
  onExtend: ((clicked: Span, alone: CanvasTarget) => void) | null;
  /** The selection once an entry's checkbox toggles. Null where ranges are off. */
  onCheck: ((pageIndex: number, target: CanvasTarget) => void) | null;
  issues: IssueIndex;
  onAddPage: () => void;
  onMovePage: (move: ListMove) => void;
  onMoveElement: (pageIndex: number, move: ListMove) => void;
};

/**
 * Pages and their top-level elements, with visibility groups holding their
 * members and lists and accordions their contents. The selected page starts
 * expanded, as does every group, and the entries around a new selection
 * expand to show it.
 */
export function FormOutline({
  pages,
  groups,
  displayOnly,
  pageIndex,
  selected,
  selectionKey,
  onSelect,
  onExtend,
  onCheck,
  issues,
  onAddPage,
  onMovePage,
  onMoveElement,
}: FormOutlineProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<ReadonlyMap<string, boolean>>(
    new Map(),
  );
  const isExpanded = (key: string, byDefault: boolean) =>
    expanded.get(key) ?? byDefault;
  const toggle = (key: string, byDefault: boolean) =>
    setExpanded((current) =>
      new Map(current).set(key, !(current.get(key) ?? byDefault)),
    );

  const currentPage = pages[pageIndex];
  const selectedElements =
    selected.kind === CanvasTargetKind.Element
      ? currentPage?.fields.slice(selected.index, selected.index + 1)
      : selected.kind === CanvasTargetKind.Range
        ? currentPage?.fields.slice(selected.start, selected.end)
        : undefined;
  const revealed = [
    currentPage && pageKey(currentPage),
    ...(selectedElements ?? []).map((element) => {
      const group = element.id ? groups.get(element.id) : undefined;
      return group && groupKey(group);
    }),
  ].filter((key) => key !== undefined);
  // Unlike pages and groups, these start collapsed.
  const revealedContainers =
    currentPage && selected.kind === CanvasTargetKind.Element && selected.child
      ? containersOf(currentPage, selected.index, selected.child)
      : [];
  // Null at first, so a selection made before the outline mounts is revealed.
  const [shownKey, setShownKey] = useState<string | null>(null);
  if (shownKey !== selectionKey) {
    setShownKey(selectionKey);
    if (
      revealed.some((key) => expanded.get(key) === false) ||
      revealedContainers.some((key) => expanded.get(key) !== true)
    ) {
      setExpanded(
        new Map([
          ...[...expanded].filter(([key]) => !revealed.includes(key)),
          ...revealedContainers.map((key) => [key, true] as const),
        ]),
      );
    }
  }
  useEffect(() => {
    (
      ref.current?.querySelector("[data-selection-focus]") ??
      ref.current?.querySelector('[aria-current="true"]')
    )?.scrollIntoView({ block: "nearest" });
  }, [selectionKey]);

  const { acceptDrop, drop, dragFor } = useListDrag<string>((list, move) => {
    if (list === PAGES) {
      onMovePage(move);
    } else {
      const index = pages.findIndex((page) => pageKey(page) === list);
      if (index !== -1) onMoveElement(index, move);
    }
  });

  const renderElements = (page: Page, index: number) => {
    const onPage = index === pageIndex;
    const pageSelected: ResolvedTarget = onPage
      ? selected
      : { kind: CanvasTargetKind.Page };
    const elementEntry = (element: PageItem, at: number) => {
      const target =
        onPage &&
        selected.kind === CanvasTargetKind.Element &&
        selected.index === at
          ? selected
          : null;
      const key = elementKey(page, at);
      const container = isContainer(element) ? element : null;
      const open = container !== null && isExpanded(key, false);
      const alone = elementTarget(element, at);
      return (
        <OutlineEntry
          key={element.id || at}
          label={describeElement(element)}
          current={
            (target !== null && (!target.child || !open)) ||
            (onPage && inRange(selected, at))
          }
          rangeFocus={onPage && rangeFocus(selected) === at}
          onSelect={() => onSelect(index, alone)}
          onExtend={
            onPage && onExtend
              ? () => onExtend({ start: at, end: at + 1 }, alone)
              : undefined
          }
          check={
            onCheck
              ? {
                  state: checkStateOf({
                    fields: page.fields,
                    selected: pageSelected,
                    index: at,
                  }),
                  onToggle: () =>
                    onCheck(
                      index,
                      toggleChecked({
                        fields: page.fields,
                        selected: pageSelected,
                        index: at,
                      }),
                    ),
                }
              : undefined
          }
          drag={dragFor(pageKey(page), at)}
          issues={issues.inElement(index, at)}
          {...(container && {
            expanded: open,
            onToggle: () => toggle(key, false),
          })}
        >
          {open && (
            <OutlineContents
              element={container}
              child={target?.child}
              selectChild={(child) =>
                onSelect(index, { ...elementTarget(element, at), child })
              }
              sectionKey={(section) =>
                elementKey(page, at, { kind: ChildKind.Section, section })
              }
              isExpanded={isExpanded}
              toggle={toggle}
            />
          )}
        </OutlineEntry>
      );
    };
    return (
      <ul>
        {pageSegments(page.fields, groups).map((segment) => {
          switch (segment.kind) {
            case SegmentKind.Single:
              return elementEntry(page.fields[segment.index]!, segment.index);
            case SegmentKind.Group: {
              const { key, start, end } = segment;
              const open = isExpanded(groupKey(key), true);
              const group: CanvasTarget = { kind: CanvasTargetKind.Group, key };
              return (
                <li key={key}>
                  <OutlineRow
                    label={`Shared visibility · ${withCount(end - start, "element")}`}
                    current={
                      onPage &&
                      selected.kind === CanvasTargetKind.Group &&
                      selected.key === key
                    }
                    onSelect={() => onSelect(index, group)}
                    onExtend={
                      onPage && onExtend
                        ? () => onExtend({ start, end }, group)
                        : undefined
                    }
                    expanded={open}
                    onToggle={() => toggle(groupKey(key), true)}
                    issues={page.fields.slice(start, end).reduce(
                      (count, _, offset) =>
                        count + issues.inElement(index, start + offset),
                      issues.at({
                        kind: IssueTargetKind.Group,
                        pageIndex: index,
                        key,
                      }).length,
                    )}
                    className="text-amber-800"
                  />
                  {open && (
                    <ul className="ml-3 border-l border-dashed border-amber-300 pl-1">
                      {page.fields
                        .slice(start, end)
                        .map((member, offset) =>
                          elementEntry(member, start + offset),
                        )}
                    </ul>
                  )}
                </li>
              );
            }
            default:
              throw new Error(
                `unknown segment: ${JSON.stringify(segment satisfies never)}`,
              );
          }
        })}
      </ul>
    );
  };

  return (
    <div
      ref={ref}
      className="p-2 text-sm"
      onDragOver={acceptDrop}
      onDrop={drop}
    >
      {displayOnly ? (
        currentPage && renderElements(currentPage, pageIndex)
      ) : (
        <>
          <div className="flex items-center justify-between px-2 pb-1">
            <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Pages
            </h2>
            <button
              type="button"
              onClick={onAddPage}
              aria-label="Add page"
              title="Add page"
              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <ul>
            {pages.map((page, index) => {
              const open = isExpanded(pageKey(page), index === pageIndex);
              return (
                <OutlineEntry
                  key={page.id}
                  label={pageTitle(page)}
                  current={
                    index === pageIndex &&
                    selected.kind === CanvasTargetKind.Page
                  }
                  onSelect={() =>
                    onSelect(index, { kind: CanvasTargetKind.Page })
                  }
                  drag={dragFor(PAGES, index)}
                  expanded={open}
                  onToggle={() => toggle(pageKey(page), index === pageIndex)}
                  issues={issues.onPage(index)}
                  className="font-medium"
                >
                  {open && (
                    <div className="ml-3 pl-1">
                      {page.fields.length === 0 ? (
                        <p className="px-2 py-1 text-xs text-gray-400">
                          No elements
                        </p>
                      ) : (
                        renderElements(page, index)
                      )}
                    </div>
                  )}
                </OutlineEntry>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function OutlineEntry({
  drag,
  children,
  ...row
}: RowProps & { drag: ListDrag; children?: ReactNode }) {
  return (
    <li
      className={cn("relative", drag.dragging && "opacity-50")}
      onDragOver={drag.onDragOver}
    >
      {drag.dropPosition && (
        <DropLine
          position={drag.dropPosition}
          before="-top-px"
          after="-bottom-px"
        />
      )}
      <div draggable onDragStart={drag.onDragStart} onDragEnd={drag.onDragEnd}>
        <OutlineRow {...row} draggable />
      </div>
      {children}
    </li>
  );
}
