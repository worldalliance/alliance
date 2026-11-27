import type {
  PartitionPartDraftDto,
  PartitionProblemDto,
} from "@alliance/shared/client";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useId, type Ref } from "react";
import FallbackSelect from "../../../components/suite-partition/FallbackSelect";
import {
  CONDITION_HINT,
  hasRequiredWork,
} from "../../../components/suite-partition/partitionDrafts";
import Button, { ButtonVariant } from "../../../ui/Button";
import { Input } from "../../../ui/Input";
import { Banner, BannerTone } from "../../../ui/templates/Banner";
import { CheckboxField, Field } from "../../../ui/templates/Form";
import { Textarea } from "../../../ui/Textarea";
import { PartitionProblems } from "./PartitionProblems";

export const partName = (part: Pick<PartitionPartDraftDto, "name">) =>
  part.name || "Unnamed part";

/** One part's name, condition, fallback and tick; "Everyone else" has only the tick. */
export function PartFields({
  part,
  position,
  isLast,
  canMoveUp,
  canMoveDown,
  problems,
  warnings,
  headingRef,
  onChange,
  onMove,
  onRemove,
}: {
  part: PartitionPartDraftDto;
  position: number;
  isLast: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  problems: PartitionProblemDto[];
  warnings: string[];
  headingRef?: Ref<HTMLHeadingElement>;
  onChange: (part: PartitionPartDraftDto) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}) {
  const headingId = useId();
  const name = partName(part);
  return (
    <li className="py-5 first:pt-0">
      <div
        role="group"
        aria-labelledby={headingId}
        className="flex flex-col gap-4"
      >
        <div className="flex min-h-control-sm items-center justify-between gap-3">
          <h3
            id={headingId}
            ref={headingRef}
            tabIndex={-1}
            className="min-w-0 truncate text-heading font-semibold"
          >
            {position}. {name}
          </h3>
          {!isLast && (
            <div className="flex shrink-0 gap-1">
              <Button
                size="small"
                variant={ButtonVariant.Ghost}
                aria-label={`Move up: ${name}`}
                aria-disabled={!canMoveUp}
                className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                onClick={() => canMoveUp && onMove(-1)}
              >
                <ArrowUp aria-hidden="true" className="size-4" />
                Move up
              </Button>
              <Button
                size="small"
                variant={ButtonVariant.Ghost}
                aria-label={`Move down: ${name}`}
                aria-disabled={!canMoveDown}
                className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                onClick={() => canMoveDown && onMove(1)}
              >
                <ArrowDown aria-hidden="true" className="size-4" />
                Move down
              </Button>
              <Button
                size="small"
                variant={ButtonVariant.Ghost}
                aria-label={`Remove: ${name}`}
                onClick={onRemove}
              >
                Remove
              </Button>
            </div>
          )}
        </div>
        {isLast ? (
          <p className="text-fg-muted">
            Members who match no part above land here.
          </p>
        ) : (
          <>
            <Field label="Name" className="max-w-md">
              {(control) => (
                <Input
                  {...control}
                  value={part.name}
                  onChange={(event) =>
                    onChange({ ...part, name: event.target.value })
                  }
                />
              )}
            </Field>
            <Field label="Condition" help={CONDITION_HINT}>
              {(control) => (
                <Textarea
                  {...control}
                  className="font-mono text-xs"
                  rows={2}
                  spellCheck={false}
                  value={part.text ?? ""}
                  onChange={(event) =>
                    onChange({ ...part, text: event.target.value })
                  }
                />
              )}
            </Field>
            <FallbackSelect
              value={part.fallback}
              onChange={(fallback) => onChange({ ...part, fallback })}
            />
          </>
        )}
        <CheckboxField
          label="This part intentionally has no required work"
          help="Only for a part given no required task."
          disabled={hasRequiredWork(part)}
          checked={part.noRequiredWorkTick}
          onChange={(event) =>
            onChange({ ...part, noRequiredWorkTick: event.target.checked })
          }
        />
        <PartitionProblems problems={problems} />
        {warnings.map((warning) => (
          <Banner key={warning} tone={BannerTone.Warning} inline>
            {warning}
          </Banner>
        ))}
      </div>
    </li>
  );
}
