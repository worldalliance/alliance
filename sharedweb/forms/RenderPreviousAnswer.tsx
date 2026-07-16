import type { PreviousAnswerBlock } from "@alliance/common/forms/display-blocks";
import type {
  FormSchema,
  FormValue,
  ListField,
  ListFieldValue,
} from "@alliance/common/forms/form-schema";
import {
  findFieldInSchema,
  getVisiblePreviousAnswerSubFields,
  isPreviousAnswerValueEmpty,
} from "@alliance/shared/lib/previousAnswers";
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
        {block.emptyText || "No previous answer available"}
      </p>
    </div>
  );
}

type Props = {
  block: PreviousAnswerBlock;
  schema: FormSchema;
  answers: Record<string, unknown>;
};

export default function RenderPreviousAnswer({
  block,
  schema,
  answers,
}: Props) {
  const field = findFieldInSchema(schema, block.sourceFieldId);
  if (!field) {
    return <EmptyPlaceholder block={block} />;
  }

  const value = answers[block.sourceFieldId] as FormValue | undefined;

  if (isPreviousAnswerValueEmpty(value)) {
    return <EmptyPlaceholder block={block} />;
  }

  if (field.kind === "list") {
    return (
      <RenderPreviousAnswerList
        block={block}
        field={field as ListField}
        value={value as ListFieldValue}
      />
    );
  }

  return (
    <div>
      {block.title && (
        <h3 className="text-base font-medium text-zinc-900 mb-2">
          {block.title}
        </h3>
      )}
      <RenderField
        field={field}
        value={value}
        disabled={true}
        hideLabel={block.showLabel === false}
      />
    </div>
  );
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

  if (!Array.isArray(value) || value.length === 0) {
    return <EmptyPlaceholder block={block} />;
  }

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
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
