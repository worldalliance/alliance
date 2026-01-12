import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { X, ChevronDown } from "lucide-react-native";
import {
  UserAwayRangeDto,
  UserAwayRangeReason,
  userCreateAwayRange,
  userDeleteAwayRange,
  userGetAwayRanges,
} from "@alliance/shared/client";
import Button, { ButtonColor } from "./system/Button";
import { awayRangesDescription } from "@alliance/shared/lib/copy";

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

function getTodayDateString(): string {
  const today = new Date();
  return today.toISOString().split("T")[0];
}

export default function AwayRangesSection() {
  const [awayRanges, setAwayRanges] = useState<UserAwayRangeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [startDateInput, setStartDateInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [selectedReason, setSelectedReason] =
    useState<UserAwayRangeReason | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reasonModalOpen, setReasonModalOpen] = useState(false);

  const loadAwayRanges = useCallback(async () => {
    try {
      const response = await userGetAwayRanges();
      if (response.data) {
        setAwayRanges(response.data);
      }
    } catch (err) {
      console.error("Error loading away ranges:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAwayRanges();
  }, [loadAwayRanges]);

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

    setCreating(true);
    try {
      const resp = await userCreateAwayRange({
        body: {
          startDay: startDateInput,
          endDay: endDateInput,
          reason: selectedReason,
          note: noteInput || undefined,
        },
      });

      if (resp.response.ok) {
        setStartDateInput("");
        setEndDateInput("");
        setSelectedReason(null);
        setNoteInput("");
        await loadAwayRanges();
      } else {
        const errorMessage =
          (resp.error as { message?: string })?.message ??
          `Error: ${resp.response.statusText}`;
        setError(errorMessage);
      }
    } catch (err) {
      console.error("Error creating away range:", err);
      setError("Failed to create away period. Please try again.");
    } finally {
      setCreating(false);
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
              await userDeleteAwayRange({ path: { id } });
              await loadAwayRanges();
            } catch (err) {
              console.error("Error deleting away range:", err);
              Alert.alert(
                "Error",
                "There was an error deleting your away period. Please try again."
              );
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View>
        <Text className="text-2xl font-semibold mb-4">Away periods</Text>
        <Text className="text-zinc-500">Loading...</Text>
      </View>
    );
  }

  const inputClasses =
    "border border-zinc-300 rounded-lg bg-white px-3 py-3 text-base";

  return (
    <View>
      <Text className="text-2xl font-semibold mb-2">Away periods</Text>
      <Text className="text-sm text-zinc-600 mb-4">
        {awayRangesDescription}
      </Text>

      {awayRanges.length > 0 && (
        <View className="mb-4 gap-2">
          {awayRanges.map((range) => (
            <View
              key={range.id}
              className={`p-4 rounded-lg border ${
                isCurrentlyAway(range)
                  ? "bg-yellow-50 border-yellow-200"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <View className="flex-row justify-between items-start">
                <View className="flex-1">
                  {isCurrentlyAway(range) && (
                    <Text className="text-xs font-semibold text-yellow-800 mb-1">
                      Currently away
                    </Text>
                  )}
                  {isFutureRange(range) && (
                    <Text className="text-xs font-semibold text-green-700 mb-1">
                      Scheduled
                    </Text>
                  )}
                  <Text className="font-medium text-zinc-900">
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
        <Text className="font-medium mb-3">Schedule time away</Text>

        <View className="gap-3">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-sm font-medium mb-1">Start date</Text>
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
              <Text className="text-sm font-medium mb-1">End date</Text>
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
            <Text className="text-sm font-medium mb-1">Reason</Text>
            <TouchableOpacity
              className={`${inputClasses} flex-row items-center justify-between`}
              onPress={() => setReasonModalOpen(true)}
              activeOpacity={0.8}
            >
              <Text
                className={`text-base ${
                  selectedReason ? "text-zinc-900" : "text-zinc-400"
                }`}
              >
                {selectedReason
                  ? reasonDisplayName(selectedReason)
                  : "Select a reason"}
              </Text>
              <ChevronDown size={18} color="#52525b" />
            </TouchableOpacity>
          </View>

          <View>
            <Text className="text-sm font-medium mb-1">
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

      <Modal
        visible={reasonModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setReasonModalOpen(false)}
      >
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-2xl p-4">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-lg font-semibold text-zinc-900">
                Select Reason
              </Text>
              <TouchableOpacity onPress={() => setReasonModalOpen(false)}>
                <Text className="text-blue-600 font-medium">Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {REASON_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  className="py-3 flex-row items-center"
                  onPress={() => {
                    setSelectedReason(option.value);
                    setReasonModalOpen(false);
                  }}
                >
                  <View
                    className={`w-5 h-5 rounded-full border mr-3 items-center justify-center ${
                      selectedReason === option.value
                        ? "border-green-600"
                        : "border-zinc-300"
                    }`}
                  >
                    {selectedReason === option.value && (
                      <View className="w-2.5 h-2.5 rounded-full bg-green-600" />
                    )}
                  </View>
                  <Text className="text-base text-zinc-800">
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
