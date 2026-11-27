import { CellAssignment } from "@alliance/common/suite-partition";
import type {
  PartitionActionDto,
  PartitionPartDraftDto,
} from "@alliance/shared/client";
import { cellOf } from "../../../components/suite-partition/partitionDrafts";
import { Select } from "../../../ui/Select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../ui/Table";
import { partName } from "./PartFields";

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

/**
 * A row per task and a column per part, in the parts' order, so a long list
 * of tasks grows down and only many parts scroll sideways.
 */
export function PartitionGrid({
  parts,
  tasks,
  onChange,
}: {
  parts: PartitionPartDraftDto[];
  tasks: PartitionActionDto[];
  onChange: (change: {
    partIndex: number;
    actionId: number;
    choice: CellAssignment;
  }) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-heading font-semibold">What each part is given</h3>
        <p className="text-fg-muted">
          A part&apos;s members are given each task as required or optional, or
          not at all.
        </p>
      </div>
      {tasks.length === 0 ? (
        <p className="text-fg-muted">
          This suite has no tasks yet. Add one to give it to parts.
        </p>
      ) : (
        <div className="max-w-full self-start overflow-x-auto rounded-md border border-line">
          <Table className="w-auto">
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                {parts.map((part, index) => (
                  <TableHead key={part.id}>
                    {index + 1}. {partName(part)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell truncate className="min-w-48 font-medium">
                    {task.name}
                  </TableCell>
                  {parts.map((part, partIndex) => (
                    <TableCell key={part.id}>
                      <Select
                        aria-label={`${task.name} for ${part.name || "unnamed part"}`}
                        className="h-control-sm w-36"
                        value={cellOf(part, task.id)}
                        onChange={(event) =>
                          onChange({
                            partIndex,
                            actionId: task.id,
                            choice: choiceOf(event.target.value),
                          })
                        }
                      >
                        {Object.entries(CHOICE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
