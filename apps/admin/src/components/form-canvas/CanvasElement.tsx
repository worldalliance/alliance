import {
  isQuestionField,
  type PageItem,
} from "@alliance/common/forms/form-schema";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { resolveDisplayBlockForUser } from "@alliance/shared/formrenderer";
import RenderDisplayBlock from "@alliance/sharedweb/forms/RenderDisplayBlock";
import { GripVertical } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { AddressedWrite } from "../../lib/displayBlockById";
import { InlineTextOverlay } from "../../pages/forms/builder/canvas/InlineTextOverlay";
import { cn } from "../../ui/cn";
import { writeBlockFor } from "../display-blocks/perUserContent";
import { CanvasAccordion, CanvasList } from "./CanvasContainers";
import {
  CanvasContent,
  CanvasQuestion,
  INTERACTIVE_ON_CANVAS,
  SELECT_OVERLAY,
  selectionRing,
} from "./CanvasContent";
import type { ChildTarget, ResolvedChild } from "./canvasSelection";
import { ElementConditionsIndicator } from "./ConditionsIndicator";
import { DropLine } from "./DropLine";
import { ElementBoundary, FlaggedElement } from "./ElementBoundary";
import {
  EditTextButton,
  inlineTextFor,
  ITEM_PENCIL,
  startOnEnter,
  type InlineEditing,
} from "./InlineText";
import { IssueMarker } from "./IssueList";
import { extendableClick } from "./rangeSelection";
import { SidebarSection } from "./sidebarSections";
import type { ListDrag } from "./useListDrag";

type ContentProps = {
  element: PageItem;
  selectedChild: ResolvedChild | undefined;
  onSelectChild: (child: ChildTarget, section: SidebarSection) => void;
  summarize: (formula: VisibleIfFormula) => string;
  onUpdate: (updates: Partial<PageItem>) => void;
  /** Writes the element as the form holds it, where the form can address it. */
  updateCurrent: AddressedWrite | undefined;
  /** Null unless the selection is this element or inside it. */
  inline: InlineEditing | null;
};

function ElementContent({
  element,
  selectedChild,
  onSelectChild,
  summarize,
  onUpdate,
  updateCurrent,
  inline,
  textEditor,
}: ContentProps & {
  /** A list's label, open over its rendering. */
  textEditor: ReactNode;
}) {
  if (element.kind === "list") {
    return (
      <CanvasList
        list={element}
        selectedChild={selectedChild}
        onSelectChild={onSelectChild}
        summarize={summarize}
        onUpdate={onUpdate}
        inline={inline}
        labelEditor={textEditor}
      />
    );
  }
  if (element.kind === "accordion") {
    return (
      <CanvasAccordion
        block={element}
        selectedChild={selectedChild}
        onSelectChild={onSelectChild}
        onUpdate={onUpdate}
        updateCurrent={updateCurrent}
        inline={inline}
      />
    );
  }
  return isQuestionField(element) ? (
    <CanvasContent interactive={false}>
      <CanvasQuestion field={element} />
    </CanvasContent>
  ) : (
    <CanvasContent interactive={INTERACTIVE_ON_CANVAS[element.kind]}>
      <RenderDisplayBlock block={element} />
    </CanvasContent>
  );
}

export type ContentOverride = { userId: string; label: string };

