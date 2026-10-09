import {
  isQuestionField,
  type PageItem,
} from "@alliance/common/forms/form-schema";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { cn } from "@alliance/shared/styles/util";
import RenderDisplayBlock from "@alliance/sharedweb/forms/RenderDisplayBlock";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";
import type { AddressedWrite } from "../../lib/displayBlockById";
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
import {
  EditTextButton,
  inlineTextFor,
  ITEM_PENCIL,
  startOnEnter,
  type InlineEditing,
} from "./InlineText";
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
  /** The element's own text, open in place of its rendering. */
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
  if (textEditor) return textEditor;
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

export function CanvasElement({
  element,
  label,
  selected,
  selectedChild,
  onSelect,
  onSelectChild,
  summarize,
  conditionSummary,
  drag,
  onUpdate,
  updateCurrent,
  inline,
}: ContentProps & {
  label: string;
  selected: boolean;
  onSelect: (section: SidebarSection) => void;
  /** Null when the element shows unconditionally, or through its group. */
  conditionSummary: string | null;
  drag: ListDrag;
}) {
  const editing = selected ? inline : null;
  const text =
    editing &&
    inlineTextFor({
      item: element,
      onChange: (next) =>
        onUpdate(isQuestionField(element) ? { label: next } : { text: next }),
      onStop: editing.stop,
    });
  return (
    <div
      className={cn(
        "group/element relative -mx-3 rounded-md px-3 py-2 transition-shadow",
        selectedChild && !selected
          ? "ring-1 ring-blue-300"
          : selectionRing(selected),
        drag.dragging && "opacity-50",
      )}
      onClick={() => onSelect(SidebarSection.Content)}
      onDragOver={drag.onDragOver}
    >
      {drag.dropPosition && (
        <DropLine
          position={drag.dropPosition}
          before="-top-3"
          after="-bottom-3"
        />
      )}
      <button
        type="button"
        aria-label={`Select ${label}`}
        aria-pressed={selected}
        onKeyDown={editing && text ? startOnEnter(editing) : undefined}
        className={SELECT_OVERLAY}
      />
      <ElementContent
        element={element}
        selectedChild={selectedChild}
        onSelectChild={onSelectChild}
        summarize={summarize}
        onUpdate={onUpdate}
        updateCurrent={updateCurrent}
        inline={inline}
        textEditor={editing?.editing && text ? text.editor : null}
      />
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
        className={cn(
          "absolute -left-6 top-2 cursor-grab rounded p-0.5 text-gray-400 opacity-0 hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing group-hover/element:opacity-100",
          selected && "opacity-100",
        )}
      >
        <GripVertical className="h-4 w-4" />
      </span>
      {conditionSummary && (
        <ElementConditionsIndicator
          summary={conditionSummary}
          onOpen={() => onSelect(SidebarSection.Conditions)}
        />
      )}
    </div>
  );
}
