import type { FileField } from "@alliance/common/forms/form-schema";
import {
  resolvePickedPreview,
  resolveUploadSlot,
  type FilePick,
  type FileUploadSlot,
  type FileUploadSlots,
} from "@alliance/shared/forms/fileUploadSlots";
import { cancelImageUpload } from "@alliance/shared/lib/copy";
import { X } from "lucide-react-native";
import { useRef, useState } from "react";
import { Image, TouchableOpacity, View } from "react-native";
import { getImageSource } from "../../lib/config";
import { pickImageDataUri } from "../../lib/pickImageDataUri";
import Text from "../system/Text";
import {
  RenderLabel,
  renderValidationMessage,
  type FieldInputProps,
} from "./fieldParts";

export function FileInputField({
  field,
  value,
  disabled,
  errorMessage,
  isOutputView,
  hideLabel,
  required,
  fileUpload,
  fileUploadSlot,
}: FieldInputProps<FileField> & {
  fileUpload?: FileUploadSlots;
  fileUploadSlot?: FileUploadSlot;
}) {
  const [filePreview, setFilePreview] = useState<FilePick | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);
  // The library sheet is open across an await, before any upload has started,
  // so `uploading` cannot keep a second tap out.
  const pickingRef = useRef(false);

  const {
    slot: uploadSlot,
    uploading,
    uploadError,
  } = resolveUploadSlot({ fileUpload, fileUploadSlot, fieldId: field.id });

  const currentPreview =
    resolvePickedPreview({ pick: filePreview, value, uploading }) ??
    (typeof value === "string" && value ? getImageSource(value) : null);

  const pickImage = async () => {
    if (disabled || uploading || !fileUpload) return;
    if (pickingRef.current) return;
    pickingRef.current = true;
    setPickerError(null);
    try {
      const picked = await pickImageDataUri({ allowsEditing: true });
      if (!picked.ok) {
        console.error("Failed to pick image", picked.error);
        setPickerError("Unable to read that photo. Try another one.");
        return;
      }
      if (!picked.value) {
        return;
      }
      setFilePreview({ uri: picked.value.uri, replaces: value });
      void fileUpload.onFileSelected(uploadSlot, picked.value.dataUri);
    } finally {
      pickingRef.current = false;
    }
  };

  return (
    <View>
      <RenderLabel
        field={field}
        isOutputView={isOutputView}
        hideLabel={hideLabel}
        required={required}
      />
      {currentPreview && (
        <Image
          source={{ uri: currentPreview }}
          className="w-full h-48 rounded-lg mb-3 bg-zinc-200"
          resizeMode="cover"
        />
      )}
      <View className="flex-row items-center gap-3">
        <TouchableOpacity
          onPress={pickImage}
          disabled={disabled || uploading}
          className="flex-1 justify-start border border-zinc-200 rounded-lg p-3"
        >
          {uploading ? (
            <Text className="text-sm text-blue-600">Uploading...</Text>
          ) : (
            <Text className="text-base">Choose photo</Text>
          )}
        </TouchableOpacity>
        {uploading && (
          <TouchableOpacity
            onPress={() => fileUpload?.cancelUpload(uploadSlot)}
            accessibilityLabel={cancelImageUpload}
            hitSlop={8}
            className="p-2"
          >
            <X size={20} color="#71717a" />
          </TouchableOpacity>
        )}
      </View>
      {pickerError || uploadError ? (
        <Text className="text-xs text-red-500 mt-2">
          {uploadError || pickerError}
        </Text>
      ) : null}
      {renderValidationMessage(errorMessage)}
    </View>
  );
}
