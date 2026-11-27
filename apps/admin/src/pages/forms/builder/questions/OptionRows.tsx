import type { ReactNode } from "react";
import { useDragReorder } from "../../../../lib/useDragReorder";
import { Checkbox } from "../../../../ui/Checkbox";
import { cn } from "../../../../ui/cn";
import { Input } from "../../../../ui/Input";
import { Radio } from "../../../../ui/Radio";
import { controlClass } from "../../../../ui/styles";
import { ItemList, ItemRow } from "../kit/ItemList";
import { DefaultKind, swapOptions, writeSection } from "./optionRules";
import { VariableTextField } from "./VariableTextField";

type Option = { label: string; value: string };

export const optionName = (option: Option, position: number) =>
  `Option ${option.label.trim() || position + 1}`;

/**
 * One section of an option list (all of it, or one category's options). Moves
 * and drags stay inside the section; `onReorder` gets the whole list.
 */
export function OptionSection<O extends Option>({
  label,
  options,
  indices,
  onReorder,
  onRemove,
  children,
}: {
  label: string;
  options: readonly O[];
  /** The slots of `options` this section shows, in order. */
  indices: readonly number[];
  onReorder: (options: O[]) => void;
  onRemove: (index: number) => void;
  /** The row's fields for the option at `index`. */
  children: (index: number) => ReactNode;
}) {
  const section = indices.map((index) => options[index]);
  const drag = useDragReorder(section, (next) =>
    onReorder(writeSection({ options, indices, section: next })),
  );
  return (
    <ItemList label={label}>
      {indices.map((index, position) => {
        const neighbour = (step: number) => {
          const other = indices[position + step];
          return other === undefined
            ? null
            : () => onReorder(swapOptions(options, index, other));
        };
        return (
          <ItemRow
            key={index}
            name={optionName(options[index], position)}
            onMoveUp={neighbour(-1)}
            onMoveDown={neighbour(1)}
            onRemove={() => onRemove(index)}
            removeLabel="Remove option"
            drag={{
              onDragStart: drag.handleDragStart(position),
              onDragEnd: drag.handleDragEnd,
              onDragOver: drag.handleDragOver(position),
              onDrop: drag.handleDrop(position),
              dropPosition:
                drag.dragOverIndex === position ? drag.dropPosition : null,
              dragging: drag.draggedIndex === position,
            }}
          >
            {children(index)}
          </ItemRow>
        );
      })}
    </ItemList>
  );
}

export function OptionLabelInput({
  value,
  onChange,
  multiline = false,
}: {
  value: string;
  onChange: (label: string) => void;
  /** Ranking labels are markdown and may run to a second line. */
  multiline?: boolean;
}) {
  return (
    <VariableTextField
      aria-label="Label"
      placeholder={multiline ? "Option label (markdown)" : "Option label"}
      multiline={multiline}
      rows={multiline ? 2 : undefined}
      value={value}
      onChange={onChange}
      className={cn(controlClass, multiline ? "resize-y py-1.5" : "h-control")}
    />
  );
}

export function OptionValueInput({
  value,
  duplicate,
  onChange,
}: {
  value: string;
  duplicate: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      aria-label="Value"
      placeholder="Value"
      aria-invalid={duplicate || undefined}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-control-sm min-w-0 flex-1 font-mono text-caption"
    />
  );
}

/** The option's "Default" mark: a radio when the default is one option, a checkbox when it is several. */
export function DefaultChoice({
  kind,
  group,
  checked,
  onChange,
}: {
  kind: DefaultKind;
  /** Ties the radios of one question together. */
  group: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const control: Record<DefaultKind, ReactNode> = {
    [DefaultKind.One]: (
      <Radio name={group} checked={checked} onChange={() => onChange(true)} />
    ),
    [DefaultKind.Many]: (
      <Checkbox
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    ),
  };
  return (
    <label className="flex shrink-0 items-center gap-1.5 text-caption">
      {control[kind]}
      Default
    </label>
  );
}
