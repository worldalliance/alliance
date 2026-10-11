import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo } from "react";
import {
  tasksGetResponseSnapshotMigrationAdmin,
  tasksMigrateResponseSnapshotsAdmin,
} from "../client";
import type { MigrateResponseSnapshotsDto } from "../client/types.gen";
import { queryKeys } from "./queryKeys";

export function useResponseSnapshotMigrationAdmin(formId: number | undefined) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => queryKeys.responseSnapshotMigrationAdmin(formId ?? null),
    [formId],
  );

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn:
      formId === undefined
        ? skipToken
        : () =>
            tasksGetResponseSnapshotMigrationAdmin({
              path: { formId },
              throwOnError: true,
            }).then((res) => res.data),
  });

  const migrate = useMutation({
    mutationFn: (body: MigrateResponseSnapshotsDto) => {
      if (formId === undefined) throw new Error("No form to migrate");
      return tasksMigrateResponseSnapshotsAdmin({
        path: { formId },
        body,
        throwOnError: true,
      }).then((res) => res.data.updatedCount);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { data, isLoading, isError, migrate };
}
