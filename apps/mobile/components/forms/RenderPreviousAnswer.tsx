import type { PreviousAnswerBlock } from "@alliance/common/forms/display-blocks";
import type {
  FormSchema,
  FormValue,
  ListField,
  ListFieldValue,
} from "@alliance/common/forms/form-schema";
import type { UserDto } from "@alliance/shared/client";
import {
  findFieldInSchema,
  getVisiblePreviousAnswerSubFields,
  isPreviousAnswerValueEmpty,
} from "@alliance/shared/lib/previousAnswers";
import { View } from "react-native";
import Text, { FontWeight } from "../system/Text";
import { RenderField } from "./RenderField";

function EmptyPlaceholder({ block }: { block: PreviousAnswerBlock }) {
  return (
    <View>
      {block.title ? (
        <Text
          className="mb-2 text-base text-zinc-900"
          weight={FontWeight.Medium}
        >
          {block.title}
        </Text>
      ) : null}
      <Text className="text-sm italic text-zinc-400">
        {block.emptyText || "No previous answer available"}
      </Text>
    </View>
  );
}

type RenderPreviousAnswerProps = {
  block: PreviousAnswerBlock;
  schema?: FormSchema;
  answers?: Record<string, unknown>;
  user?: Omit<UserDto, "email">;
};

export default function RenderPreviousAnswer({
  block,
  schema,
  answers,
  user,
}: RenderPreviousAnswerProps) {
  if (!schema || !answers) {
    return <EmptyPlaceholder block={block} />;
  }

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
        user={user}
      />
    );
  }

  return (
    <View>
      {block.title ? (
        <Text
          className="mb-2 text-base text-zinc-900"
          weight={FontWeight.Medium}
        >
          {block.title}
        </Text>
      ) : null}
      <RenderField
        field={field}
        value={value}
        disabled
        user={user}
        hideLabel={block.showLabel === false}
      />
    </View>
  );
}

function RenderPreviousAnswerList({
  block,
  field,
  value,
  user,
}: {
  block: PreviousAnswerBlock;
  field: ListField;
  value: ListFieldValue;
  user?: Omit<UserDto, "email">;
}) {
  const visibleSubFields = getVisiblePreviousAnswerSubFields(field, block);

  if (!Array.isArray(value) || value.length === 0) {
    return <EmptyPlaceholder block={block} />;
  }

  return (
    <View>
      {block.title ? (
        <Text
          className="mb-2 text-base text-zinc-900"
          weight={FontWeight.Medium}
        >
          {block.title}
        </Text>
      ) : null}
      <View className="gap-3">
        {value.map((item, idx) => (
          <View
            key={idx}
            className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 gap-2"
          >
            {visibleSubFields.map((subField) => (
              <RenderField
                key={subField.id}
                field={subField}
                value={item[subField.id]}
                disabled
                user={user}
                hideLabel={block.showLabel === false}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}
