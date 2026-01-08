import { useMemo, useState } from "react";
import { Link, href } from "react-router";
import {
  CommunityMemberContactInfoDto,
  ProfileDto,
  UserActionRelationDetailDto,
  UserActionSummaryDto,
  UserAwayRangeDto,
} from "@alliance/shared/client";
import ProfileImage from "./ProfileImage";
import UserProgressPills from "./UserProgressPills";
import DropdownIcon from "./icons/DropdownIcon";
import UserDisplayName from "./UserDisplayName";

const CommunityMemberTableRow = ({
  profile,
  canExpand = false,
  amLeader,
  contactInfo,
  actionRelations,
  actions,
  maxActionsPerWeek,
}: {
  profile: ProfileDto;
  canExpand?: boolean;
  amLeader?: boolean;
  contactInfo?: CommunityMemberContactInfoDto;
  actions: UserActionSummaryDto[];
  maxActionsPerWeek: Record<number, number> | null;
  actionRelations: UserActionRelationDetailDto[];
}) => {
  const relationByActionId = useMemo(() => {
    return actionRelations.reduce((acc, relation) => {
      acc[relation.actionId] = relation;
      return acc;
    }, {} as Record<number, UserActionRelationDetailDto>);
  }, [actionRelations]);

  const [expanded, setExpanded] = useState(false);
  const sortedAwayRanges = useMemo(() => {
    if (!contactInfo?.awayRanges) {
      return [];
    }
    return [...contactInfo.awayRanges].sort(
      (a, b) =>
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );
  }, [contactInfo?.awayRanges]);

  const currentAwayRange = useMemo(() => {
    const now = new Date();
    return (
      sortedAwayRanges.find((range) => {
        const start = new Date(range.startDate);
        const end = new Date(range.endDate);
        return start <= now && now <= end;
      }) ?? null
    );
  }, [sortedAwayRanges]);

  const upcomingOrCurrentAwayRanges = useMemo(() => {
    const now = new Date();
    return sortedAwayRanges.filter((range) => new Date(range.endDate) >= now);
  }, [sortedAwayRanges]);

  const formatAwayRange = (range: UserAwayRangeDto) => {
    const start = new Date(range.startDate);
    const end = new Date(range.endDate);

    const formatDate = (date: Date) =>
      date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });

    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  const formatAwayReason = (reason?: string) =>
    reason ? reason.charAt(0).toUpperCase() + reason.slice(1) : "";

  return (
    <>
      <tr
        className={`*:py-4 *:px-2 *:md:px-4 bg-white ${
          canExpand ? "hover:bg-zinc-50 cursor-pointer" : ""
        }`}
        onClick={canExpand ? () => setExpanded(!expanded) : undefined}
      >
        <td>
          <div className="flex flex-row items-center gap-x-1 md:gap-x-3">
            {canExpand && (
              <div className={`${expanded ? "" : "-rotate-90"}`}>
                <DropdownIcon size="mini" fill="black" />
              </div>
            )}
            <Link
              to={href("/member/:id", { id: profile.id.toString() })}
              className="flex-shrink-0 group flex items-center gap-x-1 md:gap-x-2 mr-3 text-ellipsis overflow-hidden line-clamp-2 wrap-words w-full"
            >
              <div className="hidden md:flex shrink-0 items-center justify-center">
                <ProfileImage pfp={profile.profilePicture} size="medium" />
              </div>
              <div className="md:hidden shrink-0 flex items-center justify-center">
                <ProfileImage pfp={profile.profilePicture} size="mini" />
              </div>
              <UserDisplayName
                staff={profile.staff}
                underline={false}
                className={`${
                  currentAwayRange ? "text-zinc-400" : undefined
                } group-hover:underline`}
              >
                {profile.displayName}
                {currentAwayRange && " (away)"}
              </UserDisplayName>
            </Link>
          </div>
        </td>
        <td>
          <div>
            {actions && (
              <UserProgressPills
                actions={actions}
                maxActionsPerWeek={maxActionsPerWeek}
                relationByActionId={relationByActionId}
                pillHeight="h-4"
              />
            )}
          </div>
        </td>
        {amLeader && (
          <td className="w-px whitespace-nowrap text-sm md:text-base table-cell">
            <p>{contactInfo?.preferredReminderTimeLeaderTz || "Anytime"}</p>
          </td>
        )}
      </tr>
      {expanded && (
        <tr>
          <td colSpan={3}>
            {!!contactInfo && (
              <div className="px-4 pt-2 pb-6">
                <div className="flex flex-col gap-y-3">
                  <p>
                    <span className="font-semibold">Email:</span>{" "}
                    {contactInfo.email}
                  </p>
                  <p>
                    <span className="font-semibold">Phone:</span>{" "}
                    {contactInfo.phoneNumber ?? (
                      <span className="text-zinc-500">Not provided</span>
                    )}
                  </p>
                  <p>
                    <span className="font-semibold">Time zone:</span>{" "}
                    {contactInfo.timeZone ?? (
                      <span className="text-zinc-500">Not provided</span>
                    )}
                  </p>
                  {contactInfo.preferredReminderTimeUserTz ===
                  contactInfo.preferredReminderTimeLeaderTz ? (
                    <p>
                      <span className="font-semibold">
                        Preferred contact time:
                      </span>{" "}
                      {contactInfo.preferredReminderTimeUserTz ?? "Anytime"} in
                      your time zone
                    </p>
                  ) : (
                    <div>
                      <p>
                        <span className="font-semibold">
                          Preferred contact time:
                        </span>
                      </p>
                      <p>
                        {contactInfo.preferredReminderTimeUserTz ?? "Anytime"}
                        <span className="text-zinc-500">
                          {" "}
                          in {profile.displayName}&apos;s time zone
                        </span>
                      </p>
                      <p>
                        {contactInfo.preferredReminderTimeLeaderTz ?? "Anytime"}
                        <span className="text-zinc-500">
                          {" "}
                          in your time zone
                        </span>
                      </p>
                    </div>
                  )}
                  {!!upcomingOrCurrentAwayRanges.length && (
                    <div className="flex flex-col gap-y-2 border-t border-zinc-200 pt-3">
                      <p className="font-semibold">Away ranges</p>
                      <div className="flex flex-col gap-y-2 text-sm text-zinc-700">
                        {upcomingOrCurrentAwayRanges.map((range) => (
                          <div
                            key={range.id}
                            className="flex flex-col gap-y-0.5"
                          >
                            <p>
                              {formatAwayRange(range)}
                              {currentAwayRange?.id === range.id
                                ? " (current)"
                                : ""}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {formatAwayReason(range.reason)}
                              {range.note ? ` — ${range.note}` : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
};

export default CommunityMemberTableRow;
