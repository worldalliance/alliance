import {
  AWAY_RANGE_NOTE_MISSING,
  isAwayRangeNoteMissing,
  isAwayRangeNoteRequired,
} from "@alliance/common/awayRange";
import { errorMessage } from "@alliance/common/errorMessage";
import type {
  UserAdminDetailDto,
  UserAwayRangeDto,
  UserAwayRangeReason,
} from "@alliance/shared/client/types.gen";
import {
  AWAY_REASON_OPTIONS,
  AwayRangeStatus,
  awayRangeStatus,
  changedAwayRangeDays,
  formatAwayReason,
} from "@alliance/shared/lib/awayRangesFormatters";
import {
  dateToInputValue,
  todayDateInputValue,
} from "@alliance/shared/lib/dateInput";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import FormInput from "@alliance/sharedweb/ui/FormInput";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { Pencil, X } from "lucide-react";
import { useCallback, useState } from "react";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { useUserAwayRangesAdmin } from "../lib/useUserAwayRangesAdmin";

export default function UserAwayPeriodsSection({
  user,
}: {
  user: Pick<UserAdminDetailDto, "id" | "name">;
}) {
  const {
    query: awayRangesQuery,
    sortedAwayRanges,
    createAwayRange,
    updateAwayRange,
    deleteAwayRange,
  } = useUserAwayRangesAdmin(user.id);
  const [awayStartDate, setAwayStartDate] = useState("");
  const [awayEndDate, setAwayEndDate] = useState("");
  const [awayReason, setAwayReason] = useState<UserAwayRangeReason | "">("");
  const [awayNote, setAwayNote] = useState("");
  const [awayMutationError, setAwayMutationError] = useState<string | null>(
    null,
  );
  const [editingAwayRangeId, setEditingAwayRangeId] = useState<number | null>(
    null,
  );
  const [editAwayStartDate, setEditAwayStartDate] = useState("");
  const [editAwayEndDate, setEditAwayEndDate] = useState("");
  const [editAwayOpenedDays, setEditAwayOpenedDays] = useState({
    start: "",
    end: "",
  });
  const [editAwayReason, setEditAwayReason] = useState<
    UserAwayRangeReason | ""
  >("");
  const [editAwayNote, setEditAwayNote] = useState("");
  const { confirm, success } = useToast();
  const isAwayMutationPending =
    createAwayRange.isPending ||
    updateAwayRange.isPending ||
    deleteAwayRange.isPending;

  const resetAwayCreateForm = useCallback(() => {
    setAwayStartDate("");
    setAwayEndDate("");
    setAwayReason("");
    setAwayNote("");
  }, []);

  const cancelAwayEdit = useCallback(() => {
    setEditingAwayRangeId(null);
    setEditAwayStartDate("");
    setEditAwayEndDate("");
    setEditAwayReason("");
    setEditAwayNote("");
  }, []);

  const startAwayEdit = useCallback((range: UserAwayRangeDto) => {
    const opened = {
      start: dateToInputValue(range.startDate),
      end: dateToInputValue(range.endDate),
    };
    setEditingAwayRangeId(range.id);
    setEditAwayStartDate(opened.start);
    setEditAwayEndDate(opened.end);
    setEditAwayOpenedDays(opened);
    setEditAwayReason(range.reason);
    setEditAwayNote(range.note ?? "");
    setAwayMutationError(null);
  }, []);

  const handleCreateAwayRange = useCallback(async () => {
    setAwayMutationError(null);

    if (!awayStartDate || !awayEndDate || !awayReason) {
      setAwayMutationError("Choose dates and a reason.");
      return;
    }

    if (isAwayRangeNoteMissing({ reason: awayReason, note: awayNote })) {
      setAwayMutationError(AWAY_RANGE_NOTE_MISSING);
      return;
    }

    try {
      await createAwayRange.mutateAsync({
        startDay: awayStartDate,
        endDay: awayEndDate,
        reason: awayReason,
        note: awayNote.trim() || null,
      });
      resetAwayCreateForm();
      success("Away period scheduled", user.name);
    } catch (error) {
      setAwayMutationError(
        errorMessage({ error, fallback: "Could not schedule away period." }),
      );
    }
  }, [
    awayEndDate,
    awayNote,
    awayReason,
    awayStartDate,
    createAwayRange,
    resetAwayCreateForm,
    success,
    user.name,
  ]);

  const handleUpdateAwayRange = useCallback(async () => {
    if (!editingAwayRangeId) return;

    setAwayMutationError(null);

    if (!editAwayStartDate || !editAwayEndDate || !editAwayReason) {
      setAwayMutationError("Choose dates and a reason.");
      return;
    }

    if (
      isAwayRangeNoteMissing({ reason: editAwayReason, note: editAwayNote })
    ) {
      setAwayMutationError(AWAY_RANGE_NOTE_MISSING);
      return;
    }

    try {
      await updateAwayRange.mutateAsync({
        id: editingAwayRangeId,
        body: {
          ...changedAwayRangeDays({
            edited: { start: editAwayStartDate, end: editAwayEndDate },
            opened: editAwayOpenedDays,
          }),
          reason: editAwayReason,
          note: editAwayNote.trim() || null,
        },
      });
      cancelAwayEdit();
      success("Away period updated", user.name);
    } catch (error) {
      setAwayMutationError(
        errorMessage({ error, fallback: "Could not update away period." }),
      );
    }
  }, [
    cancelAwayEdit,
    editAwayEndDate,
    editAwayNote,
    editAwayOpenedDays,
    editAwayReason,
    editAwayStartDate,
    editingAwayRangeId,
    success,
    updateAwayRange,
    user.name,
  ]);

  const handleDeleteAwayRange = useCallback(
    async (range: UserAwayRangeDto) => {
      const confirmed = await confirm({
        title: "Delete away period?",
        message: `Delete ${formatAwayRange(range)} for ${user.name}?`,
      });
      if (!confirmed) return;

      setAwayMutationError(null);
      try {
        await deleteAwayRange.mutateAsync(range.id);
        if (editingAwayRangeId === range.id) {
          cancelAwayEdit();
        }
        success("Away period deleted", user.name);
      } catch (error) {
        setAwayMutationError(
          errorMessage({ error, fallback: "Could not delete away period." }),
        );
      }
    },
    [
      cancelAwayEdit,
      confirm,
      deleteAwayRange,
      editingAwayRangeId,
      success,
      user.name,
    ],
  );

  return (
    <section className="border border-zinc-200 rounded p-3">
      <h2 className="text-sm font-semibold text-zinc-700 mb-2">
        Away Periods
        {awayRangesQuery.data && ` (${sortedAwayRanges.length})`}
      </h2>
      {awayMutationError && (
        <p className="text-xs text-red-500 mb-2">{awayMutationError}</p>
      )}
      {awayRangesQuery.isError && (
        <p role="alert" className="text-xs text-red-500 mb-2">
          {adminRefusalMessage(
            awayRangesQuery.error,
            "Could not load away periods.",
          )}
        </p>
      )}
      {awayRangesQuery.isPending ? (
        <Spinner size="small" />
      ) : !awayRangesQuery.data ? null : sortedAwayRanges.length ? (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {sortedAwayRanges.map((range) => {
            const status = awayRangeStatus(range);
            return (
              <div
                key={range.id}
                className={cn(
                  "text-xs p-2 rounded",
                  AWAY_RANGE_ROW_CLASS[status],
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{formatAwayRange(range)}</span>
                  <span
                    className={cn(
                      "text-xs",
                      AWAY_RANGE_STATUS_TEXT_CLASS[status],
                    )}
                  >
                    {status}
                  </span>
                </div>
                {editingAwayRangeId === range.id ? (
                  <div className="mt-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-zinc-600">
                        <span className="block mb-1">Start</span>
                        <FormInput
                          name="editAwayStartDate"
                          type="date"
                          value={editAwayStartDate}
                          onChange={(e) => setEditAwayStartDate(e.target.value)}
                        />
                      </label>
                      <label className="text-xs text-zinc-600">
                        <span className="block mb-1">End</span>
                        <FormInput
                          name="editAwayEndDate"
                          type="date"
                          value={editAwayEndDate}
                          min={editAwayStartDate}
                          onChange={(e) => setEditAwayEndDate(e.target.value)}
                        />
                      </label>
                    </div>
                    <AwayReasonSelect
                      value={editAwayReason}
                      onChange={setEditAwayReason}
                    />
                    <FormInput
                      name="editAwayNote"
                      type="text"
                      value={editAwayNote}
                      onChange={(e) => setEditAwayNote(e.target.value)}
                      placeholder={
                        isAwayRangeNoteRequired(editAwayReason)
                          ? "Note required"
                          : "Note optional"
                      }
                    />
                    <div className="flex gap-2">
                      <Button
                        color={ButtonColor.Black}
                        size="small"
                        onClick={handleUpdateAwayRange}
                        disabled={
                          isAwayMutationPending ||
                          !editAwayStartDate ||
                          !editAwayEndDate ||
                          !editAwayReason ||
                          isAwayRangeNoteMissing({
                            reason: editAwayReason,
                            note: editAwayNote,
                          })
                        }
                      >
                        Save
                      </Button>
                      <Button
                        color={ButtonColor.White}
                        size="small"
                        onClick={cancelAwayEdit}
                        disabled={isAwayMutationPending}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-zinc-600 mt-0.5">
                      {formatAwayReason(range.reason)}
                      {range.note && ` — ${range.note}`}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="p-1 text-zinc-500 hover:text-zinc-800 disabled:opacity-50"
                        onClick={() => startAwayEdit(range)}
                        disabled={isAwayMutationPending}
                        title="Edit away period"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="p-1 text-red-500 hover:text-red-700 disabled:opacity-50"
                        onClick={() => {
                          void handleDeleteAwayRange(range);
                        }}
                        disabled={isAwayMutationPending}
                        title="Delete away period"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-zinc-500">No away periods.</p>
      )}
      <div className="mt-3 pt-3 border-t border-zinc-200 space-y-2">
        <p className="text-xs font-semibold text-zinc-700">
          Schedule time away
        </p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-zinc-600">
            <span className="block mb-1">Start</span>
            <FormInput
              name="awayStartDate"
              type="date"
              value={awayStartDate}
              min={todayDateInputValue()}
              onChange={(e) => setAwayStartDate(e.target.value)}
            />
          </label>
          <label className="text-xs text-zinc-600">
            <span className="block mb-1">End</span>
            <FormInput
              name="awayEndDate"
              type="date"
              value={awayEndDate}
              min={awayStartDate || todayDateInputValue()}
              onChange={(e) => setAwayEndDate(e.target.value)}
            />
          </label>
        </div>
        <AwayReasonSelect value={awayReason} onChange={setAwayReason} />
        <FormInput
          name="awayNote"
          type="text"
          value={awayNote}
          onChange={(e) => setAwayNote(e.target.value)}
          placeholder={
            isAwayRangeNoteRequired(awayReason)
              ? "Note required"
              : "Note optional"
          }
        />
        <Button
          color={ButtonColor.Black}
          size="small"
          onClick={handleCreateAwayRange}
          disabled={
            isAwayMutationPending ||
            !awayStartDate ||
            !awayEndDate ||
            !awayReason ||
            isAwayRangeNoteMissing({ reason: awayReason, note: awayNote })
          }
        >
          {isAwayMutationPending ? "Saving..." : "Schedule"}
        </Button>
      </div>
    </section>
  );
}

const AWAY_RANGE_ROW_CLASS = {
  [AwayRangeStatus.Current]: "bg-amber-50 border border-amber-200",
  [AwayRangeStatus.Upcoming]: "bg-blue-50 border border-blue-200",
  [AwayRangeStatus.Past]: "bg-zinc-50",
} satisfies Record<AwayRangeStatus, string>;

const AWAY_RANGE_STATUS_TEXT_CLASS = {
  [AwayRangeStatus.Current]: "text-amber-700",
  [AwayRangeStatus.Upcoming]: "text-blue-700",
  [AwayRangeStatus.Past]: "text-zinc-400",
} satisfies Record<AwayRangeStatus, string>;

function formatAwayDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatAwayRange(range: UserAwayRangeDto) {
  return `${formatAwayDate(range.startDate)} to ${formatAwayDate(
    range.endDate,
  )}`;
}

function AwayReasonSelect({
  value,
  onChange,
}: {
  value: UserAwayRangeReason | "";
  onChange: (value: UserAwayRangeReason | "") => void;
}) {
  return (
    <label className="text-xs text-zinc-600">
      <span className="block mb-1">Reason</span>
      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value as UserAwayRangeReason | "")
        }
        className="w-full text-sm border border-gray-2 text-black bg-white px-2 rounded-sm py-2 focus:outline-none focus:border-black"
      >
        <option value="">Select a reason</option>
        {AWAY_REASON_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
