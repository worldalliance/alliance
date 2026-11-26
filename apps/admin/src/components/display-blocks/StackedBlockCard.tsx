import type { DisplayBlock } from "@alliance/common/forms/display-blocks";
import type { AnyField } from "@alliance/common/forms/form-schema";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { GripVertical, Settings2, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import Button, { ButtonVariant, buttonVariants } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/Popover";
import { CheckboxField } from "../../ui/templates/Form";
import { ConditionalVisibility } from "../form-fields/conditions/ConditionalVisibility";
import type { OutputBlockOption } from "../form-fields/conditions/ContextRules";
import { useTypedExpression } from "../form-fields/conditions/expressionBuffers";

type Conditions = {
  field: DisplayBlock;
  previousFields: AnyField[];
  laterFields?: AnyField[];
  outputBlocks?: OutputBlockOption[];
  onChange: (updates: { visibleIfFormula?: VisibleIfFormula }) => void;
};

/**
 * A display block's editor where no inspector holds it (output views until
 * they get their own): the fields, an options popover for conditions and
 * per-user content, and the block's own remove and drag grip.
 */
export function StackedBlockCard({
  blockId,
  onRemove,
  drag,
  isDragging,
  options,
  children,
}: {
  blockId?: string;
  onRemove: () => void;
  drag?: {
    onDragStart: (e: React.DragEvent) => void;
    onDragEnd?: (e: React.DragEvent) => void;
  };
  isDragging?: boolean;
  options: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    perUserOptions: ReactNode;
    conditions: Conditions;
  } | null;
  children: ReactNode;
}) {
  const field = options?.conditions.field;
  const expression = useTypedExpression(field ?? {});
  const [conditional, setConditional] = useState(
    () => expression.typed || field?.visibleIfFormula !== undefined,
  );
  const showConditions =
    options !== null && (conditional || field?.visibleIfFormula !== undefined);

  const toggleConditions = (checked: boolean) => {
    setConditional(checked);
    if (checked || !options) return;
    options.conditions.onChange({ visibleIfFormula: undefined });
    expression.clear();
  };

  return (
    <div
      className={cn(
        "relative flex flex-col gap-5 rounded-card border bg-surface p-card",
        isDragging ? "border-accent opacity-50" : "border-line",
      )}
    >
      <div className="flex items-center gap-2">
        {drag && (
          <span
            draggable
            onDragStart={drag.onDragStart}
            onDragEnd={drag.onDragEnd}
            title="Drag to reorder"
            className="cursor-grab text-fg-muted select-none"
          >
            <GripVertical aria-hidden="true" className="size-4" />
          </span>
        )}
        {blockId && (
          <span className="min-w-0 truncate font-mono text-xs text-fg-muted">
            {blockId}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {options && (
            <Popover open={options.open} onOpenChange={options.onOpenChange}>
              <PopoverTrigger
                aria-label="Display block options"
                className={cn(
                  "inline-flex",
                  buttonVariants({
                    variant: ButtonVariant.Ghost,
                    size: "small",
                  }),
                )}
              >
                <Settings2 aria-hidden="true" className="size-4" />
                Options
              </PopoverTrigger>
              <PopoverContent align="end" className="flex w-72 flex-col gap-3">
                <CheckboxField
                  label="Use conditional visibility"
                  checked={showConditions}
                  onChange={(event) => toggleConditions(event.target.checked)}
                />
                {options.perUserOptions && (
                  <div className="border-t border-line pt-3">
                    {options.perUserOptions}
                  </div>
                )}
              </PopoverContent>
            </Popover>
          )}
          <Button
            variant={ButtonVariant.Ghost}
            size="small"
            onClick={onRemove}
            title="Remove field"
            aria-label="Remove field"
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </div>
      {children}
      {showConditions && options && (
        <div className="border-t border-line pt-5">
          <ConditionalVisibility {...options.conditions} />
        </div>
      )}
    </div>
  );
}
