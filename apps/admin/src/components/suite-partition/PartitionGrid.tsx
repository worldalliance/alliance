import { CellAssignment } from "@alliance/common/suite-partition";
import type {
  PartitionActionDto,
  PartitionPartDraftDto,
} from "@alliance/shared/client";
import React from "react";
import { cellOf } from "./partitionDrafts";

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

const PartitionGrid: React.FC<{
  parts: PartitionPartDraftDto[];
  actions: PartitionActionDto[];
  onChange: (
    partIndex: number,
    actionId: number,
    choice: CellAssignment,
  ) => void;
}> = ({ parts, actions, onChange }) => {
  if (actions.length === 0) {
    return (
      <p className="text-sm text-zinc-600">
        This suite has no actions yet. Add one to assign it to parts.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="text-sm border-collapse">
        <caption className="text-left font-semibold pb-2">
          What each part is given
        </caption>
        <thead>
          <tr>
            <th scope="col" className="text-left p-2 border-b">
              Part
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
          {parts.map((part, partIndex) => (
            <tr key={part.id}>
              <th scope="row" className="text-left p-2 border-b font-medium">
                {part.name || "Unnamed part"}
              </th>
              {actions.map((action) => (
                <td key={action.id} className="p-2 border-b">
                  <select
                    aria-label={`${action.name} for ${part.name || "unnamed part"}`}
                    className="border border-zinc-300 rounded px-2 py-1"
                    value={cellOf(part, action.id)}
                    onChange={(event) =>
                      onChange(
                        partIndex,
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

export default PartitionGrid;
