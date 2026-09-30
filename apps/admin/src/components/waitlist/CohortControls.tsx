import {
  waitlistAdminCreateCohortAdmin,
  waitlistAdminDeleteCohortAdmin,
  waitlistAdminUpdateCohortAdmin,
} from "@alliance/shared/client";
import type {
  WaitlistCohortDto,
  WaitlistEntryFilterDto,
} from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookmarkPlus, RotateCcw, Save, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { useRefusalToast } from "../../lib/useRefusalToast";
import { waitlistCohortsQuery } from "../../lib/waitlistAdminQueries";
import { compactFilter, sameFilter } from "../../lib/waitlistFilter";
import ConfirmDialog from "../ConfirmDialog";
import InlineNameForm from "./InlineNameForm";

const ICON_BUTTON_CLASS =
  "rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800";

type CohortControlsProps = {
  cohorts: WaitlistCohortDto[];
  filter: WaitlistEntryFilterDto;
  onApply: (filter: WaitlistEntryFilterDto) => void;
};

const CohortControls: React.FC<CohortControlsProps> = ({
  cohorts,
  filter,
  onApply,
}) => {
  const queryClient = useQueryClient();
  const refusalToast = useRefusalToast();
  const { success } = useToast();
  const [cohortId, setCohortId] = useState<number | null>(null);
  const [naming, setNaming] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const cohort = cohorts.find((c) => c.id === cohortId) ?? null;
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.waitlistCohortsAdmin(),
    });

  const create = useMutation({
    mutationFn: (name: string) =>
      waitlistAdminCreateCohortAdmin({
        body: { name, filter },
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: (created) => {
      queryClient.setQueryData(waitlistCohortsQuery.queryKey, (old = []) => [
        ...old,
        created,
      ]);
      setNaming(false);
      setCohortId(created.id);
      success(`Saved cohort “${created.name}”`);
    },
    onError: (err) => refusalToast(err, "Could not save the cohort."),
    onSettled: invalidate,
  });

  const update = useMutation({
    mutationFn: (id: number) =>
      waitlistAdminUpdateCohortAdmin({
        path: { id },
        body: { filter },
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: (updated) => {
      queryClient.setQueryData(waitlistCohortsQuery.queryKey, (old = []) =>
        old.map((c) => (c.id === updated.id ? updated : c)),
      );
      success(`Updated cohort “${updated.name}”`);
    },
    onError: (err) => refusalToast(err, "Could not update the cohort."),
    onSettled: async () => {
      setUpdating(false);
      await invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) =>
      waitlistAdminDeleteCohortAdmin({ path: { id }, throwOnError: true }),
    onSuccess: (_, id) => {
      queryClient.setQueryData(waitlistCohortsQuery.queryKey, (old = []) =>
        old.filter((c) => c.id !== id),
      );
      setCohortId(null);
    },
    onError: (err) => refusalToast(err, "Could not delete the cohort."),
    onSettled: async () => {
      setDeleting(false);
      await invalidate();
    },
  });

  if (naming) {
    return (
      <InlineNameForm
        label="Cohort name"
        placeholder="Cohort name"
        submitLabel="Save cohort"
        maxLength={100}
        disabled={create.isPending}
        onSubmit={(name) => create.mutate(name)}
        onCancel={() => setNaming(false)}
      />
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Cohort"
        className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm"
        value={cohortId ?? ""}
        onChange={(e) => {
          const chosen = cohorts.find((c) => c.id === Number(e.target.value));
          setCohortId(chosen?.id ?? null);
          if (chosen) onApply(compactFilter(chosen.filter));
        }}
      >
        <option value="">Cohort: none</option>
        {cohorts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {cohort && !sameFilter(cohort.filter, filter) && (
        <>
          <button
            type="button"
            aria-label={`Revert to cohort ${cohort.name}`}
            title={`Revert to cohort ${cohort.name}`}
            className={ICON_BUTTON_CLASS}
            onClick={() => onApply(compactFilter(cohort.filter))}
          >
            <RotateCcw size={16} />
          </button>
          <button
            type="button"
            aria-label={`Update cohort ${cohort.name} to this filter`}
            title={`Update cohort ${cohort.name} to this filter`}
            className={ICON_BUTTON_CLASS}
            onClick={() => setUpdating(true)}
          >
            <Save size={16} />
          </button>
        </>
      )}
      <button
        type="button"
        aria-label="Save filter as cohort"
        title="Save filter as cohort"
        className={ICON_BUTTON_CLASS}
        onClick={() => setNaming(true)}
      >
        <BookmarkPlus size={16} />
      </button>
      {cohort && (
        <button
          type="button"
          aria-label={`Delete cohort ${cohort.name}`}
          title={`Delete cohort ${cohort.name}`}
          className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-red-600"
          onClick={() => setDeleting(true)}
        >
          <Trash2 size={16} />
        </button>
      )}
      <ConfirmDialog
        isOpen={updating && cohort !== null}
        title={`Update cohort “${cohort?.name}”?`}
        message="This replaces its saved filter with the current one."
        onConfirm={() => cohort && update.mutate(cohort.id)}
        onCancel={() => setUpdating(false)}
        isLoading={update.isPending}
      />
      <ConfirmDialog
        isOpen={deleting && cohort !== null}
        title={`Delete cohort “${cohort?.name}”?`}
        message="This deletes the saved filter. No entry or tag changes."
        onConfirm={() => cohort && remove.mutate(cohort.id)}
        onCancel={() => setDeleting(false)}
        isLoading={remove.isPending}
      />
    </div>
  );
};

export default CohortControls;
