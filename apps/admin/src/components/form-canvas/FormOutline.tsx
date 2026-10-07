import type { Page, PageItem } from "@alliance/common/forms/form-schema";
import { withCount } from "@alliance/common/plural";
import { cn } from "@alliance/shared/styles/util";
import { ChevronRight, GripVertical, Plus } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  pageSegments,
  SegmentKind,
  type VisibilityGroups,
} from "../../lib/visibilityGroups";
import {
  CanvasTargetKind,
  describeElement,
  elementTarget,
  type CanvasTarget,
  type ResolvedTarget,
} from "./canvasSelection";
import { DropLine } from "./DropLine";
import { useListDrag, type ListDrag, type ListMove } from "./useListDrag";

const PAGES = "pages";

const pageKey = (page: Page) => `page:${page.id}`;
const groupKey = (key: string) => `group:${key}`;

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
  onAddPage: () => void;
  onMovePage: (move: ListMove) => void;
  onMoveElement: (pageIndex: number, move: ListMove) => void;
};

/**
 * Pages and their top-level elements, with visibility groups holding their
 * members. The selected page starts expanded, as does every group, and the
 * entries around a new selection expand to show it.
 */
export function FormOutline({
  pages,
  groups,
  displayOnly,
  pageIndex,
  selected,
  selectionKey,
  onSelect,
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
  const selectedElement =
    selected.kind === CanvasTargetKind.Element
      ? currentPage?.fields[selected.index]
      : undefined;
  const selectedGroup = selectedElement?.id
    ? groups.get(selectedElement.id)
    : undefined;
  const revealed = [
    currentPage && pageKey(currentPage),
    selectedGroup && groupKey(selectedGroup),
  ].filter((key) => key !== undefined);
  const [shownKey, setShownKey] = useState(selectionKey);
  if (shownKey !== selectionKey) {
    setShownKey(selectionKey);
    if (revealed.some((key) => expanded.get(key) === false)) {
      setExpanded(
        new Map([...expanded].filter(([key]) => !revealed.includes(key))),
      );
    }
  }
  useEffect(() => {
    ref.current
      ?.querySelector('[aria-current="true"]')
      ?.scrollIntoView({ block: "nearest" });
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
    const elementEntry = (element: PageItem, at: number) => (
      <OutlineEntry
        key={element.id || at}
        label={describeElement(element)}
        current={
          onPage &&
          selected.kind === CanvasTargetKind.Element &&
          selected.index === at
        }
        onSelect={() => onSelect(index, elementTarget(element, at))}
        drag={dragFor(pageKey(page), at)}
      />
    );
    return (
      <ul>
        {pageSegments(page.fields, groups).map((segment) => {
          switch (segment.kind) {
            case SegmentKind.Single:
              return elementEntry(page.fields[segment.index]!, segment.index);
            case SegmentKind.Group: {
              const { key, start, end } = segment;
              const open = isExpanded(groupKey(key), true);
              return (
                <li key={key}>
                  <OutlineRow
                    label={`Shared visibility · ${withCount(end - start, "element")}`}
                    current={
                      onPage &&
                      selected.kind === CanvasTargetKind.Group &&
                      selected.key === key
                    }
                    onSelect={() =>
                      onSelect(index, { kind: CanvasTargetKind.Group, key })
                    }
                    expanded={open}
                    onToggle={() => toggle(groupKey(key), true)}
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
                  label={page.title || "Untitled page"}
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
        <OutlineRow {...row} />
      </div>
      {children}
    </li>
  );
}

type RowProps = {
  label: string;
  current: boolean;
  onSelect: () => void;
  expanded?: boolean;
  onToggle?: () => void;
  className?: string;
};

function OutlineRow({
  label,
  current,
  onSelect,
  expanded,
  onToggle,
  className,
}: RowProps) {
  return (
    <div
      className={cn(
        "group/row flex items-center rounded-md",
        current ? "bg-blue-50 text-blue-700" : "hover:bg-gray-100",
      )}
    >
      <GripVertical
        className="h-3.5 w-3.5 shrink-0 cursor-grab text-gray-400 opacity-0 group-hover/row:opacity-100"
        aria-hidden="true"
      />
      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`Contents of ${label}`}
          title={expanded ? "Collapse" : "Expand"}
          className="flex h-6 w-5 shrink-0 items-center justify-center rounded text-gray-500 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              expanded && "rotate-90",
            )}
            aria-hidden="true"
          />
        </button>
      ) : (
        <span className="w-5 shrink-0" />
      )}
      <button
        type="button"
        onClick={onSelect}
        aria-current={current}
        title={label}
        className={cn(
          "min-w-0 flex-1 truncate rounded py-1 pr-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
          !current && "text-gray-700",
          className,
        )}
      >
        {label}
      </button>
    </div>
  );
}
