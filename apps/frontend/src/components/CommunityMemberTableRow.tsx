import {
  CommunityMemberContactInfoDto,
  ProfileDto,
  UserActionRelationDetailDto,
  UserActionSummaryDto,
  UserAwayRangeDto,
} from "@alliance/shared/client";
import UserDisplayName from "./UserDisplayName";
import { useMemo, useState } from "react";
import UserProgressPills from "@alliance/shared/ui/UserProgressPills";
import ProfileImage from "@alliance/shared/ui/ProfileImage";
import DropdownIcon from "@alliance/shared/ui/icons/DropdownIcon";
import { Link, href } from "react-router";

const CommunityMemberTableRow = ({
  profile,
  canExpand = false,
  amLeader,
  contactInfo,
  actionRelations,
  actions,
}: {
  profile: ProfileDto;
  canExpand?: boolean;
  amLeader?: boolean;
  contactInfo?: CommunityMemberContactInfoDto;
  actions?: UserActionSummaryDto[];
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
        <td className="">
          <div className="flex flex-row items-center gap-x-1 md:gap-x-3">
            {canExpand && (
              <div className={`${expanded ? "" : "-rotate-90"}`}>
                <DropdownIcon size="mini" fill="black" />
              </div>
            )}
            <Link
              to={href("/member/:id", { id: profile.id.toString() })}
              className="flex-shrink-0"
            >
              <div className="hidden md:block">
                <ProfileImage pfp={profile.profilePicture} size="medium" />
              </div>
              <div className="md:hidden">
                <ProfileImage pfp={profile.profilePicture} size="mini" />
              </div>
            </Link>
            <Link
              to={href("/member/:id", { id: profile.id.toString() })}
              className="text-sm md:text-base min-[400px]:whitespace-nowrap mr-2 md:mr-6"
            >
              <UserDisplayName staff={profile.staff} underline={false}>
                <span
                  className={currentAwayRange ? "text-zinc-400" : undefined}
                >
                  {profile.displayName}
                  {currentAwayRange && " (away)"}
                </span>
              </UserDisplayName>
            </Link>
          </div>
        </td>
        <td className="w-full">
          <div>
            {!!actions && (
              <UserProgressPills
                actions={actions}
                relationByActionId={relationByActionId}
                pillHeight="h-4"
              />
            )}
          </div>
        </td>
        {amLeader && (
          <td className="w-px whitespace-nowrap text-sm md:text-base">
            <p>
              {contactInfo?.preferredReminderTimeLeaderTz
                ? contactInfo.preferredReminderTimeLeaderTz
                : "Anytime"}
            </p>
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
