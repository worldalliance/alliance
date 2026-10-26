import {
  cancelAllImageUploads,
  draftSaveFailed,
  waitingForImageUpload,
} from "@alliance/shared/lib/copy";
import { CircleCheck, Ellipsis, X } from "lucide-react-native";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import { colors } from "../../lib/style/colors";
import Button, { ButtonColor, ButtonSize } from "../system/Button";
import Text, { FontWeight } from "../system/Text";

type PageNumbering = { pageNumber: number; pageCount: number };

export function ReadOnlyPageNavigation({
  pageNumber,
  pageCount,
  onBack,
  onNext,
}: PageNumbering & {
  onBack: (() => void) | null;
  onNext: (() => void) | null;
}) {
  return (
    <View>
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-sm text-zinc-500">
          Page {pageNumber} of {pageCount}
        </Text>
      </View>
      <View className="flex-row gap-3">
        {onBack && (
          <Button
            onPress={onBack}
            color={ButtonColor.Outline}
            size={ButtonSize.Medium}
            className="flex-1"
            title="Back"
          />
        )}
        {onNext && (
          <Button
            onPress={onNext}
            color={ButtonColor.Black}
            size={ButtonSize.Medium}
            className="flex-1"
            title="Next"
          />
        )}
      </View>
    </View>
  );
}

export function FormNavigation({
  pageNumber,
  pageCount,
  onBack,
  onPrimary,
  isLastPage,
  preview,
  submitting,
  primaryDisabled,
  onWithdraw,
  uploadingImages,
  onCancelUploads,
  saveFailed,
  hasFieldErrors,
}: PageNumbering & {
  onBack: (() => void) | null;
  onPrimary: () => void;
  isLastPage: boolean;
  preview: boolean;
  submitting: boolean;
  primaryDisabled: boolean;
  onWithdraw: (() => void) | null;
  uploadingImages: boolean;
  onCancelUploads: () => void;
  saveFailed: boolean;
  hasFieldErrors: boolean;
}) {
  return (
    <View>
      <View className="">
        <View className="flex-row justify-between items-center mb-3">
          {pageCount > 1 ? (
            <Text className="text-sm text-zinc-500">
              Page {pageNumber} of {pageCount}
            </Text>
          ) : null}
        </View>
        <View className="flex-row gap-1.5">
          {onBack && (
            <Button
              onPress={onBack}
              color={ButtonColor.Outline}
              size={ButtonSize.Medium}
              className="flex-1"
              disabled={submitting}
              title="Back"
            />
          )}
          <Button
            onPress={onPrimary}
            color={ButtonColor.Black}
            size={ButtonSize.Medium}
            className="flex-2 py-4! gap-x-1"
            disabled={primaryDisabled}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                {isLastPage ? (
                  <CircleCheck size={16} color="#fff" strokeWidth={2.5} />
                ) : null}
                <Text
                  className="text-white text-base"
                  weight={FontWeight.Medium}
                >
                  {isLastPage
                    ? preview
                      ? "Complete (Preview Mode)"
                      : "Complete"
                    : "Next"}
                </Text>
              </>
            )}
          </Button>
          {onWithdraw && (
            <Button
              onPress={onWithdraw}
              color={ButtonColor.Outline}
              size={ButtonSize.Medium}
            >
              <Ellipsis size={15} />
            </Button>
          )}
        </View>
      </View>
      {uploadingImages && (
        <View className="flex-row items-center gap-1 p-2">
          <Text className="text-zinc-500 text-base">
            {waitingForImageUpload}
          </Text>
          <TouchableOpacity
            onPress={onCancelUploads}
            accessibilityLabel={cancelAllImageUploads}
            hitSlop={8}
            className="p-1"
          >
            <X size={20} color={colors.text.icon} />
          </TouchableOpacity>
        </View>
      )}
      {saveFailed && (
        <Text className="text-amber-600 text-base p-2">{draftSaveFailed}</Text>
      )}
      {hasFieldErrors && (
        <Text className="text-red-500 text-base p-2">
          Your form has errors. Please fix before submitting.
        </Text>
      )}
    </View>
  );
}
