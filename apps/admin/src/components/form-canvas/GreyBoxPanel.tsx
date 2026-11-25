import type { PageItem } from "@alliance/common/forms/form-schema";
import { withCount } from "@alliance/common/plural";
import { Group, SquareDashed, Ungroup } from "lucide-react";
import { useId } from "react";
import { groupRunAt, regroup } from "../../lib/formGroups";
import { SettingsAction } from "./SettingsActions";

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

  const headingId = useId();

  const status =
    run !== null && (exact || end - start === 1)
      ? `In a grey box with ${withCount(run.end - run.start, "element")}.`
      : grouped
        ? "Some of these elements are in a grey box."
        : "Not in a grey box.";

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-2 border-t border-gray-200 pt-3"
    >
      <h3 id={headingId} className="text-sm font-medium text-gray-800">
        Grey box
      </h3>
      <p className="text-sm text-gray-700">{status}</p>
      <div className="flex flex-wrap gap-2">
        {exact ? (
          <SettingsAction Icon={Ungroup} onClick={() => write(null)}>
            Remove grey box
          </SettingsAction>
        ) : (
          !inside && (
            <SettingsAction Icon={Group} onClick={() => write("new")}>
              Put in a grey box
            </SettingsAction>
          )
        )}
        {run !== null && !exact && end - start === 1 && (
          <SettingsAction Icon={SquareDashed} onClick={() => onSelectBox(run)}>
            Select grey box
          </SettingsAction>
        )}
        {grouped && !exact && (
          <SettingsAction Icon={Ungroup} onClick={() => write(null)}>
            Remove from grey box
          </SettingsAction>
        )}
      </div>
    </section>
  );
}
