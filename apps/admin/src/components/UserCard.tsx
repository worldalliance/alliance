import {
  TagDto,
  UserActionRelationDetailDto,
  UserActionSummaryDto,
  UserActionRelationStatus,
  UserDto,
} from "@alliance/shared/client/types.gen";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import ProfileImage from "@alliance/shared/ui/ProfileImage";
import { Duration, formatDuration, intervalToDuration } from "date-fns";
import Badge from "@alliance/shared/ui/Badge";
import { useOutsideClick } from "@alliance/shared/lib/useOutsideClick";
import { useMemo, useState } from "react";
import DropdownIcon from "@alliance/shared/ui/icons/DropdownIcon";
import DatabaseIcon from "@alliance/shared/ui/icons/DatabaseIcon";
import { Link } from "react-router";
import UserProgressPills, {
  formatRelationStatus,
} from "@alliance/shared/ui/UserProgressPills";

export interface UserCardProps {
  user: UserDto;
  timeSpent: number;
  timeSpentTotal: number;
  tags: TagDto[];
  allTags: TagDto[];
  onToggleTag: (tagId: number, nextChecked: boolean) => void | Promise<void>;
  isTagPending: (tagId: number) => boolean;
  actions: UserActionSummaryDto[];
  actionRelations: UserActionRelationDetailDto[];
}

const UserCard = ({
  user,
  timeSpent,
  timeSpentTotal,
  tags,
  allTags,
  onToggleTag,
  isTagPending,
  actions,
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

  const relationStatusColor = (status: UserActionRelationStatus) => {
    switch (status) {
      case "completed":
        return "text-green";
      case "joined":
        return "text-blue-600";
      case "declined":
        return "text-amber-600";
      case "missed_deadline":
        return "text-red-600";
      case "wont_complete":
        return "text-red-600";
      case "none":
        return "text-zinc-500";
      default:
        throw new Error(`Invalid filter mode: ${status satisfies never}`);
    }
  };

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

  const formatTime = (time: number) => {
    const interval = intervalToDuration({ start: 0, end: time * 1000 });
    const formatUnits: (keyof Duration)[] =
      interval.minutes || interval.hours || interval.days
        ? ["hours", "minutes"]
        : ["hours", "minutes", "seconds"];
    return formatDuration(interval, {
      format: formatUnits,
    })
      .replace(" hours", "h")
      .replace(" minutes", "m")
      .replace(" seconds", "s");
  };

  const time = formatTime(timeSpent);
  const timeTotal = formatTime(timeSpentTotal);

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
        <div className="border-b pb-2 mb-2 border-zinc-200">
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
            relationByActionId={relationByActionId}
          />
          {isActionDetailsOpen && (
            <div className="mt-3 space-y-2">
              {actions.map((action) => {
                const relation = relationByActionId[action.id] ?? {
                  status: "none",
                };
                const statusLabel = formatRelationStatus(relation.status);
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
                        className={`font-semibold text-nowrap ${relationStatusColor(
                          relation?.status
                        )}`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-col gap-1 text-xs text-zinc-500">
                      <span>
                        Action status:{" "}
                        {humanize(action.status) ?? action.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      <div>
        <p className="font-semibold ">Activity</p>
        <div className="flex flex-row justify-between ">
          <p className="text-zinc-500">Last 7 days</p>
          <p className={`${!time && "text-zinc-500"}`}>{time || "0"}</p>
        </div>
        <div className="flex flex-row justify-between ">
          <p className="text-zinc-500">Total</p>
          <p className={`${!timeTotal && "text-zinc-500"}`}>
            {timeTotal || "0"}
          </p>
        </div>
      </div>
    </Card>
  );
};

export default UserCard;
