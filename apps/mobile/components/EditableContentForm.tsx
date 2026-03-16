import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from 'expo-file-system';
import { Paths } from 'expo-file-system';
import { CreateEditableContentDto } from "@alliance/shared/client";
import Text from "./system/Text";
import { KeyboardExtender } from "react-native-keyboard-controller";
import { cn } from "@alliance/shared/styles/util";

interface EditableContentFormProps {
  value: CreateEditableContentDto;
  onChange: (value: CreateEditableContentDto) => void;
  className?: string;
  placeholder?: string;
  expanded?: boolean;
  onCancel?: () => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;

  /** Optional namespace to distinguish drafts across pages/users/entities */
  draftKey?: string;
  /** Debounce interval for autosave (ms) */
  autosaveMs?: number;
  /** Whether to restore a found draft on mount */
  restoreDraft?: boolean;
  /** Called after a draft is restored */
  onDraftRestored?: (restored: CreateEditableContentDto) => void;
  /**
   * Increment or change this after a successful server save to clear the local draft.
   * Example: setClearDraftSignal((x)=>x+1)
   */
  clearDraftSignal?: number;
}

const STORAGE_PREFIX = "editablecontent:draft:v1";
/** Sentinel for lastSavedHashRef when draft was just cleared; suppresses the next autosave. */
const DRAFT_CLEARED_SENTINEL = "__DRAFT_CLEARED__";

function getStorageKey(draftKey?: string) {
  return `${STORAGE_PREFIX}:${draftKey ?? "default"}`;
}

function toSafeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getDraftPath(draftKey?: string) {
  const safeKey = toSafeFileName(getStorageKey(draftKey));
  return Paths.join(Paths.document, `${safeKey}.json`);
}

