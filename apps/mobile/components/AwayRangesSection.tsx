import { errorMessage } from "@alliance/common/errorMessage";
import { UserAwayRangeDto, UserAwayRangeReason } from "@alliance/shared/client";
import { awayRangesDescription } from "@alliance/shared/lib/copy";
import { useMyAwayRanges } from "@alliance/shared/lib/useMyAwayRanges";
import { cn } from "@alliance/shared/styles/util";
import { ChevronDown, X } from "lucide-react-native";
import { useState } from "react";
import {
  Alert,
  Platform,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { colors } from "../lib/style/colors";
import BottomSheetOptionPicker from "./BottomSheetOptionPicker";
import Button, { ButtonColor } from "./system/Button";
import Text, { FontWeight } from "./system/Text";

const REASON_OPTIONS: { value: UserAwayRangeReason; label: string }[] = [
  { value: "vacation", label: "Vacation" },
  { value: "emergency", label: "Emergency" },
  { value: "other", label: "Other" },
];

function reasonDisplayName(reason: UserAwayRangeReason): string {
  switch (reason) {
    case "vacation":
      return "Vacation";
    case "emergency":
      return "Emergency";
    case "other":
      return "Other";
    default:
      return reason;
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function isCurrentlyAway(range: UserAwayRangeDto): boolean {
  const now = new Date();
  return new Date(range.startDate) <= now && new Date(range.endDate) >= now;
}

function isFutureRange(range: UserAwayRangeDto): boolean {
  return new Date(range.startDate) > new Date();
}

export default function AwayRangesSection() {
  const {
    awayRanges,
    isPending: loading,
    createAwayRange,
    deleteAwayRange,
  } = useMyAwayRanges();
  const creating = createAwayRange.isPending;
  const [startDateInput, setStartDateInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [selectedReason, setSelectedReason] =
    useState<UserAwayRangeReason | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reasonModalOpen, setReasonModalOpen] = useState(false);

  const handleCreate = async () => {
    setError(null);

    if (!startDateInput || !endDateInput) {
      Alert.alert("Error", "Please enter both start and end dates.");
      return;
    }

    if (!selectedReason) {
      Alert.alert("Error", "Please select a reason for your away period.");
      return;
    }

    if (selectedReason === "other" && !noteInput.trim()) {
      Alert.alert("Error", "Please provide details for 'Other' reason.");
      return;
    }

    try {
      await createAwayRange.mutateAsync({
        startDay: startDateInput,
        endDay: endDateInput,
        reason: selectedReason,
        note: noteInput.trim() || null,
      });

      setStartDateInput("");
      setEndDateInput("");
      setSelectedReason(null);
      setNoteInput("");
    } catch (err) {
      console.error("Error creating away range:", err);
      setError(
        errorMessage({ error: err, fallback: "Unable to create away period." }),
      );
    }
  };

  const handleDelete = async (id: number) => {
    Alert.alert(
      "Delete Away Period",
      "Are you sure you want to delete this away period?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAwayRange.mutateAsync(id);
            } catch (err) {
              console.error("Error deleting away range:", err);
              Alert.alert(
                "Error",
                "There was an error deleting your away period. Please try again.",
              );
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View>
        <Text className="text-2xl mb-4" weight={FontWeight.Semibold}>
          Away periods
        </Text>
        <Text className="text-zinc-500">Loading...</Text>
      </View>
    );
  }

  const inputClasses =
    "border border-zinc-200 rounded-lg bg-white px-3 py-3 text-base";

  return (
    <View>
      <Text className="text-2xl mb-2" weight={FontWeight.Semibold}>
        Away periods
      </Text>
      <Text className="text-sm text-zinc-600 mb-4">
        {awayRangesDescription}
      </Text>

      {awayRanges.length > 0 && (
        <View className="mb-4 gap-2">
          {awayRanges.map((range) => (
            <View
              key={range.id}
              className={cn(
                "p-4 rounded-lg border",
                isCurrentlyAway(range)
                  ? "bg-yellow-50 border-yellow-200"
                  : "bg-gray-50 border-gray-200",
              )}
            >
              <View className="flex-row justify-between items-start">
                <View className="flex-1">
                  {isCurrentlyAway(range) && (
                    <Text
                      className="text-xs text-yellow-800 mb-1"
                      weight={FontWeight.Semibold}
                    >
                      Currently away
                    </Text>
                  )}
                  {isFutureRange(range) && (
                    <Text
                      className="text-xs text-green-700 mb-1"
                      weight={FontWeight.Semibold}
                    >
                      Scheduled
                    </Text>
                  )}
                  <Text className="text-zinc-900" weight={FontWeight.Medium}>
                    {formatDate(range.startDate)} → {formatDate(range.endDate)}
                  </Text>
                  <Text className="text-sm text-zinc-600 mt-1">
                    {reasonDisplayName(range.reason)}
                    {range.note && `: ${range.note}`}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDelete(range.id)}
                  className="ml-3 p-2"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      <View className="border border-gray-200 rounded-lg p-4 bg-gray-50">
        <Text className="mb-3" weight={FontWeight.Medium}>
          Schedule time away
        </Text>

        <View className="gap-3">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-sm mb-1" weight={FontWeight.Medium}>
                Start date
              </Text>
              <TextInput
                className={inputClasses}
                value={startDateInput}
                onChangeText={setStartDateInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9ca3af"
                keyboardType={
                  Platform.OS === "ios" ? "numbers-and-punctuation" : "default"
                }
              />
            </View>
            <View className="flex-1">
              <Text className="text-sm mb-1" weight={FontWeight.Medium}>
                End date
              </Text>
              <TextInput
                className={inputClasses}
                value={endDateInput}
                onChangeText={setEndDateInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9ca3af"
                keyboardType={
                  Platform.OS === "ios" ? "numbers-and-punctuation" : "default"
                }
              />
            </View>
          </View>

          <View>
            <Text className="text-sm mb-1" weight={FontWeight.Medium}>
              Reason
            </Text>
            <TouchableOpacity
              className={cn(
                inputClasses,
                "flex-row items-center justify-between",
              )}
              onPress={() => setReasonModalOpen(true)}
              activeOpacity={0.8}
            >
              <Text
                className={cn(
                  "text-base",
                  selectedReason ? "text-zinc-900" : "text-zinc-400",
                )}
              >
                {selectedReason
                  ? reasonDisplayName(selectedReason)
                  : "Select a reason"}
              </Text>
              <ChevronDown size={18} color={colors.text.icon} />
            </TouchableOpacity>
          </View>

          <View>
            <Text className="text-sm mb-1" weight={FontWeight.Medium}>
              Note{selectedReason !== "other" && " (optional)"}
            </Text>
            <TextInput
              className={inputClasses}
              value={noteInput}
              onChangeText={setNoteInput}
              placeholder={
                selectedReason === "other"
                  ? "Please provide more details"
                  : "Optional note"
              }
              placeholderTextColor="#9ca3af"
            />
            {selectedReason === "other" && (
              <Text className="text-sm text-zinc-500 mt-1">
                See your contract for guidelines on extenuating circumstances.
              </Text>
            )}
          </View>

          <Button
            onPress={handleCreate}
            color={ButtonColor.Black}
            disabled={
              creating ||
              !startDateInput ||
              !endDateInput ||
              !selectedReason ||
              (selectedReason === "other" && !noteInput.trim())
            }
            title={creating ? "Creating..." : "Schedule"}
          />

          {error && <Text className="text-red-500 text-sm">{error}</Text>}
        </View>
      </View>

      <BottomSheetOptionPicker
        visible={reasonModalOpen}
        onClose={() => setReasonModalOpen(false)}
        title="Select Reason"
        options={REASON_OPTIONS}
        value={selectedReason}
        onSelect={setSelectedReason}
      />
    </View>
  );
}
