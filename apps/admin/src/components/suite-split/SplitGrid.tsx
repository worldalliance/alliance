import { CellAssignment } from "@alliance/common/suite-split";
import type {
  SplitActionDto,
  SplitGroupDraftDto,
} from "@alliance/shared/client";
import React from "react";
import { cellOf } from "./splitDrafts";

const CHOICE_LABELS: Record<CellAssignment, string> = {
  [CellAssignment.Required]: "Required",
  [CellAssignment.Optional]: "Optional",
  [CellAssignment.NotAssigned]: "Not assigned",
};

function choiceOf(value: string): CellAssignment {
  const choice = Object.values(CellAssignment).find((c) => c === value);
  if (choice === undefined) throw new Error(`unknown cell choice: ${value}`);
  return choice;
}

const SplitGrid: React.FC<{
  groups: SplitGroupDraftDto[];
  actions: SplitActionDto[];
  onChange: (
    groupIndex: number,
    actionId: number,
    choice: CellAssignment,
  ) => void;
}> = ({ groups, actions, onChange }) => {
  if (actions.length === 0) {
    return (
      <p className="text-sm text-zinc-600">
        This suite has no actions yet. Add one to assign it to groups.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="text-sm border-collapse">
        <caption className="text-left font-semibold pb-2">
          What each group is given
        </caption>
        <thead>
          <tr>
            <th scope="col" className="text-left p-2 border-b">
              Group
            </th>
            {actions.map((action) => (
              <th
                key={action.id}
                scope="col"
                className="text-left p-2 border-b"
              >
                {action.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group, groupIndex) => (
            <tr key={group.id}>
              <th scope="row" className="text-left p-2 border-b font-medium">
                {group.name || "Unnamed group"}
              </th>
              {actions.map((action) => (
                <td key={action.id} className="p-2 border-b">
                  <select
                    aria-label={`${action.name} for ${group.name || "unnamed group"}`}
                    className="border border-zinc-300 rounded px-2 py-1"
                    value={cellOf(group, action.id)}
                    onChange={(event) =>
                      onChange(
                        groupIndex,
                        action.id,
                        choiceOf(event.target.value),
                      )
                    }
                  >
                    {Object.entries(CHOICE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SplitGrid;
