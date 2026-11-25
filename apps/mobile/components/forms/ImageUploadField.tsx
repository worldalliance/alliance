import type { ImageField } from "@alliance/common/forms/form-schema";
import { markdownAccessibleName } from "@alliance/shared/forms/markdownAccessibleName";
import { PERSON_SILHOUETTE } from "@alliance/shared/forms/personSilhouette";
import { cancelImageUpload } from "@alliance/shared/lib/copy";
import { cn } from "@alliance/shared/styles/util";
import { X } from "lucide-react-native";
import { Image, Pressable, TouchableOpacity, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "../../lib/style/colors";
import Text from "../system/Text";
import { renderValidationMessage, type FieldInputProps } from "./fieldParts";
import { OptionalLabelPrefix } from "./OptionalLabelPrefix";
import { useImagePick, type FileFieldUploadProps } from "./useImagePick";

export function ImageUploadField({
  field,
  value,
  disabled,
  errorMessage,
  isOutputView,
  required,
  fileUpload,
  fileUploadSlot,
}: FieldInputProps<ImageField> & FileFieldUploadProps) {
  const hasError = Boolean(errorMessage);
  const { pick, preview, uploading, error, cancel } = useImagePick({
    field,
    value,
    disabled,
    fileUpload,
    fileUploadSlot,
  });
  const locked = disabled || uploading || isOutputView;

  return (
    <View>
      {!required && !isOutputView && <OptionalLabelPrefix />}
      <Pressable
        onPress={pick}
        disabled={locked}
        accessibilityRole="button"
        accessibilityLabel={
          field.label === null ? undefined : markdownAccessibleName(field.label)
        }
        accessibilityState={{ disabled: !!locked, busy: uploading }}
        className="items-center gap-y-3 pt-4"
      >
        <View
          className={cn(
            "size-36 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed bg-white",
            hasError ? "border-red-500" : "border-zinc-300",
          )}
        >
          {preview ? (
            <Image
              source={{ uri: preview }}
              className="size-full"
              resizeMode="cover"
            />
          ) : (
            <Svg viewBox={PERSON_SILHOUETTE.viewBox} width="75%" height="75%">
              <Circle {...PERSON_SILHOUETTE.head} fill={colors.borderLight} />
              <Path d={PERSON_SILHOUETTE.body} fill={colors.borderLight} />
            </Svg>
          )}
        </View>
        {field.label !== null && (
          <Text className={hasError ? "text-red-600" : "text-zinc-500"}>
            {uploading ? "Uploading..." : field.label}
          </Text>
        )}
      </Pressable>
      {uploading && (
        <View className="items-center">
          <TouchableOpacity
            onPress={cancel}
            accessibilityLabel={cancelImageUpload}
            hitSlop={8}
            className="p-2"
          >
            <X size={20} color="#71717a" />
          </TouchableOpacity>
        </View>
      )}
      {error ? (
        <Text className="text-xs text-red-500 mt-2 text-center">{error}</Text>
      ) : null}
      {renderValidationMessage(errorMessage)}
    </View>
  );
}
