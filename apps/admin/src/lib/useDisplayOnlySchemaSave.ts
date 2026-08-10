import {
  displayOnlyToFormSchema,
  formSchemaToDisplayOnly,
  readDisplayOnlySchema,
  readDisplayOnlySchemaError,
  type DisplayOnlySchema,
} from "@alliance/common/forms/display-only-schema";
import { R } from "@alliance/common/result";
import type { HeyApiError } from "@alliance/shared/client";
import { useCallback } from "react";
import type { DisplayOnlySave } from "../components/FormBuilder";

export type DisplayOnlySchemaOwner = {
  schema: { [key: string]: unknown };
  schemaSnapshotId: number;
};

type AdminFetchResult<T> = {
  data?: T;
  error?: HeyApiError;
  response: Response;
};

export type DisplayOnlySchemaSaveBody = {
  schema: DisplayOnlySchema;
  expectedSchemaSnapshotId: number;
};

const errorMessage = (error: HeyApiError | undefined): string | undefined => {
  const message = error?.message;
  return Array.isArray(message) ? message.join("; ") : message;
};

/**
 * The block editor's save path, shared by every owner of a display-only schema.
 *
 * The 409 branch is the reason this is worth sharing: the editor can only merge
 * a conflict if it is handed the other side's schema *and* the snapshot id that
 * schema came from, so a conflict has to be answered with a refetch rather than
 * an error.
 */
export function useDisplayOnlySchemaSave<
  T extends DisplayOnlySchemaOwner,
>(params: {
  ownerLabel: string;
  save: (body: DisplayOnlySchemaSaveBody) => Promise<AdminFetchResult<T>>;
  refetch: () => Promise<AdminFetchResult<T>>;
  onSaved: (owner: T) => void;
}): DisplayOnlySave {
  const { ownerLabel, save, refetch, onSaved } = params;

  return useCallback<DisplayOnlySave>(
    async ({ schema, expectedSnapshotId }) => {
      if (expectedSnapshotId === null) {
        throw new Error("Missing the snapshot this edit was built on");
      }
      const notDisplayOnly = (issues: string[]) =>
        `${ownerLabel} can only hold display-only content — ${issues.join("; ")}`;

      const converted = formSchemaToDisplayOnly(schema);
      if (R.isFailure(converted)) {
        throw new Error(notDisplayOnly(converted.error));
      }

      const response = await save({
        schema: converted.value,
        expectedSchemaSnapshotId: expectedSnapshotId,
      });

      if (response.response.status === 409) {
        const latest = await refetch();
        const theirs = latest.data && readDisplayOnlySchema(latest.data.schema);
        if (!latest.data || !theirs) {
          throw new Error("This update was changed by someone else");
        }
        onSaved(latest.data);
        return R.failure({
          theirs: displayOnlyToFormSchema(theirs),
          theirsSnapshotId: latest.data.schemaSnapshotId,
        });
      }

      if (!response.data) {
        const rejected = readDisplayOnlySchemaError(response.error);
        if (rejected) throw new Error(notDisplayOnly(rejected));
        throw new Error(
          errorMessage(response.error) ?? "Failed to save content",
        );
      }

      onSaved(response.data);
      return R.success({ snapshotId: response.data.schemaSnapshotId });
    },
    [ownerLabel, save, refetch, onSaved],
  );
}
