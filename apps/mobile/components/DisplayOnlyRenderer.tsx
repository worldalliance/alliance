import type { DisplayOnlySchema } from "@alliance/common/forms/display-only-schema";
import type { Unrenderable } from "@alliance/common/forms/unrenderable";
import { R, type Result } from "@alliance/common/result";
import {
  UnrenderableSubject,
  type UnrenderableContent,
} from "@alliance/shared/forms/unrenderable";
import { View } from "react-native";
import { RenderDisplayBlockMobile } from "./forms/RenderDisplayBlock";
import UnrenderableNotice from "./UnrenderableNotice";

export default function DisplayOnlyRenderer({
  schema,
  content,
}: {
  schema: Result<DisplayOnlySchema, Unrenderable>;
  content: UnrenderableContent;
}) {
  return R.match(schema, {
    success: ({ blocks }) => (
      <View className="gap-y-4">
        {blocks.map((block, index) => (
          <View key={block.id ?? `block-${index}`}>
            <RenderDisplayBlockMobile
              block={block}
              hasRenderedNeighborAbove={index > 0}
              hasRenderedNeighborBelow={index < blocks.length - 1}
            />
          </View>
        ))}
      </View>
    ),
    failure: ({ reason, detail }) => (
      <UnrenderableNotice
        subject={UnrenderableSubject.Update}
        reason={reason}
        detail={detail}
        content={content}
      />
    ),
  });
}
