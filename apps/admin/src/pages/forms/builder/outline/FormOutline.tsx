import type { Page, PageItem } from "@alliance/common/forms/form-schema";
import { withCount } from "@alliance/common/plural";
import { Eye, FileText } from "lucide-react";
import { useEffect, useRef, useState, type FocusEvent } from "react";
import { groupEdges } from "../../../../lib/formGroups";
import { IssueTargetKind, type IssueIndex } from "../../../../lib/formIssues";
import type { ElementDrop, ElementSpan } from "../../../../lib/moveElements";
import { DropPosition, type ListMove } from "../../../../lib/useDragReorder";
import {
  pageSegments,
  SegmentKind,
  type VisibilityGroups,
} from "../../../../lib/visibilityGroups";
import { cn } from "../../../../ui/cn";
import { NO_ACTIONS } from "../canvas/noActions";
import {
  ElementActionsMenu,
  keepBrowserMenu,
  type ElementActions,
} from "../inspector/ElementActionsMenu";
import {
  CanvasTargetKind,
  elementTarget,
  pageTitle,
  type CanvasTarget,
  type ResolvedTarget,
} from "../selection/canvasSelection";
import {
  checkStateOf,
  inRange,
  rangeFocus,
  selectedSpan,
  toggleChecked,
  type Span,
} from "../selection/rangeSelection";
import { useRestoreFocusWithin } from "../selection/useRestoreFocusWithin";
import { DropLine } from "./DropLine";
import { containerEntries, isContainer, leafRow } from "./OutlineContents";
import { OutlineRow, type OutlineEntry } from "./OutlineRow";
import { useOutlineDrag } from "./useOutlineDrag";
import { useTreeKeys, type RowHandle } from "./useTreeKeys";

type FormOutlineProps = {
  pages: Page[];
  groups: VisibilityGroups;
  /** A display-only form lists the open page's blocks, without pages. */
  displayOnly: boolean;
  pageIndex: number;
  selected: ResolvedTarget;
  onSelect: (
    pageIndex: number,
    target: CanvasTarget,
    options?: { reveal: boolean },
  ) => void;
  /** Shift-click's selection on the open page through `clicked`, else `alone`. Null where ranges are off. */
  onExtend: ((clicked: Span, alone: CanvasTarget) => void) | null;
  /** The selection once an entry's checkbox toggles. Null where ranges are off. */
  onCheck: ((pageIndex: number, target: CanvasTarget) => void) | null;
  issues: IssueIndex;
  onMovePage: (move: ListMove) => void;
  onMoveElements: (from: ElementSpan, to: ElementDrop) => void;
  /** The selection's actions, for the context menu and Alt+arrows and Delete. */
  actions?: ElementActions | null;
  /** Pages only, as Preview lists them. */
  pagesOnly?: boolean;
};

export const selectedRow = (root: HTMLElement) =>
  root.querySelector<HTMLElement>("[data-selection-focus]") ??
  root.querySelector<HTMLElement>('[aria-current="true"]');

const CHILD_KEY = /\/(field|section|block):/;

const pageKey = (page: Page) => `page:${page.id}`;
const groupKey = (key: string) => `group:${key}`;
const elementKey = (page: Page, element: PageItem, at: number) =>
  `${pageKey(page)}/element:${element.id || `@${at}`}`;

/**
 * The form as a tree: pages, their elements, visibility groups holding their
 * members, and lists and accordions their contents. Pages and groups start
 * open, containers closed, and nothing opens or scrolls by itself when the
 * canvas selects: a closed entry holding the selection says so with a bar.
 * One tab stop; the arrows move the selection with focus.
 */
