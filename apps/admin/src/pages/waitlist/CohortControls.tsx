import type {
  WaitlistCohortDto,
  WaitlistEntryFilterDto,
} from "@alliance/shared/client/types.gen";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import {
  useCreateWaitlistCohortAdmin,
  useDeleteWaitlistCohortAdmin,
  useUpdateWaitlistCohortAdmin,
} from "../../lib/useWaitlistCohortsAdmin";
import { compactFilter, sameFilter } from "../../lib/waitlistFilter";
import { cn } from "../../ui/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/DropdownMenu";
import { Select } from "../../ui/Select";
import { useToast } from "../../ui/ToastProvider";
import { menuTriggerClass } from "./MultiSelectMenu";
import { NameDialog } from "./NameDialog";

/**
 * Saved filters: apply one, save the current filter as one, and revert,
 * update or delete the one applied.
 */
export function CohortControls({
  cohorts,
  cohortId,
  filter,
  onApply,
  onFailure,
}: {
  cohorts: WaitlistCohortDto[] | undefined;
  cohortId: number | null;
  filter: WaitlistEntryFilterDto;
  /** A cohort chosen, or none (null), with the filter to apply, if any. */
  onApply: (cohortId: number | null, filter?: WaitlistEntryFilterDto) => void;
  onFailure: (message: string) => void;
}) {
  const { success } = useToast();
  const confirm = useConfirmOnPage();
  const [naming, setNaming] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const cohort = cohorts?.find((c) => c.id === cohortId) ?? null;
  const edited = cohort !== null && !sameFilter(cohort.filter, filter);

  const create = useCreateWaitlistCohortAdmin({
    onSuccess: (created) => {
      setNaming(false);
      onApply(created.id);
      success(`Saved cohort “${created.name}”`);
    },
    onError: (err) =>
      setRefusal(adminRefusalMessage(err, "Couldn't save the cohort.")),
  });
  const update = useUpdateWaitlistCohortAdmin({
    onSuccess: (updated) => success(`Updated cohort “${updated.name}”`),
    onError: (err) =>
      onFailure(adminRefusalMessage(err, "Couldn't update the cohort.")),
    onSettled: () => {},
  });
  const remove = useDeleteWaitlistCohortAdmin({
    onSuccess: () => onApply(null),
    onError: (err) =>
      onFailure(adminRefusalMessage(err, "Couldn't delete the cohort.")),
    onSettled: () => {},
  });

  const confirmUpdate = async (target: WaitlistCohortDto) => {
    const ok = await confirm({
      title: `Update the cohort “${target.name}”?`,
      message: "This replaces its saved filter with the current one.",
      confirmLabel: "Update cohort",
    });
    if (ok) update.mutate({ id: target.id, filter });
  };
  const confirmDelete = async (target: WaitlistCohortDto) => {
    const ok = await confirm({
      title: `Delete the cohort “${target.name}”?`,
      message: "This deletes the saved filter. No entry or tag changes.",
      confirmLabel: "Delete cohort",
      destructive: true,
    });
    if (ok) remove.mutate(target.id);
  };

  return (
    <>
      <Select
        aria-label="Cohort"
        className="h-control-sm w-44"
        value={cohort ? String(cohort.id) : ""}
        disabled={!cohorts}
        onChange={(event) => {
          const chosen = cohorts?.find(
            (c) => c.id === Number(event.target.value),
          );
          if (chosen) onApply(chosen.id, compactFilter(chosen.filter));
          else onApply(null);
        }}
      >
        <option value="">No cohort</option>
        {cohorts?.map((c) => (
          <option key={c.id} value={c.id}>
            {c.id === cohort?.id && edited ? `${c.name} (edited)` : c.name}
          </option>
        ))}
      </Select>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Cohort actions"
          className={cn(menuTriggerClass, "aria-busy:cursor-progress")}
          aria-busy={update.isPending || remove.isPending || undefined}
        >
          Cohort
          <ChevronDown aria-hidden="true" className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-56">
          <DropdownMenuItem
            onClick={() => {
              setRefusal(null);
              setNaming(true);
            }}
          >
            Save filter as cohort…
          </DropdownMenuItem>
          {cohort && edited && (
            <>
              <DropdownMenuItem
                onClick={() => onApply(cohort.id, compactFilter(cohort.filter))}
              >
                Revert to the saved filter
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void confirmUpdate(cohort)}>
                Update cohort to this filter…
              </DropdownMenuItem>
            </>
          )}
          {cohort && (
            <DropdownMenuItem onClick={() => void confirmDelete(cohort)}>
              Delete cohort…
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {naming && (
        <NameDialog
          title="Save filter as cohort"
          label="Cohort name"
          description="Saves the current filters under a name, to apply again later. It changes no entry."
          submitLabel="Save cohort"
          busy={create.isPending}
          error={refusal}
          onSubmit={(name) => create.mutate({ name, filter })}
          onClose={() => setNaming(false)}
        />
      )}
    </>
  );
}
