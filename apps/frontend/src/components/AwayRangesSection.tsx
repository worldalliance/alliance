import {
  UserAwayRangeDto,
  UserAwayRangeReason,
  userCreateAwayRange,
  userDeleteAwayRange,
  userGetAwayRanges,
  userUpdateAwayRange,
} from "@alliance/shared/client";
import { awayRangesDescription } from "@alliance/shared/lib/copy";
import { formatLongDate } from "@alliance/shared/lib/dateFormatters";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import DropdownSelect from "@alliance/sharedweb/ui/DropdownSelect";
import FormInput from "@alliance/sharedweb/ui/FormInput";
import { Pencil, X } from "lucide-react";
import React, { useState } from "react";
import { href, Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@alliance/shared/styles/util";

enum ReasonDropdownOption {
  UNSELECTED = "Select a reason",
  VACATION = "Vacation",
  EMERGENCY = "Emergency",
  OTHER = "Other",
}

const REASON_DROPDOWN_OPTION_TO_REASON_DTO = {
  [ReasonDropdownOption.UNSELECTED]: null,
  [ReasonDropdownOption.VACATION]: "vacation" as const,
  [ReasonDropdownOption.EMERGENCY]: "emergency" as const,
  [ReasonDropdownOption.OTHER]: "other" as const,
} satisfies Record<ReasonDropdownOption, UserAwayRangeReason | null>;

function reasonDisplayName(reason: UserAwayRangeReason): string {
  switch (reason) {
    case "vacation":
      return ReasonDropdownOption.VACATION;
    case "emergency":
      return ReasonDropdownOption.EMERGENCY;
    case "other":
      return ReasonDropdownOption.OTHER;
    default:
      const x: never = reason;
      throw new Error(`Unknown reason: ${x}`);
  }
}

function reasonToDropdownOption(
  reason: UserAwayRangeReason
): ReasonDropdownOption {
  switch (reason) {
    case "vacation":
      return ReasonDropdownOption.VACATION;
    case "emergency":
      return ReasonDropdownOption.EMERGENCY;
    case "other":
      return ReasonDropdownOption.OTHER;
    default:
      const x: never = reason;
      throw new Error(`Unknown reason: ${x}`);
  }
}

function formatDateForInput(date: Date | string): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const AwayRangesSection: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: awayRanges = [], isLoading: loading } = useQuery({
    queryKey: ["userGetAwayRanges"],
    queryFn: () => userGetAwayRanges().then((res) => res.data ?? []),
  });

  const [creating, setCreating] = useState(false);
  const [startDateInput, setStartDateInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [selectedReason, setSelectedReason] = useState<ReasonDropdownOption>(
    ReasonDropdownOption.UNSELECTED
  );
  const selectedReasonIsOther = selectedReason === "Other";

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editReason, setEditReason] = useState<ReasonDropdownOption>(
    ReasonDropdownOption.UNSELECTED
  );
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const editReasonIsOther = editReason === "Other";

  const handleCreate = async () => {
    setError(null);
    if (!startDateInput || !endDateInput) {
      alert("Please select both start and end dates.");
      return;
    }
    // const startDate = new Date(startDateInput);
    // const endDate = new Date(endDateInput);

    // const maxDuration = 14 * 24 * 60 * 60 * 1000;
    // if (endDate.getTime() - startDate.getTime() > maxDuration) {
    //   alert(
    //     "Away period cannot exceed 14 days. Please email us if you need to be away for longer."
    //   );
    //   return;
    // }

    const reason = REASON_DROPDOWN_OPTION_TO_REASON_DTO[selectedReason];
    if (!reason) {
      // Should not be possible, since button is disabled if no reason is selected
      alert("Select a reason for your away period.");
      return;
    }

    setCreating(true);
    const resp = await userCreateAwayRange({
      body: {
        startDay: startDateInput,
        endDay: endDateInput,
        reason,
        note: noteInput || undefined,
      },
    });
    if (resp.response.ok) {
      setStartDateInput("");
      setEndDateInput("");
      setSelectedReason(ReasonDropdownOption.UNSELECTED);
      setNoteInput("");
    } else {
      setError(
        (resp.error as { message: string }).message ??
          `Error: Could not create away range`
      );
    }
    setCreating(false);
    queryClient.invalidateQueries({ queryKey: ["userGetAwayRanges"] });
  };

  const handleDelete = async (id: number) => {
    try {
      await userDeleteAwayRange({ path: { id } });
      queryClient.invalidateQueries({ queryKey: ["userGetAwayRanges"] });
    } catch (error) {
      console.error("Error deleting away range:", error);
      alert("There was an error deleting your away period. Please try again.");
    }
  };

  const startEditing = (range: UserAwayRangeDto) => {
    setEditingId(range.id);
    setEditStartDate(formatDateForInput(range.startDate));
    setEditEndDate(formatDateForInput(range.endDate));
    setEditNote(range.note ?? "");
    setEditReason(reasonToDropdownOption(range.reason));
    setEditError(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditStartDate("");
    setEditEndDate("");
    setEditNote("");
    setEditReason(ReasonDropdownOption.UNSELECTED);
    setEditError(null);
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    setEditError(null);

    if (!editStartDate || !editEndDate) {
      alert("Please select both start and end dates.");
      return;
    }

    const reason = REASON_DROPDOWN_OPTION_TO_REASON_DTO[editReason];
    if (!reason) {
      alert("Select a reason for your away period.");
      return;
    }

    setUpdating(true);
    const resp = await userUpdateAwayRange({
      path: { id: editingId },
      body: {
        startDay: editStartDate,
        endDay: editEndDate,
        reason,
        note: editNote || undefined,
      },
    });
    if (resp.response.ok) {
      cancelEditing();
      queryClient.invalidateQueries({ queryKey: ["userGetAwayRanges"] });
    } else {
      setEditError(
        (resp.error as { message: string }).message ??
          `Error: ${resp.response.statusText}`
      );
    }
    setUpdating(false);
  };

  const isCurrentlyAway = (range: UserAwayRangeDto) => {
    const now = new Date();
    return new Date(range.startDate) <= now && new Date(range.endDate) >= now;
  };

  const isFutureRange = (range: UserAwayRangeDto) => {
    return new Date(range.startDate) > new Date();
  };

  if (loading) {
    return (
      <div>
        <h2 className="!font-semibold text-2xl mb-4">Away periods</h2>
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="!font-semibold text-2xl mb-2">Away periods</h2>
      <p className="text-sm text-zinc-500 mb-4">{awayRangesDescription}</p>

      {awayRanges.length > 0 && (
        <div className="mb-4 space-y-2">
          {awayRanges.map((range) => (
            <div
              key={range.id}
              className={cn(
                "p-4 rounded-lg border",
                isCurrentlyAway(range)
                  ? "bg-yellow-50 border-yellow-200"
                  : "bg-gray-50 border-gray-200"
              )}
            >
              {editingId === range.id ? (
                <div className="space-y-3">
                  <p className="font-semibold">
                    Editing your existing away period:
                  </p>
                  <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex-1">
                      <label className="block text-sm font-medium mb-1">
                        Start date
                      </label>
                      <FormInput
                        name="editStartDate"
                        type="date"
                        value={editStartDate}
                        onChange={(e) => setEditStartDate(e.target.value)}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium mb-1">
                        End date
                      </label>
                      <FormInput
                        name="editEndDate"
                        type="date"
                        value={editEndDate}
                        onChange={(e) => setEditEndDate(e.target.value)}
                        min={editStartDate}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium">Reason</label>
                    <DropdownSelect
                      options={ReasonDropdownOption}
                      value={editReason}
                      onChange={([, reason]) => setEditReason(reason)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="block text-sm font-medium">
                      Note{!editReasonIsOther && " (optional)"}
                    </label>
                    <FormInput
                      name="editNote"
                      type="text"
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      placeholder={
                        editReasonIsOther
                          ? "Please provide more details"
                          : undefined
                      }
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleUpdate}
                      color={ButtonColor.Black}
                      disabled={
                        updating ||
                        !editStartDate ||
                        !editEndDate ||
                        editReason === "Select a reason" ||
                        (editReasonIsOther && !editNote)
                      }
                    >
                      {updating ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      onClick={cancelEditing}
                      color={ButtonColor.White}
                      disabled={updating}
                    >
                      Cancel
                    </Button>
                  </div>
                  {editError && <p className="text-red-500">{editError}</p>}
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    {isCurrentlyAway(range) && (
                      <p className="text-xs font-semibold text-yellow-800 mb-1">
                        Currently away
                      </p>
                    )}
                    {isFutureRange(range) && (
                      <p className="text-xs font-semibold text-green mb-1">
                        Scheduled
                      </p>
                    )}
                    <p className="font-medium">
                      {formatLongDate(new Date(range.startDate))}
                      {" → "}
                      {formatLongDate(new Date(range.endDate))}
                    </p>
                    <p className="text-sm mt-1">
                      {reasonDisplayName(range.reason)}
                      {range.note && ": " + range.note}
                    </p>
                  </div>
                  <div className="flex gap-1 items-center">
                    <Button
                      onClick={() => startEditing(range)}
                      color={ButtonColor.Transparent}
                      className="!py-2 !px-1 text-sm text-zinc-600"
                    >
                      <Pencil size="17" />
                    </Button>
                    <Button
                      onClick={() => handleDelete(range.id)}
                      color={ButtonColor.Transparent}
                      className="!py-2 !px-1 text-sm text-red-500"
                    >
                      <X size="20" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <p className="font-medium mb-1">Schedule time away</p>
        <div className="space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">
                Start date
              </label>
              <FormInput
                name="startDate"
                type="date"
                value={startDateInput}
                onChange={(e) => setStartDateInput(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">End date</label>
              <FormInput
                name="endDate"
                type="date"
                value={endDateInput}
                onChange={(e) => setEndDateInput(e.target.value)}
                min={startDateInput || new Date().toISOString().slice(0, 16)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Reason</label>
            <DropdownSelect
              options={ReasonDropdownOption}
              value={selectedReason}
              onChange={([, reason]) => setSelectedReason(reason)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="block text-sm font-medium">
              Note{!selectedReasonIsOther && " (optional)"}
            </label>
            <FormInput
              name="note"
              type="text"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder={
                selectedReasonIsOther
                  ? "Please provide more details"
                  : undefined
              }
            />
            {selectedReasonIsOther && (
              <p className="text-sm text-zinc-500 mb-2 mt-1">
                See your{" "}
                <Link
                  to={href("/contract")}
                  target={"_blank"}
                  className="text-link"
                >
                  contract
                </Link>{" "}
                for guidelines on extenuating circumstances.
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <Button
              onClick={handleCreate}
              color={ButtonColor.Black}
              disabled={
                creating ||
                !startDateInput ||
                !endDateInput ||
                selectedReason === "Select a reason" ||
                (selectedReasonIsOther && !noteInput)
              }
              className="w-full md:w-auto"
            >
              {creating ? "Creating..." : "Schedule"}
            </Button>
            {error && <p className="text-red-500">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AwayRangesSection;
