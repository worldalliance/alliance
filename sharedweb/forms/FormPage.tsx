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
  return elements.map((element, index) => {
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
  });
}