export function FormOutline({
  pages,
  groups,
  displayOnly,
  pageIndex,
  selected,
  onSelect,
  onExtend,
  onCheck,
  issues,
  onMovePage,
  onMoveElements,
  actions = null,
  pagesOnly = false,
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

  const span = selectedSpan(selected);
  const { clearOffRows, drop, forPage, forElement, forGroup } = useOutlineDrag({
    selection: span && { pageIndex, ...span },
    onMovePage,
    onMoveElements,
  });

  const elementEntry =
    (page: Page, index: number) =>
    (element: PageItem, at: number, level: number): OutlineEntry => {
      const onPage = index === pageIndex;
      const pageSelected: ResolvedTarget = onPage
        ? selected
        : { kind: CanvasTargetKind.Page };
      const target =
        onPage &&
        selected.kind === CanvasTargetKind.Element &&
        selected.index === at
          ? selected
          : null;
      const key = elementKey(page, element, at);
      const container = isContainer(element) ? element : null;
      const open = container !== null && isExpanded(key, false);
      const hidden = target?.child !== undefined && !open;
      const alone = elementTarget(element, at);
      const edges = groupEdges(page.fields, at);
      const drag = forElement({
        pageIndex: index,
        index: at,
        // A display-only outline has no page row to take drops at the page's end.
        beforeOnly: open && !(displayOnly && at === page.fields.length - 1),
      });
      const ranged = onPage && inRange(selected, at);
      return {
        key,
        band: cn(
          edges && "bg-surface-2",
          edges?.first && "rounded-t-md",
          edges?.last && "rounded-b-md",
        ),
        row: {
          ...leafRow(element),
          level,
          current: (target !== null && (!target.child || !open)) || ranged,
          selected: (target !== null && !target.child) || ranged,
          rangeFocus: onPage && rangeFocus(selected) === at,
          onSelect: (options) => onSelect(index, alone, options),
          onExtend:
            onPage && onExtend
              ? () => onExtend({ start: at, end: at + 1 }, alone)
              : undefined,
          check: onCheck
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
            : undefined,
          issues: issues.inElement(index, at),
          ...(container && {
            expanded: open,
            onToggle: () => toggle(key, false),
          }),
          containsSelection: hidden,
        },
        drag: {
          onDragStart: drag.onDragStart,
          onDragEnd: drag.onDragEnd,
          onDragOver: drag.overRow,
          ringed: false,
        },
        dropLine: drag.dropPosition,
        dragging: drag.dragging,
        children: open
          ? containerEntries({
              element: container,
              entryKey: key,
              level: level + 1,
              child: target?.child,
              selectChild: (child) => onSelect(index, { ...alone, child }),
              isExpanded,
              toggle,
            })
          : [],
      };
    };

  const pageContents = (page: Page, index: number, level: number) => {
    const entry = elementEntry(page, index);
    const onPage = index === pageIndex;
    return pageSegments(page.fields, groups).map((segment): OutlineEntry => {
      switch (segment.kind) {
        case SegmentKind.Single:
          return entry(page.fields[segment.index]!, segment.index, level);
        case SegmentKind.Group: {
          const { key, start, end } = segment;
          const entryKey = `${pageKey(page)}/${groupKey(key)}`;
          const open = isExpanded(entryKey, true);
          const group: CanvasTarget = { kind: CanvasTargetKind.Group, key };
          const drag = forGroup({ pageIndex: index, start, end });
          const groupSelected =
            onPage &&
            selected.kind === CanvasTargetKind.Group &&
            selected.key === key;
          const memberSelected =
            onPage &&
            ((selected.kind === CanvasTargetKind.Element &&
              selected.index >= start &&
              selected.index < end) ||
              (span !== null && span.start < end && span.end > start));
          return {
            key: entryKey,
            row: {
              label: `Shared visibility · ${withCount(end - start, "element")}`,
              icon: Eye,
              level,
              current: groupSelected || (memberSelected && !open),
              selected: groupSelected,
              onSelect: (options) => onSelect(index, group, options),
              onExtend:
                onPage && onExtend
                  ? () => onExtend({ start, end }, group)
                  : undefined,
              expanded: open,
              onToggle: () => toggle(entryKey, true),
              containsSelection: memberSelected && !open,
              issues: page.fields.slice(start, end).reduce(
                (count, _, offset) =>
                  count + issues.inElement(index, start + offset),
                issues.at({
                  kind: IssueTargetKind.Group,
                  pageIndex: index,
                  key,
                }).length,
              ),
            },
            drag: {
              onDragStart: drag.onDragStart,
              onDragEnd: drag.onDragEnd,
              onDragOver: drag.onDragOver,
              ringed: false,
            },
            dropLine: drag.active ? DropPosition.Before : null,
            dragging: drag.dragging,
            children: open
              ? page.fields
                  .slice(start, end)
                  .map((member, offset) =>
                    entry(member, start + offset, level + 1),
                  )
              : [],
          };
        }
        default:
          throw new Error(
            `unknown segment: ${JSON.stringify(segment satisfies never)}`,
          );
      }
    });
  };

  const pageEntry = (page: Page, index: number): OutlineEntry => {
    const key = pageKey(page);
    const empty = page.fields.length === 0;
    const open = !pagesOnly && !empty && isExpanded(key, true);
    const drag = forPage({ index, length: page.fields.length });
    const pageSelected =
      index === pageIndex && selected.kind === CanvasTargetKind.Page;
    const inside = index === pageIndex && !pageSelected && !open && !pagesOnly;
    return {
      key,
      row: {
        label: pageTitle(page),
        icon: FileText,
        level: 1,
        current: pageSelected || inside,
        selected: pageSelected,
        emphasis: index === pageIndex,
        onSelect: (options) =>
          onSelect(index, { kind: CanvasTargetKind.Page }, options),
        ...(!pagesOnly &&
          !empty && {
            expanded: open,
            onToggle: () => toggle(key, true),
          }),
        containsSelection: inside && !empty,
        issues: issues.onPage(index),
      },
      drag: {
        onDragStart: drag.onDragStart,
        onDragEnd: drag.onDragEnd,
        onDragOver: drag.overRow,
        ringed: drag.ringed,
      },
      overEntry: drag.overEntry,
      dropLine: drag.dropPosition,
      dragging: drag.dragging,
      empty:
        empty && !pagesOnly
          ? { text: "No elements", onDragOver: drag.overRow }
          : undefined,
      children: open ? pageContents(page, index, 2) : [],
    };
  };

  const currentPage = pages[pageIndex];
  const entries = displayOnly
    ? currentPage
      ? pageContents(currentPage, pageIndex, 1)
      : []
    : pages.map(pageEntry);

  const handles = new Map<string, RowHandle>();
  let currentKey: string | null = null;
  const collect = (list: OutlineEntry[]) => {
    for (const { key, row, children } of list) {
      handles.set(key, {
        select: row.onSelect,
        extend: row.onExtend,
        toggle: row.onToggle,
        expanded: row.expanded,
        current: row.current,
      });
      if (row.current && currentKey === null) currentKey = key;
      collect(children);
    }
  };
  collect(entries);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const tabKey =
    focusedKey !== null && handles.has(focusedKey)
      ? focusedKey
      : (currentKey ?? handles.keys().next().value ?? null);

  const onKeyDown = useTreeKeys({ tree: ref, handles, actions });

  const restoreFocus = useRestoreFocusWithin(ref, selectedRow);
  // A row moved to another page while focused leaves focus on the page.
  useEffect(() => {
    restoreFocus();
  });

  const renderEntry = (entry: OutlineEntry) => (
    <div
      key={entry.key}
      role="none"
      className={cn("relative", entry.dragging && "opacity-50", entry.band)}
      onDragOver={entry.overEntry}
    >
      {entry.dropLine && (
        <DropLine
          position={entry.dropLine}
          before="-top-px"
          after="-bottom-px"
        />
      )}
      <OutlineRow
        {...entry.row}
        rowKey={entry.key}
        tabStop={entry.key === tabKey}
        drag={pagesOnly ? undefined : entry.drag}
      />
      {entry.empty && (
        <p
          aria-hidden="true"
          onDragOver={entry.empty.onDragOver}
          className="py-1 pl-9 text-caption text-fg-muted"
        >
          {entry.empty.text}
        </p>
      )}
      {entry.children.map(renderEntry)}
    </div>
  );

  return (
    <ElementActionsMenu
      label={selectedLabel(selected)}
      actions={actions ?? NO_ACTIONS}
      trigger="context"
    >
      <div
        ref={ref}
        role="tree"
        aria-label="Form outline"
        aria-multiselectable={onExtend !== null}
        tabIndex={-1}
        className="p-2 outline-none"
        onKeyDown={onKeyDown}
        onFocus={(event: FocusEvent<HTMLDivElement>) => {
          const key =
            event.target instanceof HTMLElement
              ? event.target.dataset.rowKey
              : undefined;
          if (key) setFocusedKey(key);
        }}
        onContextMenu={(event) => {
          // The menu acts on the selection, so the row right-clicked becomes it.
          if (!(event.target instanceof Element)) return;
          const row = event.target.closest<HTMLElement>('[role="treeitem"]');
          const key = row?.dataset.rowKey ?? "";
          const handle = handles.get(key);
          // A list's or accordion's child keeps its actions in its settings.
          if (!handle || CHILD_KEY.test(key) || (handle.current && !actions)) {
            keepBrowserMenu(event);
            return;
          }
          if (!handle.current) handle.select({ reveal: false });
        }}
        onDragOver={clearOffRows}
        onDrop={drop}
      >
        {entries.map(renderEntry)}
      </div>
    </ElementActionsMenu>
  );
}

const selectedLabel = (selected: ResolvedTarget) =>
  selected.kind === CanvasTargetKind.Page ? "Page actions" : "Element actions";
