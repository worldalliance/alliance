import { memberConditions } from "@alliance/common/forms/form-conditions";
import type { FormSchema } from "@alliance/common/forms/form-schema";
import { tasksVisibilityProfilesAdmin } from "@alliance/shared/client";
import { statusError } from "@alliance/shared/lib/hey-api";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { adminRefusalMessage } from "./adminRefusal";

const SETTLE_MS = 500;

/**
 * `userIds` grouped by how each of the schema's `memberConditions` comes out
 * for them, largest group first. The returned conditions and members are the
 * ones the groups answer, which lag the arguments until an edit settles.
 */
export function useVisibilityProfilesAdmin(params: {
  schema: FormSchema;
  userIds: readonly number[];
}) {
  const { schema, userIds } = params;
  const conditions = useMemo(() => memberConditions(schema), [schema]);
  const sortedIds = useMemo(
    () => [...new Set(userIds)].sort((a, b) => a - b),
    [userIds],
  );
  const conditionsKey = JSON.stringify(conditions);
  const [settled, setSettled] = useState({
    schema,
    conditions,
    conditionsKey,
    sortedIds,
  });
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setSettled((prev) =>
          prev.conditionsKey === conditionsKey &&
          prev.sortedIds.join() === sortedIds.join()
            ? prev
            : { schema, conditions, conditionsKey, sortedIds },
        ),
      SETTLE_MS,
    );
    return () => clearTimeout(timer);
  }, [schema, conditions, conditionsKey, sortedIds]);
  const query = useQuery({
    queryKey: queryKeys.visibilityProfilesAdmin(
      settled.conditionsKey,
      settled.sortedIds,
    ),
    queryFn: async () => {
      const response = await tasksVisibilityProfilesAdmin({
        body: { schema: settled.schema, userIds: settled.sortedIds },
      });
      if (response.error || !response.data) {
        throw statusError(
          adminRefusalMessage(
            response.error,
            "Couldn't group members by what they see.",
          ),
          response.response,
        );
      }
      return response.data.profiles;
    },
    // In `select`, whose errors aren't retried: a retry can't fix a mismatch.
    select: (profiles) => {
      if (
        profiles.some(
          ({ results }) => results.length !== settled.conditions.length,
        )
      ) {
        throw new Error(
          "The server grouped members by different conditions than this form has. Reload the page.",
        );
      }
      return profiles;
    },
    enabled: settled.conditions.length > 0 && settled.sortedIds.length > 0,
    staleTime: 60_000,
  });
  return {
    conditions: settled.conditions,
    userIds: settled.sortedIds,
    ...query,
  };
}
