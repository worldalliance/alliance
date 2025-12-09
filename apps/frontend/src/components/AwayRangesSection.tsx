import {
  UserAwayRangeDto,
  UserAwayRangeReason,
  userCreateAwayRange,
  userDeleteAwayRange,
  userGetAwayRanges,
} from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import DropdownSelect from "@alliance/shared/ui/DropdownSelect";
import FormInput from "@alliance/shared/ui/FormInput";
import { X } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { href, Link } from "react-router";

// {[DisplayName]: Reason enum}
const REASON_DROPDOWN_OPTIONS = {
  "Select a reason": null,
  Vacation: "vacation",
  Emergency: "emergency",
  Other: "other",
} satisfies Record<string, UserAwayRangeReason | null>;

const REASON_DISPLAY_NAMES = Object.fromEntries(
  Object.entries(REASON_DROPDOWN_OPTIONS)
    .filter((reason) => reason)
    .map(([displayName, reason]) => [reason, displayName])
) as Record<UserAwayRangeReason, string>;

const AwayRangesSection: React.FC = () => {
  const [awayRanges, setAwayRanges] = useState<UserAwayRangeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [startDateInput, setStartDateInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [noteInput, setNoteInput] = useState("");

  const [selectedReason, setSelectedReason] =
    useState<keyof typeof REASON_DROPDOWN_OPTIONS>("Select a reason");
  const selectedReasonIsOther = selectedReason === "Other";

  const loadAwayRanges = useCallback(async () => {
    try {
      const response = await userGetAwayRanges();
      if (response.data) {
        setAwayRanges(response.data);
      }
    } catch (error) {
      console.error("Error loading away ranges:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAwayRanges();
  }, [loadAwayRanges]);

  const handleCreate = async () => {
    if (!startDateInput || !endDateInput) {
      alert("Please select both start and end dates.");
      return;
    }
    const startDate = new Date(startDateInput);
    const endDate = new Date(endDateInput);

    const maxDuration = 14 * 24 * 60 * 60 * 1000;
    if (endDate.getTime() - startDate.getTime() > maxDuration) {
      alert(
        "Away period cannot exceed 14 days. Please email us if you need to be away for longer."
      );
      return;
    }

    const reason = REASON_DROPDOWN_OPTIONS[selectedReason];
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
      setSelectedReason("Select a reason");
      setNoteInput("");
    }
    setCreating(false);
    await loadAwayRanges();
  };

  const handleDelete = async (id: number) => {
    try {
      await userDeleteAwayRange({ path: { id } });
      await loadAwayRanges();
    } catch (error) {
      console.error("Error deleting away range:", error);
      alert("There was an error deleting your away period. Please try again.");
    }
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
      <p className="text-sm text-zinc-600 mb-4">
        You can schedule a period of time when you won&apos;t be able to
        complete Alliance actions. This will let the office know not to expect
        you to complete tasks while you&apos;re away.
      </p>

      {awayRanges.length > 0 && (
        <div className="mb-4 space-y-2">
          {awayRanges.map((range) => (
            <div
              key={range.id}
              className={`p-4 rounded-lg border ${
                isCurrentlyAway(range)
                  ? "bg-yellow-50 border-yellow-200"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
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
                    {new Date(range.startDate).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                    {" → "}
                    {new Date(range.endDate).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <p className="text-sm mt-1">
                    {REASON_DISPLAY_NAMES[range.reason]}
                    {range.note && ": " + range.note}
                  </p>
                </div>
                <Button
                  onClick={() => handleDelete(range.id)}
                  color={ButtonColor.Red}
                  className="ml-4 !py-0 !px-1 text-sm !bg-transparent"
                >
                  <X size="20" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <p className="font-medium mb-1">Schedule time away</p>
        <p className="text-sm text-zinc-500 mb-3">
          If you need to be away for longer than 14 days, please{" "}
          <a
            href="mailto:contact@worldalliance.org"
            className="text-green hover:underline"
          >
            email us
          </a>{" "}
          or reach out to your group lead.
        </p>
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
              options={Object.keys(REASON_DROPDOWN_OPTIONS)}
              value={selectedReason}
              onChange={(reason) =>
                setSelectedReason(
                  reason as keyof typeof REASON_DROPDOWN_OPTIONS
                )
              }
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
                  className={"text-green hover:underline"}
                >
                  contract
                </Link>{" "}
                for guidelines on extenuating circumstances.
              </p>
            )}
          </div>
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
        </div>
      </div>
    </div>
  );
};

export default AwayRangesSection;
