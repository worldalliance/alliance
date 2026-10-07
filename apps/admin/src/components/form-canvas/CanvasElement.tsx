import type { DisplayKind } from "@alliance/common/forms/display-blocks";
import {
  isQuestionField,
  type PageItem,
} from "@alliance/common/forms/form-schema";
import { cn } from "@alliance/shared/styles/util";
import { staticFieldContext } from "@alliance/shared/useFormRenderer";
import RenderDisplayBlock from "@alliance/sharedweb/forms/RenderDisplayBlock";
import RenderField from "@alliance/sharedweb/forms/RenderField";
import { GripVertical } from "lucide-react";
import type { FormEvent, MouseEvent } from "react";
import { FORM_BUILDER_PREVIEW_USER } from "../../lib/testData";
import { ConditionsIndicator } from "./ConditionsIndicator";
import { DropLine } from "./DropLine";
import { SidebarSection } from "./sidebarSections";
import type { ListDrag } from "./useListDrag";

/**
 * Blocks whose controls stay usable on the canvas, to inspect layout: an
 * accordion's sections, a video's player, an image's lightbox. Everything
 * else renders inert, so a click anywhere on it only selects it.
 */
const INTERACTIVE_ON_CANVAS: Record<DisplayKind, boolean> = {
  header: false,
  text: false,
  quote: false,
  label: false,
  divider: false,
  spacer: false,
  html: false,
  images: true,
  video: true,
  biglink: false,
  copytext: false,
  previousAnswer: false,
  userLocation: false,
  chatTranscript: false,
  accordion: true,
};

const ignoreAnswer = () => {};

/** Links inside an interactive block lead respondents away; authoring stays. */
const blockLinks = (event: MouseEvent) => {
  if (event.target instanceof Element && event.target.closest("a[href]")) {
    event.preventDefault();
  }
};

const blockSubmit = (event: FormEvent) => event.preventDefault();

export function CanvasElement({
  element,
  label,
  selected,
  onSelect,
  conditionSummary,
  drag,
}: {
  element: PageItem;
  label: string;
  selected: boolean;
  onSelect: (section: SidebarSection) => void;
  /** Null when the element shows unconditionally, or through its group. */
  conditionSummary: string | null;
  drag: ListDrag;
}) {
  const interactive =
    !isQuestionField(element) && INTERACTIVE_ON_CANVAS[element.kind];

  return (
    <div
      className={cn(
        "group/element relative -mx-3 rounded-md px-3 py-2 transition-shadow",
        selected ? "ring-2 ring-blue-500" : "hover:ring-1 hover:ring-blue-200",
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
        className="absolute inset-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      />
      <div
        className={cn("relative", !interactive && "pointer-events-none")}
        inert={!interactive}
        onClickCapture={interactive ? blockLinks : undefined}
        onSubmitCapture={interactive ? blockSubmit : undefined}
      >
        {isQuestionField(element) ? (
          <RenderField
            field={element}
            onChange={ignoreAnswer}
            disableOptionRandomization
            user={FORM_BUILDER_PREVIEW_USER}
            fieldContext={staticFieldContext}
          />
        ) : (
          <RenderDisplayBlock block={element} />
        )}
      </div>
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
        <ConditionsIndicator
          onClick={(event) => {
            event.stopPropagation();
            onSelect(SidebarSection.Conditions);
          }}
          label={`Edit conditions: shown when ${conditionSummary}`}
          title={`Shown when ${conditionSummary}`}
          className="absolute -right-2 -top-2 z-10 shadow-sm"
        />
      )}
    </div>
  );
}
