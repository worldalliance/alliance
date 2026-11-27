import { PlaceKind } from "@alliance/common/forms/form-conditions";
import type { Page, PageItem } from "@alliance/common/forms/form-schema";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { withCount } from "@alliance/common/plural";
import { type FlowStepPreview } from "@alliance/shared/forms/flowScreens";
import { ListOrdered, TriangleAlert } from "lucide-react";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import {
  addressedWrite,
  type BlockWriteById,
} from "../../../../lib/displayBlockById";
import { groupEdges } from "../../../../lib/formGroups";
import { IssueTargetKind, type IssueIndex } from "../../../../lib/formIssues";
import type { ListMove } from "../../../../lib/useDragReorder";
import {
  pageSegments,
  SegmentKind,
  type VisibilityGroups,
} from "../../../../lib/visibilityGroups";
import { cn } from "../../../../ui/cn";
import {
  ElementActionsMenu,
  type ElementActions,
} from "../inspector/ElementActionsMenu";
import { SidebarSection } from "../inspector/sidebarSections";
import { IssueMarker } from "../issues/IssueList";
import { focusInPlace, revealInPane } from "../kit/revealInPane";
import {
  CanvasTargetKind,
  describeElement,
  elementTarget,
  pageTitle,
  targetKey,
  type CanvasTarget,
  type ResolvedTarget,
} from "../selection/canvasSelection";
import {
  extendableClick,
  inRange,
  rangeFocus,
  type Span,
} from "../selection/rangeSelection";
import { selectionRing } from "./CanvasContent";
import { CanvasElement, type ContentOverride } from "./CanvasElement";
import { selectedOnCanvas } from "./CanvasWorkspace";
import { ConditionsIndicator } from "./ConditionsIndicator";
import {
  EditTextButton,
  InlineTextEditor,
  ITEM_PENCIL,
  startOnEnter,
  TextLines,
  type InlineEditing,
} from "./InlineText";
import { InlineTextOverlay } from "./InlineTextOverlay";
import type { InsertLoc } from "./InsertPoint";
import { NO_ACTIONS } from "./noActions";
import { useListDrag } from "./useListDrag";

type FormCanvasProps = {
  page: Page;
  groups: VisibilityGroups;
  displayOnly: boolean;
  selected: ResolvedTarget;
  onSelect: (target: CanvasTarget, section: SidebarSection) => void;
  /** Shift-click's selection through `clicked`, else `alone`. Null where ranges are off. */
  onExtend: ((clicked: Span, alone: CanvasTarget) => void) | null;
  summarize: (formula: VisibleIfFormula) => string;
  issues: IssueIndex;
  pageIndex: number;
  renderInsertPoint: (
    loc: InsertLoc,
    options?: { prominent: true },
  ) => ReactNode;
  onMove: (move: ListMove) => void;
  onUpdateElement: (index: number, updates: Partial<PageItem>) => void;
  onUpdateBlockById: BlockWriteById;
  onUpdatePage: (updates: Partial<Page>) => void;
  /** The user whose content the selected block shows. */
  override: ContentOverride | null;
  /** The task flow step this page becomes, on a task form. */
  step: FlowStepPreview | null;
  /** The selection's actions, for the context menu, Alt+arrows and Delete. */
  actions?: ElementActions | null;
};

function TaskFlowStepNote({ step }: { step: FlowStepPreview }) {
  return (
    <div className="mt-6 flex flex-col gap-1 rounded-md bg-surface-2 px-3 py-2 font-sans text-caption">
      <p className="flex items-center gap-2 text-fg-muted">
        <ListOrdered aria-hidden="true" className="size-3.5 shrink-0" />
        {step.label}
      </p>
      {step.warnings.map((warning) => (
        <p key={warning} className="flex items-start gap-2 text-warning">
          <TriangleAlert
            aria-hidden="true"
            className="mt-0.5 size-3.5 shrink-0"
          />
          {warning}
        </p>
      ))}
    </div>
  );
}

const KEYS: Record<string, keyof ElementActions> = {
  "Alt+ArrowUp": "onMoveUp",
  "Alt+ArrowDown": "onMoveDown",
  Delete: "onDelete",
  Backspace: "onDelete",
};

