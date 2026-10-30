import type { FormSchema } from "@alliance/common/forms/form-schema";
import type { UserDto } from "@alliance/shared/client";
import FormRenderer from "@alliance/sharedweb/forms/FormRenderer";
import { PreviewBoundary } from "./form-canvas/ElementBoundary";

/** `"preview"` previews as the sample member rather than a real one. */
export function MemberFormRenderer({
  schema,
  previewUserId,
  user,
  initialPageIndex,
}: {
  schema: FormSchema;
  previewUserId: number | "preview";
  user: UserDto;
  initialPageIndex?: number;
}) {
  return (
    <PreviewBoundary resetKeys={[schema, previewUserId]}>
      <FormRenderer
        key={previewUserId}
        id={0}
        formSnapshotId={null}
        actionId={0}
        form={schema}
        onSubmit={null}
        renderFormAsCompleted={false}
        userId={previewUserId}
        user={user}
        adminPreviewUserId={previewUserId}
        showVariableError
        initialPageIndex={initialPageIndex}
      />
    </PreviewBoundary>
  );
}
