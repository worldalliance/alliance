import { errorMessage } from "@alliance/common/errorMessage";
import { UserAwayRangeDto, UserAwayRangeReason } from "@alliance/shared/client";
import {
  AWAY_RANGE_REMOVAL_CONFIRMS,
  AWAY_RANGE_REMOVAL_ERRORS,
  AWAY_RANGE_REMOVAL_LABELS,
  AWAY_RANGE_REMOVAL_SESSION_EXPIRED,
  AWAY_REASON_OPTIONS,
  AwayRangeRemoval,
  awayRangeRemoval,
  AwayRangeStatus,
  awayRangeStatus,
  formatAwayReason,
} from "@alliance/shared/lib/awayRangesFormatters";
import { awayRangesDescription } from "@alliance/shared/lib/copy";
import { thrownRefusalMessage } from "@alliance/shared/lib/hey-api";
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

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const REMOVAL_CONFIRM_BUTTONS = {
  [AwayRangeRemoval.Delete]: "Delete",
  [AwayRangeRemoval.EndNow]: "End now",
} satisfies Record<AwayRangeRemoval, string>;

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

  const remove = async (range: UserAwayRangeDto, removal: AwayRangeRemoval) => {
    try {
      await deleteAwayRange.mutateAsync(range.id);
    } catch (err) {
      console.error("Error removing away range:", err);
      const fallback = AWAY_RANGE_REMOVAL_ERRORS[removal];
      Alert.alert(
        "Error",
        thrownRefusalMessage({
          error: err,
          fallback,
          sessionExpired: AWAY_RANGE_REMOVAL_SESSION_EXPIRED,
        }),
      );
    }
  };

  const handleDelete = async (range: UserAwayRangeDto) => {
    // Decided again at each press, including the confirmation's: a range's
    // start can lock while its row or this dialog is on screen. A refused
    // removal skips the dialog, and the server says why.
    const shown = awayRangeRemoval(range);
    if (!shown) {
      await remove(range, AwayRangeRemoval.Delete);
      return;
    }
    Alert.alert(
      AWAY_RANGE_REMOVAL_LABELS[shown],
      AWAY_RANGE_REMOVAL_CONFIRMS[shown],
      [
        { text: "Cancel", style: "cancel" },
        {
          text: REMOVAL_CONFIRM_BUTTONS[shown],
          style: "destructive",
          onPress: () => {
            if (awayRangeRemoval(range) !== shown) {
              void handleDelete(range);
              return;
            }
            void remove(range, shown);
          },
        },
      ],
    );
  };

  const removeControl = (range: UserAwayRangeDto) => {
    const removal = awayRangeRemoval(range);
    return (
      removal && (
        <TouchableOpacity
          onPress={() => handleDelete(range)}
          className="ml-3 p-2"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel={AWAY_RANGE_REMOVAL_LABELS[removal]}
        >
          <X size={20} color="#ef4444" />
        </TouchableOpacity>
      )
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
                awayRangeStatus(range) === AwayRangeStatus.Current
                  ? "bg-yellow-50 border-yellow-200"
                  : "bg-gray-50 border-gray-200",
              )}
            >
              <View className="flex-row justify-between items-start">
                <View className="flex-1">
                  {awayRangeStatus(range) === AwayRangeStatus.Current && (
                    <Text
                      className="text-xs text-yellow-800 mb-1"
                      weight={FontWeight.Semibold}
                    >
                      Currently away
                    </Text>
                  )}
                  {awayRangeStatus(range) === AwayRangeStatus.Upcoming && (
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
                    {formatAwayReason(range.reason)}
                    {range.note && `: ${range.note}`}
                  </Text>
                </View>
                {removeControl(range)}
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
                  ? formatAwayReason(selectedReason)
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
                See your contract above for guidelines on extenuating
                circumstances.
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
        options={AWAY_REASON_OPTIONS}
        value={selectedReason}
        onSelect={setSelectedReason}
      />
    </View>
  );
}