const EditableContentForm: React.FC<EditableContentFormProps> = ({
  value,
  onChange,
  className,
  placeholder,
  expanded,
  onCancel,
  onSubmit,
  submitLabel = "Post",
  draftKey,
  autosaveMs = 1200,
  restoreDraft,
  onDraftRestored,
  clearDraftSignal,
  isSubmitting,
}) => {
  const [inputHeight, setInputHeight] = useState(0);
  const [isPicking, setIsPicking] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedHashRef = useRef<string>("");

  const draftPath = useMemo(() => getDraftPath(draftKey), [draftKey]);
  const shouldRestoreDraft = restoreDraft ?? draftKey !== undefined;
  const minHeight = expanded ? 120 : 32;

  const [showExtend, setShowExtend] = useState(false);

  useEffect(
    () => {
      if (!shouldRestoreDraft || !draftPath) return;
      let canceled = false;

      const restore = async () => {
        try {
          const info = await FileSystem.getInfoAsync(draftPath);
          if (!info.exists) return;
          const raw = await FileSystem.readAsStringAsync(draftPath);
          if (!raw) return;
          const parsed = JSON.parse(raw) as {
            dto: CreateEditableContentDto;
            savedAt: string;
          };
          if (canceled) return;
          const currentHash = JSON.stringify(value);
          const storedHash = JSON.stringify(parsed.dto);
          if (storedHash !== currentHash) {
            onChange(parsed.dto);
            onDraftRestored?.(parsed.dto);
          }
          lastSavedHashRef.current = storedHash;
        } catch (err) {
          console.warn("Failed to restore draft", err);
        }
      };

      void restore();
      return () => {
        canceled = true;
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shouldRestoreDraft, draftPath],
  );

  useEffect(() => {
    if (!draftPath) return;

    const doSave = async () => {
      const hash = JSON.stringify(value);
      if (hash === lastSavedHashRef.current) return;
      if (lastSavedHashRef.current === DRAFT_CLEARED_SENTINEL) {
        lastSavedHashRef.current = hash;
        return;
      }
      const payload = JSON.stringify({
        dto: value,
        savedAt: new Date().toISOString(),
      });
      try {
        await FileSystem.writeAsStringAsync(draftPath, payload);
        lastSavedHashRef.current = hash;
      } catch (err) {
        console.warn("Failed to save draft", err);
      }
    };

    if (saveTimer.current) clearTimeout(saveTimer.current);

    if (clearDraftSignal !== undefined) {
      saveTimer.current = setTimeout(() => {
        void doSave();
      }, autosaveMs);
    }

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [value, autosaveMs, draftPath, clearDraftSignal]);

  useEffect(() => {
    if (!clearDraftSignal) return;
    if (!draftPath) return;
    const clearDraft = async () => {
      try {
        await FileSystem.deleteAsync(draftPath, { idempotent: true });
        lastSavedHashRef.current = DRAFT_CLEARED_SENTINEL;
      } catch {
        // ignore
      }
    };
    void clearDraft();
  }, [clearDraftSignal, draftPath]);

  const handlePickImages = async () => {
    if (isPicking) return;
    setPickerError(null);
    setIsPicking(true);
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setPickerError("Permission to access photos is required.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        base64: true,
      });
      if (result.canceled || !result.assets.length) return;
      const attachments = result.assets
        .map((asset) => {
          if (!asset.base64) {
            return asset.uri;
          }
          const mime = asset.mimeType ?? "image/jpeg";
          return `data:${mime};base64,${asset.base64}`;
        })
        .filter((img): img is string => Boolean(img));
      if (!attachments.length) return;
      onChange({
        ...value,
        attachments: [...(value.attachments ?? []), ...attachments],
      });
    } catch (err) {
      console.error("Failed to pick image(s)", err);
      setPickerError("Unable to add that photo.");
    } finally {
      setIsPicking(false);
    }
  };

  const removeAttachment = (index: number) => {
    const next = (value.attachments ?? []).filter((_, i) => i !== index);
    onChange({ ...value, attachments: next });
  };

  const canSubmit =
    value.body.trim() !== "" || (value.attachments?.length ?? 0) > 0;

  return (
    <View className={className}>
      <TextInput
        className="w-full px-3 py-2 text-base text-zinc-900"
        value={value.body}
        onChangeText={(text) => onChange({ ...value, body: text })}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        multiline
        autoFocus={expanded}
        onFocus={() => setShowExtend(true)}
        onBlur={() => setShowExtend(false)}
        onContentSizeChange={(event) => {
          const nextHeight = event.nativeEvent.contentSize.height;
          setInputHeight(nextHeight);
        }}
        style={[
          styles.textInput,
          {
            minHeight,
            height: Math.max(minHeight, inputHeight || minHeight),
          },
        ]}
      />
      {(value.attachments ?? []).length > 0 && (
        <View className="mt-3 flex-row flex-wrap gap-2">
          {(value.attachments ?? []).map((img, idx) => (
            <View key={`${img}-${idx}`} style={styles.attachment}>
              <Image
                source={{ uri: img }}
                className="w-20 h-20 rounded"
                resizeMode="cover"
              />
              <TouchableOpacity
                onPress={() => removeAttachment(idx)}
                style={styles.removeButton}
                accessibilityLabel="Remove image"
              >
                <Text className="text-xs text-white">x</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
      <KeyboardExtender enabled={showExtend}>
        <View className="p-2 flex-row items-center gap-3 bg-white border-y border-zinc-200 justify-between">
          <Pressable
            onPress={handlePickImages}
            disabled={isPicking}
            className="px-3 py-1.5"
            onStartShouldSetResponder={() => false}
          >
            {isPicking ? (
              <ActivityIndicator size="small" color="#444" />
            ) : (
              <Text className="text-zinc-800">Add photos</Text>
            )}
          </Pressable>
          {pickerError ? (
            <Text className="text-xs text-red-500">{pickerError}</Text>
          ) : null}
          <View className="flex-row items-center gap-3">
            {onCancel && (
              <Pressable onPress={onCancel} className="px-3 py-1.5">
                <Text className="text-zinc-500">Cancel</Text>
              </Pressable>
            )}
            <Pressable
              onPress={onSubmit}
              disabled={!canSubmit || isSubmitting}
              className={cn(
                "px-3 py-1.5 bg-zinc-800 rounded-sm",
                (!canSubmit || isSubmitting) && "opacity-50",
              )}
            >
              <Text className="text-white">
                {isSubmitting ? "Posting..." : submitLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardExtender>
    </View>
  );
};

const styles = StyleSheet.create({
  textInput: {
    textAlignVertical: "top",
  },
  attachment: {
    position: "relative",
  },
  removeButton: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
});

export default EditableContentForm;