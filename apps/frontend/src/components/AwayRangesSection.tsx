import {
  UserAwayRangeDto,
  userAwayranges,
  userAwayrangesCreate,
  userAwayrangesDelete,
} from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import FormInput from "@alliance/shared/ui/FormInput";
import React, { useCallback, useEffect, useState } from "react";

const AwayRangesSection: React.FC = () => {
  const [awayRanges, setAwayRanges] = useState<UserAwayRangeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [startDateInput, setStartDateInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [noteInput, setNoteInput] = useState("");

  const loadAwayRanges = useCallback(async () => {
    try {
      const response = await userAwayranges();
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
    const now = new Date();

    if (startDate < now) {
      alert("Start date must be in the future.");
      return;
    }

    if (endDate <= startDate) {
      alert("End date must be after start date.");
      return;
    }

    const maxDuration = 14 * 24 * 60 * 60 * 1000;
    if (endDate.getTime() - startDate.getTime() > maxDuration) {
      alert("Away period cannot exceed 14 days. Please email us if you need to be away for longer.");
      return;
    }

    setCreating(true);
    try {
      await userAwayrangesCreate({
        body: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          note: noteInput || undefined,
        },
      });
      setStartDateInput("");
      setEndDateInput("");
      setNoteInput("");
      await loadAwayRanges();
    } catch (error) {
      console.error("Error creating away range:", error);
      alert("There was an error creating your away period. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this away period?")) {
      return;
    }

    try {
      await userAwayrangesDelete({ path: { id } });
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
        <h2 className="!font-semibold text-lg mb-4">Away Periods</h2>
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="!font-semibold text-lg mb-2">Away Periods</h2>
      <p className="text-sm text-zinc-600 mb-4">
        Schedule periods when you'll be away. During these times, you won't receive new tasks,
        notifications, or be counted in action participation. Maximum 14 days per period.
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
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  {isCurrentlyAway(range) && (
                    <p className="text-xs font-semibold text-yellow-800 mb-1">CURRENTLY AWAY</p>
                  )}
                  {isFutureRange(range) && (
                    <p className="text-xs font-semibold text-blue-800 mb-1">SCHEDULED</p>
                  )}
                  <p className="font-medium">
                    {new Date(range.startDate).toLocaleDateString()} at{" "}
                    {new Date(range.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {" → "}
                    {new Date(range.endDate).toLocaleDateString()} at{" "}
                    {new Date(range.endDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {range.note && <p className="text-sm text-gray-600 mt-1">{range.note}</p>}
                </div>
                <Button
                  onClick={() => handleDelete(range.id)}
                  color={ButtonColor.Red}
                  className="ml-4 px-3 py-1 text-sm"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <p className="font-medium mb-3">Schedule new away period</p>
        <div className="space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Start Date & Time</label>
              <FormInput
                name="startDate"
                type="datetime-local"
                value={startDateInput}
                onChange={(e) => setStartDateInput(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">End Date & Time</label>
              <FormInput
                name="endDate"
                type="datetime-local"
                value={endDateInput}
                onChange={(e) => setEndDateInput(e.target.value)}
                min={startDateInput || new Date().toISOString().slice(0, 16)}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Note (optional)</label>
            <FormInput
              name="note"
              type="text"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="e.g., Vacation, conference, etc."
            />
          </div>
          <Button
            onClick={handleCreate}
            color={ButtonColor.Black}
            disabled={creating || !startDateInput || !endDateInput}
            className="w-full md:w-auto"
          >
            {creating ? "Creating..." : "Add Away Period"}
          </Button>
          <p className="text-xs text-zinc-500 mt-2">
            Need to be away for longer than 14 days? Please email us.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AwayRangesSection;
