import {
  isQuestionField,
  type PageItem,
} from "@alliance/common/forms/form-schema";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { cn } from "@alliance/shared/styles/util";
import RenderDisplayBlock from "@alliance/sharedweb/forms/RenderDisplayBlock";
import { GripVertical } from "lucide-react";
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
import { SidebarSection } from "./sidebarSections";
import type { ListDrag } from "./useListDrag";

function ElementContent({
  element,
  selectedChild,
  onSelectChild,
  summarize,
}: {
  element: PageItem;
  selectedChild: ResolvedChild | undefined;
  onSelectChild: (child: ChildTarget, section: SidebarSection) => void;
  summarize: (formula: VisibleIfFormula) => string;
}) {
  if (element.kind === "list") {
    return (
      <CanvasList
        list={element}
        selectedChild={selectedChild}
        onSelectChild={onSelectChild}
        summarize={summarize}
      />
    );
  }
  if (element.kind === "accordion") {
    return (
      <CanvasAccordion
        block={element}
        selectedChild={selectedChild}
        onSelectChild={onSelectChild}
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
}: {
  element: PageItem;
  label: string;
  selected: boolean;
  selectedChild: ResolvedChild | undefined;
  onSelect: (section: SidebarSection) => void;
  onSelectChild: (child: ChildTarget, section: SidebarSection) => void;
  summarize: (formula: VisibleIfFormula) => string;
  /** Null when the element shows unconditionally, or through its group. */
  conditionSummary: string | null;
  drag: ListDrag;
}) {
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
        className={SELECT_OVERLAY}
      />
      <ElementContent
        element={element}
        selectedChild={selectedChild}
        onSelectChild={onSelectChild}
        summarize={summarize}
      />
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
