import type { CreateCommunityDto } from "@alliance/shared/client/types.gen";
import { groupSettings } from "@alliance/shared/lib/copy";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Switch, TextInput, TouchableOpacity, View } from "react-native";
import { colors } from "../../lib/style/colors";
import Text, { FontWeight } from "../system/Text";

export function CreateGroupForm({
  newCommunity,
  setNewCommunity,
  requiresMaxCapacity,
  onCreate,
  creating,
  error: _error,
  setError,
  variant = "create",
  disabled = false,
  memberCountForCapacityLabel,
  headerSlot,
}: {
  newCommunity: CreateCommunityDto;
  setNewCommunity: Dispatch<SetStateAction<CreateCommunityDto>>;
  requiresMaxCapacity: boolean;
  onCreate?: () => void;
  creating?: boolean;
  error: string | null;
  setError: (e: string | null) => void;
  variant?: "create" | "settings";
  disabled?: boolean;
  memberCountForCapacityLabel?: number;
  headerSlot?: ReactNode;
}) {
  const isCreate = variant === "create";
  const wrapperClass = isCreate
    ? "mb-4 p-4 rounded-xl bg-white gap-y-4"
    : "gap-y-4";

  return (
    <View className={wrapperClass}>
      {isCreate ? (
        <Text className="text-zinc-900" weight={FontWeight.Semibold}>
          Create group
        </Text>
      ) : null}

      {headerSlot}

      <View className="gap-y-1">
        <Text className="text-sm text-zinc-700" weight={FontWeight.Medium}>
          Name
        </Text>
        <TextInput
          className="border border-zinc-300 rounded-lg px-3 py-2 text-sm bg-white text-zinc-900"
          value={newCommunity.name}
          onChangeText={(text) => {
            setError(null);
            setNewCommunity((prev) => ({ ...prev, name: text }));
          }}
          placeholder="Member-visible title"
          placeholderTextColor="#a1a1aa"
          editable={!disabled}
        />
      </View>

      <View className="gap-y-1">
        <Text className="text-sm text-zinc-700" weight={FontWeight.Medium}>
          Description
        </Text>
        <TextInput
          className="border border-zinc-300 rounded-lg px-3 py-2 text-sm bg-white text-zinc-900 min-h-[72px]"
          value={newCommunity.description}
          onChangeText={(text) => {
            setError(null);
            setNewCommunity((prev) => ({ ...prev, description: text }));
          }}
          placeholder="What is this group for?"
          placeholderTextColor="#a1a1aa"
          multiline
          textAlignVertical="top"
          editable={!disabled}
        />
      </View>

      <View className="gap-y-3 p-3 bg-white rounded-lg border border-zinc-200">
        <ToggleRow
          label={groupSettings.public.name}
          explanation={groupSettings.public.explanation}
          value={newCommunity.public}
          onValueChange={(checked) => {
            setError(null);
            setNewCommunity((prev) => ({
              ...prev,
              public: checked,
              allowMemberInvites: true,
              allowStaffAssignments: true,
            }));
          }}
          disabled={disabled}
        />
        <ToggleRow
          label={groupSettings.allowMemberInvites.name}
          explanation={groupSettings.allowMemberInvites.explanation}
          value={newCommunity.allowMemberInvites}
          onValueChange={(checked) => {
            setError(null);
            setNewCommunity((prev) => ({
              ...prev,
              allowMemberInvites: checked,
            }));
          }}
          disabled={disabled || newCommunity.public}
        />
        <ToggleRow
          label={groupSettings.allowStaffAssignments.name}
          explanation={groupSettings.allowStaffAssignments.explanation}
          value={newCommunity.allowStaffAssignments}
          onValueChange={(checked) => {
            setError(null);
            setNewCommunity((prev) => ({
              ...prev,
              allowStaffAssignments: checked,
            }));
          }}
          disabled={disabled || newCommunity.public}
        />

        {requiresMaxCapacity ? (
          <View className="gap-y-1 pt-3 border-t border-zinc-100">
            <Text className="text-sm text-zinc-700" weight={FontWeight.Medium}>
              {groupSettings.maxCapacity.name}
              {memberCountForCapacityLabel != null
                ? ` (${memberCountForCapacityLabel} members)`
                : ""}
            </Text>
            <Text className="text-xs text-zinc-500">
              {groupSettings.maxCapacity.explanation}
            </Text>
            <TextInput
              className="border border-zinc-300 rounded-lg px-3 py-2 text-sm bg-white text-zinc-900 mt-1"
              value={
                newCommunity.maxCapacity != null
                  ? String(newCommunity.maxCapacity)
                  : ""
              }
              onChangeText={(text) => {
                setError(null);
                const parsed = Number(text);
                setNewCommunity((prev) => ({
                  ...prev,
                  maxCapacity:
                    text === "" || Number.isNaN(parsed) ? null : parsed,
                }));
              }}
              keyboardType="number-pad"
              placeholderTextColor="#a1a1aa"
              placeholder="e.g. 20"
              editable={!disabled}
            />
          </View>
        ) : null}
      </View>

      {isCreate && onCreate ? (
        <TouchableOpacity
          onPress={onCreate}
          disabled={creating}
          className={`py-3 rounded-lg items-center ${creating ? "bg-zinc-300" : "bg-zinc-900"}`}
        >
          <Text className="text-sm text-white" weight={FontWeight.Semibold}>
            {creating ? "Creating…" : "Create group"}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function ToggleRow({
  label,
  explanation,
  value,
  onValueChange,
  disabled = false,
}: {
  label: string;
  explanation: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View className="flex-row items-start justify-between gap-3">
      <View className="flex-1">
        <Text
          className={`text-sm ${disabled ? "text-zinc-400" : "text-zinc-900"}`}
          weight={FontWeight.Medium}
        >
          {label}
        </Text>
        <Text className="text-xs text-zinc-500 mt-0.5">{explanation}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.switch.trackOff, true: colors.green }}
        thumbColor={colors.white}
      />
    </View>
  );
}
