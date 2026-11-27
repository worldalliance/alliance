import type {
  DisplayBlock,
  DisplayKind,
} from "@alliance/common/forms/display-blocks";
import {
  isQuestionField,
  type AnyField,
  type FieldKind,
  type PageItem,
} from "@alliance/common/forms/form-schema";
import { headerClassName } from "@alliance/sharedweb/forms/headerStyles";
import { Pencil } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { isTextEntry } from "../../../../lib/useDraftHistory";
import { cn } from "../../../../ui/cn";
import { keepBrowserMenu } from "../inspector/ElementActionsMenu";
import { focusInPlace } from "../kit/revealInPane";
import { VariableTextField } from "../questions/VariableTextField";
import { CanvasContent, CanvasQuestion } from "./CanvasContent";

/** Question kinds whose canvas render shows their label. */
const LABEL_ON_CANVAS: Record<FieldKind, boolean> = {
  text: true,
  textarea: true,
  email: true,
  phone: true,
  number: true,
  range: true,
  checkbox: true,
  radio: true,
  select: true,
  multiselect: true,
  date: true,
  time: true,
  timezone: true,
  city: true,
  file: true,
  contract: false,
  custom: false,
  list: true,
  ranking: true,
  image: true,
  toggle: true,
  timePicker: true,
  conversation: false,
};

const editsLabelInline = (field: AnyField) => LABEL_ON_CANVAS[field.kind];

export enum TextLines {
  Single = "single",
  Multiple = "multiple",
}

const BLOCK_TEXT_LINES: Record<DisplayKind, TextLines | null> = {
  header: TextLines.Single,
  text: TextLines.Multiple,
  quote: TextLines.Multiple,
  expertMessage: TextLines.Multiple,
  label: TextLines.Single,
  divider: null,
  spacer: null,
  html: null,
  images: null,
  video: null,
  biglink: null,
  copytext: null,
  accordion: null,
  previousAnswer: null,
  userLocation: null,
  chatTranscript: null,
};

function inlineBlockText(
  block: DisplayBlock,
): { text: string; lines: TextLines } | null {
  const lines = BLOCK_TEXT_LINES[block.kind];
  return lines && "text" in block ? { text: block.text, lines } : null;
}

export type InlineEditing = {
  editing: boolean;
  start: () => void;
  /** `refocus` returns focus to the selection, as after Escape. */
  stop: (options: { refocus: boolean }) => void;
};

export const startOnEnter =
  (inline: InlineEditing) => (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    inline.start();
  };

export function EditTextButton({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label={label}
      title={`${label} (Enter)`}
      className={cn(
        "flex size-6 items-center justify-center rounded-full border border-line bg-surface text-fg-muted shadow-pop outline-none hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent",
        className,
      )}
    >
      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}

/**
 * An item's source text, for `InlineTextOverlay`. Takes focus when it
 * opens; Escape, leaving it, or Enter on a single line closes it. Without
 * `variables`, a plain single line, for text the form never interpolates.
 */
export function InlineTextEditor({
  value,
  onChange,
  lines,
  variables = true,
  label,
  onStop,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  lines: TextLines;
  variables?: boolean;
  label: string;
  onStop: InlineEditing["stop"];
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const input = ref.current?.querySelector<
      HTMLInputElement | HTMLTextAreaElement
    >("input, textarea");
    if (!input) return;
    focusInPlace(input);
    input.setSelectionRange(input.value.length, input.value.length);
  }, []);

  const multiline = lines === TextLines.Multiple;
  const inputClassName = cn(
    "w-full rounded-md border border-line-control bg-surface px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-accent",
    multiline && "resize-none",
    className,
  );
  return (
    <div
      ref={ref}
      className="relative"
      onClick={(event) => event.stopPropagation()}
      onContextMenu={keepBrowserMenu}
      onKeyDown={(event) => {
        if (event.defaultPrevented || event.nativeEvent.isComposing) return;
        const finished =
          event.key === "Escape" ||
          (event.key === "Enter" &&
            (!multiline || event.metaKey || event.ctrlKey) &&
            isTextEntry(event.target));
        if (finished) {
          event.preventDefault();
          onStop({ refocus: true });
        }
      }}
      onBlur={(event) => {
        // Switching windows blurs too; the text keeps its place for the return.
        if (!document.hasFocus()) return;
        if (event.currentTarget.contains(event.relatedTarget)) return;
        onStop({ refocus: false });
      }}
    >
      {variables ? (
        <VariableTextField
          multiline={multiline}
          minRows={multiline ? 1 : undefined}
          value={value}
          onChange={onChange}
          aria-label={label}
          className={inputClassName}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
          className={inputClassName}
        />
      )}
    </div>
  );
}

type LabelEditorProps = {
  field: AnyField;
  onChange: (label: string) => void;
  onStop: InlineEditing["stop"];
};

function InlineLabelEditor({ field, onChange, onStop }: LabelEditorProps) {
  return (
    <InlineTextEditor
      value={field.label ?? ""}
      onChange={onChange}
      lines={TextLines.Multiple}
      label="Label"
      onStop={onStop}
      className="text-fg"
    />
  );
}

/** A question's label open in place, above its input. */
function InlineQuestionEditor(props: LabelEditorProps) {
  return (
    <>
      <InlineLabelEditor {...props} />
      <CanvasContent interactive={false}>
        <CanvasQuestion field={props.field} hideLabel />
      </CanvasContent>
    </>
  );
}

export const ITEM_PENCIL = "absolute -top-3 right-2 z-10";

/** What a selected item shows while its text is open, and its pencil's name. */
export type InlineText = { editor: ReactNode; editLabel: string };

/**
 * Null for an item without text to open. A list's editor is its label alone,
 * which the list shows in place of its rendered label.
 */
export function inlineTextFor({
  item,
  onChange,
  onStop,
}: {
  item: PageItem;
  onChange: (text: string) => void;
  onStop: InlineEditing["stop"];
}): InlineText | null {
  if (isQuestionField(item)) {
    if (!editsLabelInline(item)) return null;
    const props = { field: item, onChange, onStop };
    return {
      editLabel: "Edit label",
      editor:
        item.kind === "list" ? (
          <InlineLabelEditor {...props} />
        ) : (
          <InlineQuestionEditor {...props} />
        ),
    };
  }
  const text = inlineBlockText(item);
  return text
    ? {
        editLabel: "Edit text",
        editor: (
          <InlineTextEditor
            value={text.text}
            onChange={onChange}
            lines={text.lines}
            label="Text"
            onStop={onStop}
            className={
              item.kind === "header" ? headerClassName(item) : "text-fg"
            }
          />
        ),
      }
    : null;
}
