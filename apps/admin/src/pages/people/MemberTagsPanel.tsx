import type { TagDto, UserAdminDetailDto } from "@alliance/shared/client/types.gen";
import { useMemo, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatCount } from "../../lib/formatNumber";
import { useTagsAdmin } from "../../lib/useTagsAdmin";
import InlineError from "../../ui/InlineError";
import { Skeleton } from "../../ui/Skeleton";
import { Switch } from "../../ui/Switch";
import { Panel } from "../../ui/templates/Overview";
import { ContentState } from "../../ui/templates/States";

/** Every tag, switched on for the ones the member has; each saves at once. */
export function MemberTagsPanel({
  user,
  setTagMembership,
}: {
  user: UserAdminDetailDto;
  setTagMembership: (input: { tagId: string; member: boolean }) => Promise<TagDto>;
}) {
  const { summaries } = useTagsAdmin({ enabled: false, summariesEnabled: true });
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const tags = useMemo(
    () => [...(summaries.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [summaries.data],
  );
  const theirs = useMemo(
    () => new Set((user.tags ?? []).map((tag) => tag.id)),
    [user.tags],
  );

  const toggle = async (tagId: string, member: boolean) => {
    setError(null);
    setPending((current) => new Set(current).add(tagId));
    try {
      await setTagMembership({ tagId, member });
    } catch (caught) {
      setError(adminRefusalMessage(caught, "Couldn't change the member's tags."));
    } finally {
      setPending((current) => {
        const rest = new Set(current);
        rest.delete(tagId);
        return rest;
      });
    }
  };

  return (
    <Panel
      title="Tags"
      description={formatCount(theirs.size)}
    >
      <ContentState
        things="tags"
        query={summaries}
        skeleton={
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-5 w-48" />
            ))}
          </div>
        }
        empty={tags.length === 0}
        emptyTitle="No tags yet"
        emptyDescription="Tags are created under Members › Tags."
      >
        <ul className="grid grid-cols-1 gap-x-6 gap-y-3 @2xl:grid-cols-2">
          {tags.map((tag) => (
            <li key={tag.id}>
              <label className="flex min-w-0 items-center gap-3">
                <Switch
                  checked={theirs.has(tag.id)}
                  disabled={pending.has(tag.id)}
                  onCheckedChange={(next) => void toggle(tag.id, next)}
                />
                <span className="truncate" title={tag.name}>
                  {tag.name}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <InlineError message={error} className="mt-3" />
      </ContentState>
    </Panel>
  );
}
