import {
  TagDto,
  TagSummaryDto,
  UserAdminDetailDto,
} from "@alliance/shared/client/types.gen";
import { cn } from "@alliance/shared/styles/util";
import { useCallback, useEffect, useMemo, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";

export default function UserTagsSection({
  user,
  loadedTags,
  setTagMembership,
}: {
  user: UserAdminDetailDto;
  loadedTags: TagSummaryDto[];
  setTagMembership: (input: {
    tagId: string;
    member: boolean;
  }) => Promise<TagDto>;
}) {
  const [allTags, setAllTags] = useState<TagSummaryDto[]>(loadedTags);
  const [pendingTagOps, setPendingTagOps] = useState<Set<string>>(
    () => new Set(),
  );
  const [tagMutationError, setTagMutationError] = useState<string | null>(null);

  const sortedAllTags = useMemo(() => {
    return [...allTags].sort((a, b) => a.name.localeCompare(b.name));
  }, [allTags]);

  const userTagIds = useMemo(
    () => new Set((user.tags ?? []).map((tag) => tag.id)),
    [user.tags],
  );

  useEffect(() => {
    setAllTags(loadedTags);
  }, [loadedTags]);

  const userTags = useMemo(() => {
    return allTags.filter((tag) => userTagIds.has(tag.id));
  }, [allTags, userTagIds]);

  const tagKey = useCallback(
    (tagId: string) => `${user.id}-${tagId}`,
    [user.id],
  );

  const updateTagInState = useCallback((updatedTag: TagDto) => {
    const summary: TagSummaryDto = {
      id: updatedTag.id,
      name: updatedTag.name,
      description: updatedTag.description,
      publicDisplayName: updatedTag.publicDisplayName,
      createdAt: updatedTag.createdAt,
      updatedAt: updatedTag.updatedAt,
    };
    setAllTags((prev) => {
      const exists = prev.some((tag) => tag.id === summary.id);
      if (exists) {
        return prev.map((tag) => (tag.id === summary.id ? summary : tag));
      }
      return [...prev, summary];
    });
  }, []);

  const handleTagToggle = useCallback(
    async (tagId: string, nextChecked: boolean) => {
      const key = tagKey(tagId);
      setPendingTagOps((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      setTagMutationError(null);
      try {
        updateTagInState(
          await setTagMembership({ tagId, member: nextChecked }),
        );
      } catch (error) {
        console.error("Failed to update tag membership", error);
        setTagMutationError(
          adminRefusalMessage(
            error,
            "Failed to update tag membership. Try again.",
          ),
        );
      } finally {
        setPendingTagOps((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [setTagMembership, tagKey, updateTagInState],
  );

  return (
    <section className="border border-zinc-200 rounded p-3">
      <h2 className="text-sm font-semibold text-zinc-700 mb-2">
        Tags ({userTags.length})
      </h2>
      {tagMutationError && (
        <p className="text-xs text-red-500 mb-2">{tagMutationError}</p>
      )}
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {sortedAllTags.map((tag) => {
          const checked = userTagIds.has(tag.id);
          const pending = pendingTagOps.has(tagKey(tag.id));
          return (
            <label
              key={tag.id}
              className={cn(
                "flex items-center gap-2 text-sm cursor-pointer hover:bg-zinc-50 px-1 py-0.5 rounded",
                pending && "opacity-50",
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={pending}
                onChange={(e) => handleTagToggle(tag.id, e.target.checked)}
                className="rounded"
              />
              <span className={checked ? "text-zinc-900" : "text-zinc-500"}>
                {tag.name}
              </span>
            </label>
          );
        })}
        {sortedAllTags.length === 0 && (
          <p className="text-xs text-zinc-500">No tags available.</p>
        )}
      </div>
    </section>
  );
}
