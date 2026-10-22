import type { PreviousAnswerBlock } from "@alliance/common/forms/display-blocks";
import type {
  FormSchema,
  ListField,
  ListFieldValue,
} from "@alliance/common/forms/form-schema";
import type { UserDto } from "@alliance/shared/client";
import {
  getVisiblePreviousAnswerSubFields,
  previousAnswerEmptyText,
  PreviousAnswerShape,
  resolvePreviousAnswer,
} from "@alliance/shared/lib/previousAnswers";
import { staticFieldContext } from "@alliance/shared/useFormRenderer";
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
        {previousAnswerEmptyText(block)}
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
          user={user}
        />
      );
    case PreviousAnswerShape.Single:
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
            field={answer.field}
            value={answer.value}
            disabled
            user={user}
            hideLabel={block.showLabel === false}
            fieldContext={staticFieldContext}
          />
        </View>
      );
    default:
      throw new Error(`unknown shape: ${answer satisfies never}`);
  }
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
                fieldContext={staticFieldContext}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}
