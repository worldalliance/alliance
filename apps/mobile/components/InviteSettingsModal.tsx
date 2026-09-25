import type { CommunityDto } from "@alliance/shared/client";
import { inviteDestination } from "@alliance/shared/lib/copy";
import {
  useInviteSettingsDraft,
  type InviteSettingsTarget,
} from "@alliance/shared/lib/inviteSettings";
import type { InviteNote } from "@alliance/shared/lib/inviteUtils";
import { cn } from "@alliance/shared/styles/util";
import { milliseconds } from "date-fns";
import { setStringAsync as setClipboardStringAsync } from "expo-clipboard";
import { Check, Trash2, Users } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Alert, ScrollView, TouchableOpacity, View } from "react-native";
import { colors } from "../lib/style/colors";
import FormModal from "./forms/FormModal";
import Button, { ButtonColor, ButtonSize } from "./system/Button";
import Input from "./system/Input";
import Text, { FontWeight } from "./system/Text";

const NOTE_CLASS: Record<InviteNote["tone"], string> = {
  info: "text-zinc-500",
  warning: "text-red-500",
};

type InviteSettingsModalProps = {
  target: InviteSettingsTarget | null;
  /** Groups the owner leads — the only ones an invite may point at. */
  leaderCommunities: CommunityDto[];
  onClose: () => void;
};

export default function InviteSettingsModal({
  target,
  leaderCommunities,
  onClose,
}: InviteSettingsModalProps) {
  return (
    <FormModal visible={!!target} onClose={onClose}>
      {target && (
        // Remounts per invite, so the draft state below starts from the one
        // being opened rather than whichever was opened first.
        <InviteSettingsForm
          key={target.url}
          target={target}
          leaderCommunities={leaderCommunities}
          onClose={onClose}
        />
      )}
    </FormModal>
  );
}

function InviteSettingsForm({
  target,
  leaderCommunities,
  onClose,
}: {
  target: InviteSettingsTarget;
  leaderCommunities: CommunityDto[];
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const {
    name,
    setName,
    destination,
    setDestination,
    nameMissing,
    dirty,
    changes,
    options,
  } = useInviteSettingsDraft({ target, leaderCommunities });

  const handleCopy = useCallback(async () => {
    try {
      await setClipboardStringAsync(target.url);
      setCopied(true);
      setTimeout(() => setCopied(false), milliseconds({ seconds: 2 }));
    } catch {
      Alert.alert("Error", "Could not copy the link to the clipboard.");
    }
  }, [target.url]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await target.onSave(changes);
      onClose();
    } catch (err) {
      setSaving(false);
      Alert.alert("Error", `Failed to save changes: ${(err as Error).message}`);
    }
  }, [target, changes, onClose]);

  // Hands off to the caller, which owns the confirmation and may need this
  // modal out of the way before it puts its own on screen.
  const handleDelete = useCallback(() => {
    void target.onDelete().then(onClose, (err: Error) => {
      Alert.alert("Error", `Failed to delete: ${err.message}`);
    });
  }, [target, onClose]);

  return (
    <View className="gap-5">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text
            className="text-lg text-zinc-900"
            weight={FontWeight.Semibold}
            numberOfLines={1}
          >
            {target.title}
          </Text>
          <Text className="text-xs text-zinc-500">{target.meta}</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={8}>
          <Text className="text-blue-600" weight={FontWeight.Medium}>
            Close
          </Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row items-center gap-2 rounded-xl bg-zinc-50 p-1.5 pl-3.5">
        <Text
          className="flex-1 font-mono text-xs text-zinc-500"
          numberOfLines={1}
        >
          {target.url}
        </Text>
        <Button
          onPress={() => void handleCopy()}
          color={copied ? ButtonColor.Green : ButtonColor.White}
          size={ButtonSize.Small}
          title={copied ? "Copied!" : "Copy"}
          disabled={copied}
        />
      </View>

      <Input
        label={target.name.label}
        placeholder={target.name.placeholder}
        helperText={target.name.helper}
        value={name}
        onChangeText={setName}
        editable={!saving}
        containerClassName="gap-0"
      />

      <View className="gap-2">
        <Text className="text-sm text-zinc-900" weight={FontWeight.Semibold}>
          {inviteDestination.heading}
        </Text>
        {target.destination.notes.map((note) => (
          <Text
            key={note.text}
            className={cn("text-xs", NOTE_CLASS[note.tone])}
          >
            {note.text}
          </Text>
        ))}
        <ScrollView className="max-h-64" nestedScrollEnabled>
          <View className="gap-2">
            {options.map((option) => {
              const selected = destination === option.value;
              return (
                <TouchableOpacity
                  key={option.value ?? "open"}
                  onPress={() => setDestination(option.value)}
                  activeOpacity={0.85}
                  className={cn(
                    "flex-row items-center gap-3 rounded-xl border px-3.5 py-3",
                    selected
                      ? "border-zinc-900 bg-zinc-50"
                      : "border-zinc-200 bg-white",
                  )}
                >
                  <Users
                    size={16}
                    color={selected ? colors.text.primary : colors.text.light}
                  />
                  <View className="flex-1">
                    <Text
                      className="text-sm text-zinc-900"
                      weight={FontWeight.Medium}
                      numberOfLines={1}
                    >
                      {option.name}
                    </Text>
                    <Text className="text-xs text-zinc-500" numberOfLines={1}>
                      {option.detail}
                    </Text>
                  </View>
                  {selected && <Check size={16} color={colors.text.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <View className="flex-row items-center justify-between gap-3 border-t border-zinc-100 pt-4">
        {target.delete.enabled ? (
          <TouchableOpacity
            onPress={handleDelete}
            className="flex-row items-center gap-1.5 py-1.5"
            hitSlop={8}
          >
            <Trash2 size={15} color={colors.button.red} />
            <Text className="text-sm text-red-500" weight={FontWeight.Medium}>
              Delete
            </Text>
          </TouchableOpacity>
        ) : (
          <Text className="flex-1 text-xs text-zinc-400">
            {target.delete.disabledReason}
          </Text>
        )}
        <Button
          onPress={() => void handleSave()}
          color={ButtonColor.Black}
          size={ButtonSize.Small}
          title={saving ? "Saving…" : "Save changes"}
          disabled={!dirty || nameMissing || saving}
          loading={saving}
        />
      </View>
    </View>
  );
}