export function CanvasElement({
  element: authored,
  label,
  selected,
  rangeFocus,
  selectedChild,
  onSelect,
  onExtend,
  onSelectChild,
  summarize,
  issueCount,
  conditionSummary,
  drag,
  onUpdate,
  updateCurrent,
  inline,
  override,
}: ContentProps & {
  label: string;
  selected: boolean;
  rangeFocus: boolean;
  onSelect: (section: SidebarSection) => void;
  /** Shift-click's selection through this element; null to select it alone. */
  onExtend: (() => void) | null;
  /** At the element or inside it. */
  issueCount: number;
  /** Null when the element shows unconditionally, or through its group. */
  conditionSummary: string | null;
  drag: ListDrag;
  /** Null for the default content. An element without per-user content ignores it. */
  override: ContentOverride | null;
}) {
  const shown =
    override && !isQuestionField(authored) && authored.manualPerUser
      ? override
      : null;
  const shownUserId = shown?.userId;
  // The boundary below resets on this object's identity, so it changes only
  // with what it resolves from.
  const element = useMemo(
    () =>
      shownUserId === undefined || isQuestionField(authored)
        ? authored
        : resolveDisplayBlockForUser(authored, shownUserId),
    [authored, shownUserId],
  );
  const [flagged, setFlagged] = useState(false);
  // A flagged element shows no content to edit in place, so its repair is
  // through the sidebar.
  const editing = selected && !flagged ? inline : null;
  const text =
    editing &&
    inlineTextFor({
      item: element,
      onChange: (next) =>
        isQuestionField(authored)
          ? onUpdate({ label: next })
          : writeBlockFor({
              block: authored,
              userId: shownUserId ?? null,
              update: () => ({ text: next }),
              updateCurrent,
              onUpdate,
            }),
      onStop: editing.stop,
    });
  return (
    <div
      className={cn(
        "relative -mx-2 rounded-md px-2 py-2",
        selectedChild && !selected
          ? "ring-1 ring-accent"
          : issueCount > 0 && !selected
            ? "ring-1 ring-danger"
            : selectionRing(selected),
        drag.dragging && "opacity-50",
      )}
      {...extendableClick({
        onSelect: () => onSelect(SidebarSection.Content),
        onExtend,
      })}
      onContextMenu={() => {
        if (!selected) onSelect(SidebarSection.Content);
      }}
      onDragOver={drag.onDragOver}
    >
      {drag.dropPosition && (
        <DropLine
          position={drag.dropPosition}
          before="-top-3.5"
          after="-bottom-3.5"
        />
      )}
      <button
        type="button"
        aria-label={`Select ${label}`}
        aria-pressed={selected}
        data-canvas-select=""
        data-selection-focus={rangeFocus || undefined}
        onKeyDown={editing && text ? startOnEnter(editing) : undefined}
        className={SELECT_OVERLAY}
      />
      <InlineTextOverlay
        editor={
          editing?.editing && text && element.kind !== "list"
            ? text.editor
            : null
        }
      >
        <ElementBoundary
          element={element}
          fallback={(message) => (
            <FlaggedElement
              message={message}
              repair="Select it to change its settings or JSON."
            />
          )}
          onFlagged={setFlagged}
        >
          {() => (
            <ElementContent
              element={element}
              selectedChild={selectedChild}
              onSelectChild={onSelectChild}
              summarize={summarize}
              onUpdate={onUpdate}
              updateCurrent={updateCurrent}
              inline={inline}
              textEditor={
                editing?.editing && text && element.kind === "list"
                  ? text.editor
                  : null
              }
            />
          )}
        </ElementBoundary>
      </InlineTextOverlay>
      {conditionSummary && (
        <ElementConditionsIndicator
          summary={conditionSummary}
          onOpen={() => onSelect(SidebarSection.Conditions)}
        />
      )}
      {editing && !editing.editing && text && (
        <EditTextButton
          label={text.editLabel}
          onClick={editing.start}
          className={ITEM_PENCIL}
        />
      )}
      <span
        draggable
        onDragStart={drag.onDragStart}
        onDragEnd={drag.onDragEnd}
        title="Drag to reorder"
        aria-hidden="true"
        className="absolute -left-7 top-2 cursor-grab rounded-sm p-0.5 text-fg-muted opacity-50 hover:bg-surface-2 hover:opacity-100 active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </span>
      {shown && (
        <span className="absolute -top-2.5 left-2 z-10 max-w-3/4 truncate rounded-sm bg-accent px-1.5 py-0.5 text-caption font-medium text-accent-fg shadow-pop">
          Editing content for {shown.label}
        </span>
      )}
      <IssueMarker count={issueCount} className="absolute -right-7 top-2.5" />
    </div>
  );
}