/** The selected page as respondents see it, with selection and editing overlays. */
export function FormCanvas({
  page,
  groups,
  displayOnly,
  selected,
  onSelect,
  onExtend,
  summarize,
  issues,
  pageIndex,
  renderInsertPoint,
  onMove,
  onUpdateElement,
  onUpdateBlockById,
  onUpdatePage,
  override,
  step,
  actions = null,
}: FormCanvasProps) {
  const fields = page.fields;
  const { acceptDrop, drop, dragFor } = useListDrag(onMove);

  const ref = useRef<HTMLDivElement>(null);
  const selectedKey = targetKey(page, selected);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  if (editingKey !== null && editingKey !== selectedKey) setEditingKey(null);
  const inline: InlineEditing = {
    editing: editingKey === selectedKey,
    start: () => setEditingKey(selectedKey),
    stop: ({ refocus }) => {
      if (!refocus) return setEditingKey(null);
      flushSync(() => setEditingKey(null));
      focusInPlace(selectedOnCanvas(ref.current));
    },
  };

  // Alt+arrows and Delete act on the selection from its focused select button.
  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target;
    if (
      !(target instanceof HTMLElement) ||
      target.dataset.canvasSelect === undefined ||
      target.getAttribute("aria-pressed") !== "true" ||
      event.metaKey ||
      event.ctrlKey
    )
      return;
    const name = `${event.altKey ? "Alt+" : ""}${event.key}`;
    const action = KEYS[name] && actions?.[KEYS[name]];
    if (typeof action !== "function") return;
    event.preventDefault();
    action();
    // A move keeps the button; bring it back into view if it left.
    requestAnimationFrame(() => {
      const pane = target.closest<HTMLElement>('[role="region"]');
      if (pane && target.isConnected) revealInPane(pane, target);
    });
  };

  // Members see a grey box as one box, so the canvas draws its members, and
  // the gaps between them, on one band.
  const greyBand = (index: number, node: ReactNode) => {
    const edges = groupEdges(fields, index);
    if (edges === null) return node;
    return (
      <div
        className={cn(
          "-mx-5 bg-member-box px-5",
          edges.first && "rounded-t-lg pt-4",
          edges.last && "rounded-b-lg pb-4",
        )}
      >
        {node}
      </div>
    );
  };
  const insertPoint = (loc: InsertLoc) => {
    const box = fields[loc.index]?.group;
    const node = renderInsertPoint(loc);
    return box !== undefined && fields[loc.index - 1]?.group === box ? (
      <div className="-mx-5 bg-member-box px-5">{node}</div>
    ) : (
      node
    );
  };

  const renderElement = (
    element: PageItem,
    index: number,
    inGroup: boolean,
  ) => {
    const target =
      selected.kind === CanvasTargetKind.Element && selected.index === index
        ? selected
        : null;
    const alone = elementTarget(element, index);
    return greyBand(
      index,
      <CanvasElement
        key={element.id || index}
        element={element}
        label={describeElement(element)}
        selected={
          (target !== null && !target.child) || inRange(selected, index)
        }
        rangeFocus={rangeFocus(selected) === index}
        selectedChild={target?.child}
        onSelect={(section) => onSelect(alone, section)}
        onExtend={
          onExtend && (() => onExtend({ start: index, end: index + 1 }, alone))
        }
        onSelectChild={(child, section) =>
          onSelect({ ...elementTarget(element, index), child }, section)
        }
        summarize={summarize}
        onUpdate={(updates) => onUpdateElement(index, updates)}
        updateCurrent={addressedWrite(element, onUpdateBlockById)}
        inline={target ? inline : null}
        override={target && !target.child ? override : null}
        issueCount={issues.inElement(pageIndex, index)}
        conditionSummary={
          !displayOnly && !inGroup && element.visibleIfFormula
            ? summarize(element.visibleIfFormula)
            : null
        }
        drag={dragFor(index)}
      />,
    );
  };

  const segments = pageSegments(fields, groups);
  const pageSelected = selected.kind === CanvasTargetKind.Page;
  const pageIssues = issues.at({
    kind: IssueTargetKind.Place,
    place: { kind: PlaceKind.Page, pageIndex },
  }).length;
  const selectPage = (section: SidebarSection) =>
    onSelect({ kind: CanvasTargetKind.Page }, section);

  return (
    <ElementActionsMenu
      label="Selection actions"
      actions={actions ?? NO_ACTIONS}
      trigger="context"
    >
      <div
        ref={ref}
        className="member-surface relative mx-auto w-full max-w-160 rounded-card border border-line bg-surface px-8 py-8"
        onDragOver={acceptDrop}
        onDrop={drop}
        onKeyDown={onKeyDown}
      >
        {!displayOnly && (
          <div
            className={cn(
              "relative -mx-2 rounded-md px-2 py-2",
              pageIssues > 0 && !pageSelected
                ? "ring-1 ring-danger"
                : selectionRing(pageSelected),
            )}
            onContextMenu={() => {
              if (!pageSelected) selectPage(SidebarSection.Content);
            }}
          >
            <InlineTextOverlay
              editor={
                pageSelected && inline.editing ? (
                  <InlineTextEditor
                    value={page.title ?? ""}
                    variables={false}
                    onChange={(title) => onUpdatePage({ title })}
                    lines={TextLines.Single}
                    label="Page title"
                    onStop={inline.stop}
                    className="text-title font-semibold text-fg"
                  />
                ) : null
              }
            >
              <button
                type="button"
                data-canvas-select=""
                onClick={() => selectPage(SidebarSection.Content)}
                onKeyDown={pageSelected ? startOnEnter(inline) : undefined}
                aria-label={`Page settings: ${pageTitle(page)}`}
                aria-pressed={pageSelected}
                className="block w-full rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span
                  className={cn(
                    "block text-title font-semibold",
                    page.title ? "text-fg" : "text-fg-muted",
                  )}
                >
                  {pageTitle(page)}
                </span>
                {page.description && (
                  <span className="mt-1 block text-fg-muted">
                    {page.description}
                  </span>
                )}
              </button>
            </InlineTextOverlay>
            {page.visibleIfFormula && (
              <ConditionsIndicator
                onClick={() => selectPage(SidebarSection.Conditions)}
                label={`Edit page conditions: shown when ${summarize(page.visibleIfFormula)}`}
                summary={summarize(page.visibleIfFormula)}
                className="-ml-2 mt-1"
              />
            )}
            {pageSelected && !inline.editing && (
              <EditTextButton
                label="Edit page title"
                onClick={inline.start}
                className={ITEM_PENCIL}
              />
            )}
            <IssueMarker
              count={pageIssues}
              className="absolute -right-7 top-2.5"
            />
          </div>
        )}
        {fields.length === 0 && (
          <p className="py-8 text-center font-sans text-fg-muted">
            {displayOnly
              ? "This update is empty. Add some content to get started."
              : "This page is empty. Add a question or some content to get started."}
          </p>
        )}
        {segments.map((segment) => {
          switch (segment.kind) {
            case SegmentKind.Single: {
              const element = fields[segment.index]!;
              return (
                <div key={element.id || segment.index}>
                  {insertPoint({ groupKey: null, index: segment.index })}
                  {renderElement(element, segment.index, false)}
                </div>
              );
            }
            case SegmentKind.Group: {
              const { key, start, end } = segment;
              const group: CanvasTarget = {
                kind: CanvasTargetKind.Group,
                key,
              };
              const formula = fields[start]?.visibleIfFormula;
              const groupSelected =
                selected.kind === CanvasTargetKind.Group &&
                selected.key === key;
              const errors = issues.at({
                kind: IssueTargetKind.Group,
                pageIndex,
                key,
              }).length;
              return (
                <div key={key}>
                  {insertPoint({ groupKey: null, index: start })}
                  <section
                    aria-label="Visibility group"
                    className={cn(
                      "-mx-3 rounded-md border border-dashed border-line-strong px-3 pb-2",
                      groupSelected && "ring-2 ring-accent",
                    )}
                    onContextMenu={(event) => {
                      if (event.target !== event.currentTarget) return;
                      if (!groupSelected)
                        onSelect(group, SidebarSection.Conditions);
                    }}
                  >
                    <button
                      type="button"
                      data-canvas-select=""
                      {...extendableClick({
                        onSelect: () =>
                          onSelect(group, SidebarSection.Conditions),
                        onExtend:
                          onExtend && (() => onExtend({ start, end }, group)),
                      })}
                      onContextMenu={() => {
                        if (!groupSelected)
                          onSelect(group, SidebarSection.Conditions);
                      }}
                      aria-pressed={groupSelected}
                      className="block w-full rounded-md py-2 text-left font-sans outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <span className="block text-caption font-medium text-fg-muted">
                        Shared visibility · {withCount(end - start, "element")}
                      </span>
                      {formula && (
                        <span className="block break-words text-fg">
                          Shown when {summarize(formula)}
                        </span>
                      )}
                      {errors > 0 && (
                        <span className="mt-1 flex items-center gap-1 text-caption font-medium text-danger">
                          <TriangleAlert
                            aria-hidden="true"
                            className="size-3.5"
                          />
                          Shared rule has {withCount(errors, "issue")}
                        </span>
                      )}
                    </button>
                    {fields.slice(start, end).map((member, offset) => {
                      const index = start + offset;
                      return (
                        <div key={member.id || index}>
                          {offset > 0 && insertPoint({ groupKey: key, index })}
                          {renderElement(member, index, true)}
                        </div>
                      );
                    })}
                    {insertPoint({ groupKey: key, index: end })}
                  </section>
                </div>
              );
            }
            default:
              throw new Error(
                `unknown segment: ${JSON.stringify(segment satisfies never)}`,
              );
          }
        })}
        {renderInsertPoint(
          { groupKey: null, index: fields.length },
          { prominent: true },
        )}
        {step && <TaskFlowStepNote step={step} />}
      </div>
    </ElementActionsMenu>
  );
}
