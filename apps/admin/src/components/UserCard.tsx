import {
  TagDto,
  UserActionRelationDetailDto,
  UserActionSummaryDto,
  UserDto,
} from "@alliance/shared/client/types.gen";
import Card from "@alliance/sharedweb/ui/Card";
import ProfileImage from "@alliance/sharedweb/ui/ProfileImage";
import Badge from "@alliance/sharedweb/ui/Badge";
import { useOutsideClick } from "@alliance/sharedweb/lib/useOutsideClick";
import { useMemo, useState } from "react";
import DropdownIcon from "@alliance/sharedweb/ui/icons/DropdownIcon";
import DatabaseIcon from "@alliance/sharedweb/ui/icons/DatabaseIcon";
import { Link } from "react-router";
import UserProgressPills, {
  PILL_STATUS_DATA,
} from "@alliance/sharedweb/ui/UserProgressPills";
import { CardStyle } from "@alliance/shared/styles/card";

export interface UserCardProps {
  user: UserDto;
  timeSpent: number;
  timeSpentTotal: number;
  tags: TagDto[];
  allTags: TagDto[];
  onToggleTag: (tagId: number, nextChecked: boolean) => void | Promise<void>;
  isTagPending: (tagId: number) => boolean;
  actions: UserActionSummaryDto[];
  maxActionsPerWeek: Record<number, number> | null;
  actionRelations: UserActionRelationDetailDto[];
}

const UserCard = ({
  user,
  tags,
  allTags,
  onToggleTag,
  isTagPending,
  actions,
  maxActionsPerWeek,
  actionRelations,
}: UserCardProps) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isActionDetailsOpen, setIsActionDetailsOpen] = useState(false);
  const dropdownRef = useOutsideClick(() => setIsDropdownOpen(false));

  const relationByActionId = useMemo(() => {
    return actionRelations.reduce((acc, relation) => {
      acc[relation.actionId] = relation;
      return acc;
    }, {} as Record<number, UserActionRelationDetailDto>);
  }, [actionRelations]);

  const humanize = (value?: string) => {
    if (!value) {
      return undefined;
    }
    return value
      .split("_")
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ");
  };

  const sortedAllTags = useMemo(() => {
    return [...allTags].sort((a, b) => a.name.localeCompare(b.name));
  }, [allTags]);

  const tagIds = useMemo(() => new Set(tags.map((tag) => tag.id)), [tags]);

  const latestEvent = user.contractEvents?.length
    ? user.contractEvents.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0]
    : null;

  const contractStatusColor =
    latestEvent === null
      ? "text-zinc-500"
      : latestEvent.type === "signed"
      ? "text-green"
      : "text-red-500";

  const contractStatus =
    latestEvent === null
      ? "Not signed"
      : latestEvent.type === "signed"
      ? "Signed"
      : "Suspended";

  return (
    <Card style={CardStyle.White} className="flex-1 text-sm">
      <div className="flex flex-row items-center justify-between gap-x-3 border-b pb-2 mb-2 border-zinc-200">
        <div className="flex flex-row items-center gap-x-3">
          <ProfileImage pfp={user.profilePicture} size="large" />
          <Link to={`/member/${user.id}`} className="text-base">
            {user.name}
          </Link>
        </div>
        <Link to={`/database/?table=user&id=${user.id}`}>
          <DatabaseIcon size="small" />
        </Link>
      </div>
      <div className="flex flex-row items-center border-b pb-2 mb-2 border-zinc-200">
        <p>
          Contract status:{" "}
          <span className={`font-medium ${contractStatusColor}`}>
            {contractStatus}
          </span>
        </p>
      </div>
      <div className="border-b pb-2 mb-2 border-zinc-200">
        <div className="flex items-center justify-between">
          <p className="font-semibold">Tags</p>
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
              onClick={(event) => {
                event.stopPropagation();
                setIsDropdownOpen((open) => !open);
              }}
            >
              Manage
              <DropdownIcon size="mini" fill="#2563eb" />
            </button>
            {isDropdownOpen && (
              <div
                className="absolute right-0 z-20 mt-2 w-56 rounded border border-zinc-200 bg-white shadow"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="max-h-56 overflow-y-auto py-1">
                  {sortedAllTags.length ? (
                    sortedAllTags.map((tag) => {
                      const checked = tagIds.has(tag.id);
                      const pending = isTagPending(tag.id);
                      return (
                        <label
                          key={tag.id}
                          className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-50 ${
                            pending ? "opacity-60" : ""
                          }`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className="cursor-pointer"
                            checked={checked}
                            disabled={pending}
                            onChange={(event) => {
                              event.stopPropagation();
                              onToggleTag(tag.id, !checked);
                            }}
                          />
                          <div className="flex flex-col">
                            <span className="font-medium text-zinc-700">
                              {tag.name}
                            </span>
                            <span className="text-xs text-zinc-500 truncate max-w-[180px]">
                              {tag.description}
                            </span>
                          </div>
                        </label>
                      );
                    })
                  ) : (
                    <p className="px-3 py-2 text-sm text-zinc-500">
                      No tags available
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        {tags.length ? (
          <div className="flex flex-wrap gap-2 mt-2">
            {tags.map((tag) => (
              <Badge key={tag.id}>{tag.name}</Badge>
            ))}
          </div>
        ) : null}
      </div>
      {actions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold">Actions</p>
            <button
              type="button"
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
              onClick={(event) => {
                event.stopPropagation();
                setIsActionDetailsOpen((open) => !open);
              }}
            >
              {isActionDetailsOpen ? "Hide details" : "Show details"}
            </button>
          </div>
          <UserProgressPills
            actions={actions}
            maxActionsPerWeek={maxActionsPerWeek}
            relationByActionId={relationByActionId}
          />
          {isActionDetailsOpen && (
            <div className="mt-3 space-y-2">
              {actions.map((action) => {
                const relation = relationByActionId[action.id];
                const { pillLabel, pillTextStyle } =
                  PILL_STATUS_DATA[relation.status];
                const isWontComplete = relation.status === "wont_complete";
                return (
                  <div
                    key={action.id}
                    className="rounded border border-zinc-200 bg-zinc-50 p-2"
                  >
                    <div className="flex items-start justify-between gap-2 text-sm">
                      <span className="font-medium text-zinc-700">
                        {action.name}
                      </span>
                      <span
                        className={`font-semibold text-nowrap ${pillTextStyle}`}
                      >
                        {pillLabel}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-col gap-1 text-xs text-zinc-500">
                      <span>
                        Action status:{" "}
                        {humanize(action.status) ?? action.status}
                      </span>
                      {isWontComplete && (
                        <>
                          {relation.declineReason && (
                            <span>Reason: {relation.declineReason}</span>
                          )}
                          {relation.isMoral && (
                            <span className="text-amber-600">
                              Moral objection
                            </span>
                          )}
                          {relation.outOfTime && (
                            <span className="text-orange-600">Out of time</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

export default UserCard;
