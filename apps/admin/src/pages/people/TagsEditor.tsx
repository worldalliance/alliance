import type { TagDto } from "@alliance/shared/client/types.gen";
import { useMemo } from "react";
import { CheckboxMenu } from "../../ui/CheckboxMenu";
import type { TagMembership } from "./useTagMembership";

/**
 * A member's tags as a checkbox menu, every tag by name: checking one adds the
 * member at once, unchecking takes them off.
 */
export function TagsEditor({
  userId,
  memberName,
  tags,
  memberTagIds,
  membership,
}: {
  userId: number;
  memberName: string;
  tags: readonly TagDto[];
  memberTagIds: ReadonlySet<string>;
  membership: TagMembership;
}) {
  const items = useMemo(
    () =>
      [...tags]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((tag) => ({
          value: tag.id,
          label: tag.name,
          description: tag.description,
          checked: memberTagIds.has(tag.id),
          pending: membership.isPending(userId, tag.id),
        })),
    [tags, memberTagIds, membership, userId],
  );
  return (
    <CheckboxMenu
      label="Edit tags"
      ariaLabel={`Edit tags: ${memberName}`}
      title={`Tags of ${memberName}`}
      items={items}
      emptyText="No tags yet."
      onToggle={(tagId, checked) =>
        void membership.toggle({ userId, memberName, tagId, add: checked })
      }
    />
  );
}
