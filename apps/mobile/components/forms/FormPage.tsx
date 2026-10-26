import {
  isQuestionField,
  type AnyField,
  type PageItem,
} from "@alliance/common/forms/form-schema";
import { interpolateDisplayBlock } from "@alliance/common/forms/variable-interpolation";
import { resolveDisplayBlockForUser } from "@alliance/shared/formrenderer";
import { useMemo, type ReactNode } from "react";
import { View } from "react-native";
import {
  RenderDisplayBlockMobile,
  type RenderDisplayBlockMobileProps,
} from "./RenderDisplayBlock";

export default function FormPage({
  elements,
  activeUserKey,
  isElementCurrentlyVisible,
  variableValues,
  blockProps,
  renderField,
}: {
  elements: PageItem[];
  activeUserKey: string | undefined;
  isElementCurrentlyVisible: (element: PageItem) => boolean;
  variableValues: ReadonlyMap<string, string>;
  blockProps: Omit<
    RenderDisplayBlockMobileProps,
    "block" | "hasRenderedNeighborAbove" | "hasRenderedNeighborBelow"
  >;
  renderField: (field: AnyField) => ReactNode;
}) {
  const resolvedPageElements = useMemo(
    () =>
      elements.map((element) =>
        isQuestionField(element)
          ? element
          : resolveDisplayBlockForUser(element, activeUserKey),
      ),
    [elements, activeUserKey],
  );
  const pageElementVisible = useMemo(
    () =>
      resolvedPageElements.map((element) => isElementCurrentlyVisible(element)),
    [resolvedPageElements, isElementCurrentlyVisible],
  );
  const hasRenderedNeighborAbove = (idx: number): boolean => {
    for (let j = idx - 1; j >= 0; j--) {
      if (pageElementVisible[j]) return true;
    }
    return false;
  };
  const hasRenderedNeighborBelow = (idx: number): boolean => {
    for (let j = idx + 1; j < pageElementVisible.length; j++) {
      if (pageElementVisible[j]) return true;
    }
    return false;
  };

  return (
    <View className="gap-y-4">
      {resolvedPageElements.map((element, idx) => {
        if (!pageElementVisible[idx]) {
          return null;
        }
        if (isQuestionField(element)) {
          return <View key={element.id}>{renderField(element)}</View>;
        }
        return (
          <View key={element.id ?? `block-${idx}`}>
            <RenderDisplayBlockMobile
              {...blockProps}
              block={interpolateDisplayBlock(element, variableValues)}
              hasRenderedNeighborAbove={hasRenderedNeighborAbove(idx)}
              hasRenderedNeighborBelow={hasRenderedNeighborBelow(idx)}
            />
          </View>
        );
      })}
    </View>
  );
}
