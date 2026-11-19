import type { DisplayOnlySchema } from "@alliance/common/forms/display-only-schema";
import type { Unrenderable } from "@alliance/common/forms/unrenderable";
import { R, type Result } from "@alliance/common/result";
import { UnrenderableSubject } from "@alliance/shared/forms/unrenderable";
import RenderDisplayBlock from "./RenderDisplayBlock";
import UnrenderableNotice from "./UnrenderableNotice";

export default function DisplayOnlyRenderer({
  schema,
  showDetail = false,
}: {
  /** For staff: shows why it can't be displayed. */
  showDetail?: boolean;
  schema: Result<DisplayOnlySchema, Unrenderable>;
}) {
  return R.match(schema, {
    success: ({ blocks }) => (
      <div className="space-y-6">
        {blocks.map((block, index) => (
          <RenderDisplayBlock
            key={block.id ?? `block-${index}`}
            block={block}
          />
        ))}
      </div>
    ),
    failure: ({ reason, detail }) => (
      <UnrenderableNotice
        subject={UnrenderableSubject.Update}
        reason={reason}
        detail={detail}
        showDetail={showDetail}
      />
    ),
  });
}
