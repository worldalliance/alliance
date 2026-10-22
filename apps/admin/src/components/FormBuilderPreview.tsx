import type { FormSchema } from "@alliance/common/forms/form-schema";
import { rowLabel, schemaForRow } from "@alliance/common/forms/row-list";
import { cn } from "@alliance/shared/styles/util";
import FormRenderer from "@alliance/sharedweb/forms/FormRenderer";
import { useMemo, useState } from "react";
import { FORM_BUILDER_PREVIEW_USER } from "../lib/testData";
import { useUsersAdmin } from "../lib/useUsersAdmin";
import { PreviewBoundary } from "./form-canvas/ElementBoundary";
import { PreviewAsUserBar } from "./PreviewAsUserBar";
import { inputText } from "./VariableSamples";

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

  const [rowIndex, setRowIndex] = useState(0);
  const list = schema.rowList;
  const previewRow = list?.rows[rowIndex] ?? list?.rows[0];
  const previewSchema = useMemo(
    () =>
      list === undefined ? schema : schemaForRow(schema, previewRow ?? {}),
    [schema, list, previewRow],
  );

  return (
    <div className="max-w-3xl mx-auto bg-white p-6">
      <PreviewAsUserBar
        previewUserId={previewUserId}
        setPreviewUserId={setPreviewUserId}
        previewUsers={previewUsers}
        isLoadingPreviewUsers={isLoadingPreviewUsers}
        previewUserError={previewUserError}
      />
      {list && list.rows.length > 0 && (
        <label className="mb-4 flex items-center gap-2 text-sm text-gray-700">
          Preview as row
          <select
            value={Math.min(rowIndex, list.rows.length - 1)}
            onChange={(event) => setRowIndex(Number(event.target.value))}
            className={cn(inputText, "bg-white w-auto")}
          >
            {list.rows.map((row, index) => (
              <option key={index} value={index}>
                {rowLabel(row, list.keyFields) || `Row ${index + 1}`}
              </option>
            ))}
          </select>
        </label>
      )}
      <PreviewBoundary resetKeys={[previewSchema, resolvedPreviewUserId]}>
        <FormRenderer
          key={resolvedPreviewUserId}
          id={0}
          formSnapshotId={null}
          actionId={0}
          form={previewSchema}
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
