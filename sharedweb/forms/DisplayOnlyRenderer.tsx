import type { DisplayOnlySchema } from "@alliance/common/forms/display-only-schema";
import type { Unrenderable } from "@alliance/common/forms/unrenderable";
import { R, type Result } from "@alliance/common/result";
import {
  UnrenderableSubject,
  type UnrenderableContent,
} from "@alliance/shared/forms/unrenderable";
import RenderDisplayBlock from "./RenderDisplayBlock";
import UnrenderableNotice from "./UnrenderableNotice";

export function DisplayOnlyBlocks({ blocks }: DisplayOnlySchema) {
  return (
    <div className="space-y-6">
      {blocks.map((block, index) => (
        <RenderDisplayBlock key={block.id ?? `block-${index}`} block={block} />
      ))}
    </div>
  );
}

export default function DisplayOnlyRenderer({
  schema,
  content,
  showDetail = false,
}: {
  content: UnrenderableContent;
  /** For staff: shows why it can't be displayed, unreported. */
  showDetail?: boolean;
  schema: Result<DisplayOnlySchema, Unrenderable>;
}) {
  return R.match(schema, {
    success: (displaySchema) => <DisplayOnlyBlocks {...displaySchema} />,
    failure: ({ reason, detail }) => (
      <UnrenderableNotice
        subject={UnrenderableSubject.Update}
        reason={reason}
        detail={detail}
        content={content}
        showDetail={showDetail}
      />
    ),
  });
}
