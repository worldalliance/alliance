import { elementRuns } from "@alliance/common/forms/form-groups";
import {
  isQuestionField,
  type AnyField,
  type PageItem,
} from "@alliance/common/forms/form-schema";
import { interpolateDisplayBlock } from "@alliance/common/forms/variable-interpolation";
import { resolveDisplayBlockForUser } from "@alliance/shared/formrenderer";
import { cn } from "@alliance/shared/styles/util";
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
  className,
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
  className?: string;
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
  const hasRenderedNeighbor = (from: number, to: number): boolean =>
    pageElementVisible.slice(from, to).some(Boolean);

  const renderElement = (
    element: PageItem,
    idx: number,
    scope: { start: number; end: number },
  ) => {
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
          hasRenderedNeighborAbove={hasRenderedNeighbor(scope.start, idx)}
          hasRenderedNeighborBelow={hasRenderedNeighbor(idx + 1, scope.end)}
        />
      </View>
    );
  };

  const page = { start: 0, end: resolvedPageElements.length };
  return (
    <View className={cn("gap-y-4", className)}>
      {elementRuns(resolvedPageElements).flatMap((run) => {
        const { group, start, end } = run;
        // A group's box pads its members, so their neighbours are only the
        // other members.
        const scope = group === undefined ? page : run;
        const rendered = resolvedPageElements
          .slice(start, end)
          .map((element, offset) =>
            renderElement(element, start + offset, scope),
          )
          .filter((node) => node !== null);
        if (group === undefined) return rendered;
        if (rendered.length === 0) return [];
        return (
          <View
            key={`group-${group}-${start}`}
            className="gap-y-4 rounded-lg bg-zinc-100 p-4"
          >
            {rendered}
          </View>
        );
      })}
    </View>
  );
}
