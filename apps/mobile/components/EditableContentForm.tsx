import { CreateEditableContentDto } from "@alliance/shared/client";
import { photoPickFailed, unreadablePhotos } from "@alliance/shared/lib/copy";
import { File, Paths } from "expo-file-system";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardExtender } from "react-native-keyboard-controller";
import Reanimated from "react-native-reanimated";
import { resolveImageSource } from "../lib/config";
import { pickImageDataUris } from "../lib/pickImageDataUri";
import { useKeyboardExtenderPortal } from "./KeyboardExtenderPortal";
import Text from "./system/Text";

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
  submitDisabled?: boolean;

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
  /** Whether to auto-focus the input when the component mounts */
  autoFocus?: boolean;
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

const TAP_SLOP_PX = 10;

function ToolbarButton({
  onTap,
  className,
  children,
}: {
  onTap: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  return (
    <View
      onTouchStart={(e) => {
        const { pageX, pageY } = e.nativeEvent;
        touchStart.current = { x: pageX, y: pageY };
      }}
      onTouchEnd={(e) => {
        const start = touchStart.current;
        touchStart.current = null;
        if (!start) return;
        const { pageX, pageY } = e.nativeEvent;
        const dx = pageX - start.x;
        const dy = pageY - start.y;
        if (dx * dx + dy * dy <= TAP_SLOP_PX * TAP_SLOP_PX) onTap();
      }}
      className={className}
    >
      {children}
    </View>
  );
}

function PortalToolbar({
  portal,
  toolbar,
}: {
  portal: { setToolbar: (node: React.ReactNode | null) => void };
  toolbar: React.ReactNode;
}) {
  useEffect(() => {
    return () => portal.setToolbar(null);
  }, [portal]);

  useEffect(() => {
    portal.setToolbar(toolbar);
  }, [portal, toolbar]);

  return null;
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
  submitDisabled = false,
  draftKey,
  autosaveMs = 1200,
  restoreDraft,
  onDraftRestored,
  clearDraftSignal,
  isSubmitting,
  autoFocus,
}) => {
  const portal = useKeyboardExtenderPortal();
  const [isPicking, setIsPicking] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedHashRef = useRef<string>("");
  const toolbarHideRef = useRef<ReturnType<typeof setImmediate> | null>(null);
  const isPickingRef = useRef(false);
  const inputRef = useRef<TextInput>(null);

  const draftPath = useMemo(() => getDraftPath(draftKey), [draftKey]);
  const shouldRestoreDraft = restoreDraft ?? draftKey !== undefined;

  const [showExtend, setShowExtend] = useState(false);

  useEffect(() => {
    return () => {
      if (toolbarHideRef.current != null) {
        clearImmediate(toolbarHideRef.current);
      }
    };
  }, []);

  useEffect(
    () => {
      if (!shouldRestoreDraft || !draftPath) return;
      let canceled = false;

      const restore = async () => {
        try {
          const file = new File(draftPath);
          if (!file.exists) return;
          const raw = await file.text();
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
        const file = new File(draftPath);
        if (!file.exists) file.create();
        file.write(payload);
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
    (() => {
      try {
        const file = new File(draftPath);
        if (file.exists) file.delete();
        lastSavedHashRef.current = DRAFT_CLEARED_SENTINEL;
      } catch {
        // ignore
      }
    })();
  }, [clearDraftSignal, draftPath]);

  const handlePickImages = async () => {
    if (isPickingRef.current || isPicking) {
      return;
    }
    isPickingRef.current = true;
    if (toolbarHideRef.current != null) {
      clearImmediate(toolbarHideRef.current);
      toolbarHideRef.current = null;
    }
    setPickerError(null);
    setIsPicking(true);
    try {
      const picked = await pickImageDataUris();
      if (!picked.ok) {
        console.error("Failed to pick image(s)", picked.error);
        setPickerError(photoPickFailed);
        return;
      }
      const { dataUris, unreadableCount } = picked.value;
      if (unreadableCount > 0) {
        setPickerError(
          unreadablePhotos(unreadableCount, unreadableCount + dataUris.length),
        );
      }
      if (!dataUris.length) return;
      onChange({
        ...value,
        attachments: [...(value.attachments ?? []), ...dataUris],
      });
      inputRef.current?.focus();
    } finally {
      isPickingRef.current = false;
      setIsPicking(false);
    }
  };

  const removeAttachment = (index: number) => {
    const next = (value.attachments ?? []).filter((_, i) => i !== index);
    onChange({ ...value, attachments: next });
  };

  const canSubmit =
    !submitDisabled &&
    (value.body.trim() !== "" || (value.attachments?.length ?? 0) > 0);

  const toolbarTap = (onTap: () => void) => {
    if (toolbarHideRef.current != null) {
      clearImmediate(toolbarHideRef.current);
      toolbarHideRef.current = null;
    }
    onTap();
  };

  return (
    <View className={className}>
      <TextInput
        ref={inputRef}
        className="w-full px-3 py-2 text-base text-zinc-900"
        value={value.body}
        onChangeText={(text) => onChange({ ...value, body: text })}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        multiline
        autoFocus={autoFocus ?? expanded}
        onFocus={() => setShowExtend(true)}
        onBlur={() => {
          if (isPickingRef.current) return;
          if (toolbarHideRef.current != null)
            clearImmediate(toolbarHideRef.current);
          toolbarHideRef.current = setImmediate(() => {
            toolbarHideRef.current = null;
            setShowExtend(false);
          });
        }}
        style={[styles.textInput]}
      />
      {(value.attachments ?? []).length > 0 && (
        <View className="mt-3 flex-row flex-wrap gap-2">
          {(value.attachments ?? []).map((img, idx) => (
            <View key={`${img}-${idx}`} style={styles.attachment}>
              <Image
                source={{ uri: resolveImageSource(img) }}
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
      {(() => {
        const toolbar = (
          <Reanimated.View className="p-2 flex-row items-center gap-3 justify-between mx-5">
            <ToolbarButton
              onTap={() =>
                toolbarTap(() => {
                  if (!isPicking) handlePickImages();
                })
              }
              className="px-3 py-1.5"
            >
              {isPicking ? (
                <ActivityIndicator size="small" color="#444" />
              ) : (
                <Text className="text-zinc-800">Add photos</Text>
              )}
            </ToolbarButton>
            {pickerError ? (
              <Text className="text-xs text-red-500">{pickerError}</Text>
            ) : null}
            <View className="flex-row justify-center items-center">
              {onCancel && (
                <ToolbarButton
                  onTap={() => toolbarTap(onCancel)}
                  className="px-3 py-1.5"
                >
                  <Text className="text-zinc-500">Cancel</Text>
                </ToolbarButton>
              )}
              <ToolbarButton
                onTap={() =>
                  toolbarTap(() => {
                    if (canSubmit && !isSubmitting) onSubmit();
                  })
                }
                className={`px-3 py-1.5 rounded-full ${
                  canSubmit ? "bg-green" : "bg-zinc-300"
                }`}
              >
                <Text className="text-white">
                  {isSubmitting ? "Posting..." : submitLabel}
                </Text>
              </ToolbarButton>
            </View>
          </Reanimated.View>
        );

        if (portal) {
          return <PortalToolbar portal={portal} toolbar={toolbar} />;
        }

        return (
          <KeyboardExtender enabled={showExtend}>{toolbar}</KeyboardExtender>
        );
      })()}
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
