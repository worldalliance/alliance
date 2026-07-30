import type { CommunityDto } from "@alliance/shared/client";
import { inviteDestination } from "@alliance/shared/lib/copy";
import type { InviteNote } from "@alliance/shared/lib/inviteUtils";
import { cn } from "@alliance/shared/styles/util";
import { setStringAsync as setClipboardStringAsync } from "expo-clipboard";
import { Check, Trash2, Users } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { Alert, ScrollView, TouchableOpacity, View } from "react-native";
import { colors } from "../lib/style/colors";
import FormModal from "./forms/FormModal";
import Button, { ButtonColor, ButtonSize } from "./system/Button";
import Input from "./system/Input";
import Text, { FontWeight } from "./system/Text";

/** A group they lead, or `null` for "wherever there is room". */
type Destination = number | null;

const NOTE_CLASS: Record<InviteNote["tone"], string> = {
  info: "text-zinc-500",
  warning: "text-red-500",
};

/**
 * Mirrors the web `InviteSettingsTarget`. The two cannot share a component —
 * that one is built on portals and DOM events — so the contract describing what
 * is being edited is what keeps them in step.
 */
export type InviteSettingsTarget = {
  /** Header line: whatever names this invite today. */
  title: string;
  /** Header sub-line: uses, age, whatever is worth knowing at a glance. */
  meta: string;
  /** The link people follow, shown and copyable. */
  url: string;
  name: {
    label: string;
    value: string;
    placeholder: string;
    helper: string;
    /** Blank is a legitimate clear for a label, but not for an invitee's name. */
    required?: boolean;
  };
  destination: {
    /** `undefined` when the invite never named one — nothing to preselect. */
    current: Destination | undefined;
    /** Wording for the "no particular group" choice, which differs per invite type. */
    openLabel: string;
    openDetail: string;
    notes: InviteNote[];
  };
  /**
   * No `confirmMessage`, unlike web: confirming is the caller's, because the
   * two mobile callers guard differently — a reusable link makes you type
   * DELETE, a one-time invite takes a native alert.
   */
  delete: { enabled: boolean; disabledReason: string };
  onSave: (changes: {
    name?: string;
    communityId?: Destination;
  }) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
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
  const [name, setName] = useState(target.name.value);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [destination, setDestination] = useState<Destination | undefined>(
    target.destination.current,
  );

  const trimmedName = name.trim();
  const nameChanged = trimmedName !== target.name.value;
  const nameMissing = !!target.name.required && !trimmedName;
  const destinationChanged =
    destination !== undefined && destination !== target.destination.current;
  const dirty = nameChanged || destinationChanged;

  const handleCopy = useCallback(async () => {
    try {
      await setClipboardStringAsync(target.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      Alert.alert("Error", "Could not copy the link to the clipboard.");
    }
  }, [target.url]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await target.onSave({
        ...(nameChanged && { name: trimmedName }),
        ...(destinationChanged && { communityId: destination }),
      });
      onClose();
    } catch (err) {
      setSaving(false);
      Alert.alert("Error", `Failed to save changes: ${(err as Error).message}`);
    }
  }, [
    target,
    trimmedName,
    nameChanged,
    destination,
    destinationChanged,
    onClose,
  ]);

  // Hands off to the caller, which owns the confirmation and may need this
  // modal out of the way before it puts its own on screen.
  const handleDelete = useCallback(() => {
    void target.onDelete().then(onClose, (err: Error) => {
      Alert.alert("Error", `Failed to delete: ${err.message}`);
    });
  }, [target, onClose]);

  const options = useMemo(
    () => [
      ...leaderCommunities.map((community) => ({
        value: community.id as Destination,
        name: community.name,
        detail: inviteDestination.ledGroupDetail,
      })),
      {
        value: null as Destination,
        name: target.destination.openLabel,
        detail: target.destination.openDetail,
      },
    ],
    [leaderCommunities, target.destination],
  );

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
