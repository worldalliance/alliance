import { elementRuns } from "@alliance/common/forms/form-groups";
import {
  isQuestionField,
  type AnyField,
  type PageItem,
} from "@alliance/common/forms/form-schema";
import { interpolateDisplayBlock } from "@alliance/common/forms/variable-interpolation";
import { resolveDisplayBlockForUser } from "@alliance/shared/formrenderer";
import { type ComponentProps, type ReactNode } from "react";
import RenderDisplayBlock from "./RenderDisplayBlock";

export default function FormPage({
  elements,
  activeUserKey,
  isElementCurrentlyVisible,
  variableValues,
  blockProps,
  fieldRef,
  renderField,
}: {
  elements: PageItem[];
  activeUserKey: string | undefined;
  isElementCurrentlyVisible: (element: PageItem) => boolean;
  variableValues: ReadonlyMap<string, string>;
  blockProps: Omit<ComponentProps<typeof RenderDisplayBlock>, "block">;
  fieldRef: (fieldId: string) => (element: HTMLDivElement | null) => void;
  renderField: (field: AnyField) => ReactNode;
}) {
  const renderElement = (element: PageItem, index: number) => {
    if (isQuestionField(element)) {
      if (!isElementCurrentlyVisible(element)) {
        return null;
      }
      return (
        <div
          key={element.id || index}
          ref={fieldRef(element.id)}
          tabIndex={-1}
          className="scroll-mt-24"
        >
          {renderField(element)}
        </div>
      );
    }
    const resolvedBlock = resolveDisplayBlockForUser(element, activeUserKey);
    if (!isElementCurrentlyVisible(resolvedBlock)) {
      return null;
    }
    return (
      <RenderDisplayBlock
        {...blockProps}
        key={resolvedBlock.id ?? `block-${index}`}
        block={interpolateDisplayBlock(resolvedBlock, variableValues)}
      />
    );
  };

  return elementRuns(elements).flatMap(({ group, start, end }) => {
    const rendered = elements
      .slice(start, end)
      .map((element, offset) => renderElement(element, start + offset))
      .filter((node) => node !== null);
    if (group === undefined) return rendered;
    if (rendered.length === 0) return [];
    return (
      <div
        key={`group-${group}-${start}`}
        className="space-y-6 rounded-lg bg-zinc-100 px-5 py-4"
      >
        {rendered}
      </div>
    );
  });
}
