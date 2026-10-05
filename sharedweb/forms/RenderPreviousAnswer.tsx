import type { PreviousAnswerBlock } from "@alliance/common/forms/display-blocks";
import type {
  FormSchema,
  ListField,
  ListFieldValue,
} from "@alliance/common/forms/form-schema";
import {
  getVisiblePreviousAnswerSubFields,
  previousAnswerEmptyText,
  PreviousAnswerShape,
  resolvePreviousAnswer,
} from "@alliance/shared/lib/previousAnswers";
import { staticFieldContext } from "@alliance/shared/useFormRenderer";
import RenderField from "./RenderField";

function EmptyPlaceholder({ block }: { block: PreviousAnswerBlock }) {
  return (
    <div>
      {block.title && (
        <h3 className="text-base font-medium text-zinc-900 mb-2">
          {block.title}
        </h3>
      )}
      <p className="text-sm text-gray-400 italic">
        {previousAnswerEmptyText(block)}
      </p>
    </div>
  );
}

type Props = {
  block: PreviousAnswerBlock;
  schema?: FormSchema;
  answers?: Record<string, unknown>;
};

export default function RenderPreviousAnswer({
  block,
  schema,
  answers,
}: Props) {
  const answer = resolvePreviousAnswer({ block, schema, answers });
  if (!answer) {
    return <EmptyPlaceholder block={block} />;
  }
  switch (answer.shape) {
    case PreviousAnswerShape.List:
      return (
        <RenderPreviousAnswerList
          block={block}
          field={answer.field}
          value={answer.rows}
        />
      );
    case PreviousAnswerShape.Single:
      return (
        <div>
          {block.title && (
            <h3 className="text-base font-medium text-zinc-900 mb-2">
              {block.title}
            </h3>
          )}
          <RenderField
            field={answer.field}
            value={answer.value}
            disabled={true}
            hideLabel={block.showLabel === false}
            fieldContext={staticFieldContext}
          />
        </div>
      );
    default:
      throw new Error(`unknown shape: ${answer satisfies never}`);
  }
}

function RenderPreviousAnswerList({
  block,
  field,
  value,
}: {
  block: PreviousAnswerBlock;
  field: ListField;
  value: ListFieldValue;
}) {
  const visibleSubFields = getVisiblePreviousAnswerSubFields(field, block);

  return (
    <div>
      {block.title && (
        <h3 className="text-base font-medium text-zinc-900 mb-2">
          {block.title}
        </h3>
      )}
      <div className="space-y-3">
        {value.map((item, idx) => (
          <div
            key={idx}
            className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-2"
          >
            {visibleSubFields.map((subField) => (
              <RenderField
                key={subField.id}
                field={subField}
                value={item[subField.id]}
                disabled={true}
                hideLabel={block.showLabel === false}
                fieldContext={staticFieldContext}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
