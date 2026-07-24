import type { FormSchema } from "@alliance/common/forms/form-schema";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { userMyVisibilityContext } from "../client";
import { schemaNeedsVisibilityContext } from "../formrenderer";
import { queryKeys } from "./queryKeys";

export type VisibilityContext = {
  userHasCity: boolean;
  firstContractSignedAt: string | null;
  isLoading: boolean;
};

/**
 * The viewer's account-derived values consumed by form visibility conditions
 * (`userHasCity`, `firstContractSigned`), fetched from
 * `GET /user/myvisibilitycontext` — the same values the server uses when
 * stripping hidden answers at submission. Only fetches when the schema
 * actually contains such a condition and `enabled` is true (pass the presence
 * of a logged-in user); otherwise returns defaults without a request, which
 * match the guest/never-signed evaluation semantics.
 */
export function useVisibilityContext(
  schema: FormSchema,
  { enabled }: { enabled: boolean },
): VisibilityContext {
  const needsContext = useMemo(
    () => schemaNeedsVisibilityContext(schema),
    [schema],
  );

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.myVisibilityContext(),
    queryFn: async () => {
      const response = await userMyVisibilityContext();
      if (response.error) {
        throw response.error;
      }
      return response.data ?? null;
    },
    enabled: enabled && needsContext,
  });

  return useMemo(
    () => ({
      userHasCity: data?.userHasCity ?? false,
      firstContractSignedAt: data?.firstContractSignedAt ?? null,
      isLoading,
    }),
    [data, isLoading],
  );
}
