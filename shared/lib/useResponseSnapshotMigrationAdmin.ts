import {
  queryOptions,
  skipToken,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { milliseconds } from "date-fns";
import { useMemo } from "react";
import {
  tasksGetResponseSnapshotMigrationAdmin,
  tasksMigrateResponseSnapshotsAdmin,
} from "../client";
import type {
  FormSnapshotMigrationDto,
  MigrateResponseSnapshotsDto,
} from "../client/types.gen";
import { queryKeys } from "./queryKeys";

const responseSnapshotMigrationQuery = (formId: number | undefined) =>
  queryOptions({
    queryKey: queryKeys.responseSnapshotMigrationAdmin(formId ?? null),
    queryFn:
      formId === undefined
        ? skipToken
        : () =>
            tasksGetResponseSnapshotMigrationAdmin({
              path: { formId },
              throwOnError: true,
            }).then((res) => res.data),
  });

export function useResponseSnapshotMigrationAdmin(formId: number | undefined) {
  const queryClient = useQueryClient();
  const query = useMemo(() => responseSnapshotMigrationQuery(formId), [formId]);

  const { data, isLoading, isError } = useQuery(query);

  const migrate = useMutation({
    mutationFn: (body: MigrateResponseSnapshotsDto) => {
      if (formId === undefined) throw new Error("No form to migrate");
      return tasksMigrateResponseSnapshotsAdmin({
        path: { formId },
        body,
        throwOnError: true,
      }).then((res) => res.data.updatedCount);
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: query.queryKey }),
  });

  return { data, isLoading, isError, migrate };
}

const combineMigrations = (
  results: UseQueryResult<FormSnapshotMigrationDto>[],
) => ({
  migrations: results.flatMap((result) => (result.data ? [result.data] : [])),
  isPending: results.some((result) => result.isPending),
  isError: results.some((result) => result.isError),
});

export function useResponseSnapshotMigrationsAdmin(
  formIds: readonly number[],
  params: { enabled: boolean },
) {
  return useQueries({
    queries: formIds.map((formId) => ({
      ...responseSnapshotMigrationQuery(formId),
      enabled: params.enabled,
      staleTime: milliseconds({ minutes: 1 }),
    })),
    combine: combineMigrations,
  });
}
