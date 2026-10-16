import type { FormSchema } from "@alliance/common/forms/form-schema";
import FormRenderer from "@alliance/sharedweb/forms/FormRenderer";
import { useMemo } from "react";
import { FORM_BUILDER_PREVIEW_USER } from "../lib/testData";
import { useUsersAdmin } from "../lib/useUsersAdmin";
import { PreviewBoundary } from "./form-canvas/ElementBoundary";
import { PreviewAsUserBar } from "./PreviewAsUserBar";

export function FormBuilderPreview({
  schema,
  pageIndex,
  previewUserId,
  setPreviewUserId,
}: {
  schema: FormSchema;
  pageIndex: number;
  previewUserId: string;
  setPreviewUserId: (previewUserId: string) => void;
}) {
  const previewUsersQuery = useUsersAdmin();
  const previewUsers = useMemo(
    () => previewUsersQuery.data ?? [],
    [previewUsersQuery.data],
  );
  const isLoadingPreviewUsers = previewUsersQuery.isLoading;
  const previewUserError = previewUsersQuery.isLoadingError
    ? "Could not load users"
    : null;
  const resolvedPreviewUser = useMemo(() => {
    if (previewUserId === "preview") {
      return FORM_BUILDER_PREVIEW_USER;
    }
    const match = previewUsers.find(
      (candidate) => String(candidate.id) === previewUserId,
    );
    return match ?? FORM_BUILDER_PREVIEW_USER;
  }, [previewUserId, previewUsers]);
  const resolvedPreviewUserId =
    previewUserId === "preview"
      ? "preview"
      : (resolvedPreviewUser?.id ?? "preview");

  return (
    <div className="max-w-3xl mx-auto bg-white p-6">
      <PreviewAsUserBar
        previewUserId={previewUserId}
        setPreviewUserId={setPreviewUserId}
        previewUsers={previewUsers}
        isLoadingPreviewUsers={isLoadingPreviewUsers}
        previewUserError={previewUserError}
      />
      <PreviewBoundary resetKeys={[schema, resolvedPreviewUserId]}>
        <FormRenderer
          key={resolvedPreviewUserId}
          id={0}
          formSnapshotId={null}
          actionId={0}
          form={schema}
          onSubmit={null}
          renderFormAsCompleted={false}
          userId={resolvedPreviewUserId}
          user={resolvedPreviewUser}
          adminPreviewUserId={resolvedPreviewUserId}
          showVariableError
          initialPageIndex={pageIndex}
        />
      </PreviewBoundary>
    </div>
  );
}
