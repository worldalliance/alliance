import type { PageItem } from "@alliance/common/forms/form-schema";
import { withCount } from "@alliance/common/plural";
import type { ReactNode } from "react";
import { groupRunAt, regroup } from "../../../../lib/formGroups";
import Button, { ButtonVariant } from "../../../../ui/Button";
import { InspectorGroup } from "../kit/InspectorGroup";

function GreyBoxAction({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button variant={ButtonVariant.Default} size="small" onClick={onClick}>
      {children}
    </Button>
  );
}

/**
 * Puts the selected elements, `start` up to `end`, in a grey box members see
 * around them, or takes them out.
 */
export function GreyBoxPanel({
  fields,
  start,
  end,
  onChange,
  onSelectBox,
}: {
  fields: readonly PageItem[];
  start: number;
  end: number;
  onChange: (fields: PageItem[]) => void;
  onSelectBox: (box: { start: number; end: number }) => void;
}) {
  const run = groupRunAt(fields, start);
  const exact = run !== null && run.start === start && run.end === end;
  const inside = run !== null && end <= run.end;
  const grouped = fields
    .slice(start, end)
    .some((element) => element.group !== undefined);
  const write = (group: "new" | null) =>
    onChange(regroup({ fields, start, end, group }));

  const status =
    run !== null && (exact || end - start === 1)
      ? `In a grey box with ${withCount(run.end - run.start, "element")}.`
      : grouped
        ? "Some of these elements are in a grey box."
        : "Not in a grey box.";

  return (
    <InspectorGroup title="Grey box">
      <p>{status}</p>
      <div className="flex flex-wrap gap-2">
        {exact ? (
          <GreyBoxAction onClick={() => write(null)}>
            Remove grey box
          </GreyBoxAction>
        ) : (
          !inside && (
            <GreyBoxAction onClick={() => write("new")}>
              Put in a grey box
            </GreyBoxAction>
          )
        )}
        {run !== null && !exact && end - start === 1 && (
          <GreyBoxAction onClick={() => onSelectBox(run)}>
            Select grey box
          </GreyBoxAction>
        )}
        {grouped && !exact && (
          <GreyBoxAction onClick={() => write(null)}>
            Remove from grey box
          </GreyBoxAction>
        )}
      </div>
    </InspectorGroup>
  );
}
