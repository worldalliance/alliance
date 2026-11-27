import { useCallback, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useTagsAdmin } from "../../lib/useTagsAdmin";
import { SAVE_FAILED_FALLBACK } from "../../ui/templates/Form";

/**
 * Adding a member to a tag or taking them off it, at once. A change in flight
 * is pending by member and tag; a failed one leaves the tag list as the server
 * has it and keeps its reason until dismissed or the next change succeeds.
 */
export function useTagMembership(tagsAdmin: ReturnType<typeof useTagsAdmin>) {
  const { addUserToTag, removeUserFromTag } = tagsAdmin;
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const toggle = useCallback(
    async ({
      userId,
      memberName,
      tagId,
      add,
    }: {
      userId: number;
      memberName: string;
      tagId: string;
      add: boolean;
    }) => {
      const key = `${userId}-${tagId}`;
      setPending((prev) => new Set(prev).add(key));
      const mutation = add ? addUserToTag : removeUserFromTag;
      try {
        await mutation.mutateAsync({ tagId, body: { userId } });
        setError(null);
      } catch (thrown) {
        setError(
          `Couldn't update the tags of ${memberName}. ${adminRefusalMessage(thrown, SAVE_FAILED_FALLBACK)}`,
        );
      } finally {
        setPending((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [addUserToTag, removeUserFromTag],
  );
  return {
    toggle,
    isPending: (userId: number, tagId: string) =>
      pending.has(`${userId}-${tagId}`),
    error,
    dismissError: () => setError(null),
  };
}

export type TagMembership = ReturnType<typeof useTagMembership>;
