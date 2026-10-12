import { withCount } from "@alliance/common/plural";
import { CommunityDto } from "@alliance/shared/client";
import { getMemberCount, isLedBy } from "@alliance/shared/lib/communityUtils";
import { onetimeInviteCreation } from "@alliance/shared/lib/copy";
import type { InvitePlacement } from "@alliance/shared/lib/useInvitePlacement";
import AppMarkdownWrapper from "@alliance/sharedweb/ui/AppMarkdownWrapper";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import DropdownSelect from "@alliance/sharedweb/ui/DropdownSelect";
import { ExternalLink } from "lucide-react";
import { useMemo, type RefObject } from "react";
import { Link } from "react-router";
import { useAuth } from "../lib/AuthContext";
import CommunityCreateForm from "./CommunityCreateForm";

const inviteSectionLabelClass = "text-lg font-semibold text-zinc-900";
const inviteStrongClass = "text-base font-semibold text-zinc-900";

type InviteFormGroupStepProps = {
  communities: CommunityDto[];
  leaderCommunities: CommunityDto[];
  placement: InvitePlacement;
  setPlacement: (placement: InvitePlacement) => void;
  selectedCommunity: CommunityDto | null;
  createDisabled: boolean;
  onCreateCommunity: (community: CommunityDto) => Promise<void>;
  communityCreateSubmitRef: RefObject<(() => Promise<void>) | null>;
};

const InviteFormGroupStep = ({
  communities,
  leaderCommunities,
  placement,
  setPlacement,
  selectedCommunity,
  createDisabled,
  onCreateCommunity,
  communityCreateSubmitRef,
}: InviteFormGroupStepProps) => {
  const { user } = useAuth();

  const memberCommunities = useMemo(
    () =>
      user
        ? communities.filter((community) => !isLedBy(community, user.id))
        : [],
    [communities, user],
  );

  const isLeader = leaderCommunities.length > 0;

  const communityOptions = useMemo(() => {
    return {
      ...Object.fromEntries(
        leaderCommunities.map((community) => [
          `c${community.id}`,
          community.name,
        ]),
      ),
      assign: onetimeInviteCreation.assignToOpenGroup,
      new: onetimeInviteCreation.createNewGroupOption,
    } as Record<string, string>;
  }, [leaderCommunities]);

  const dropdownSelectedLabel = useMemo(() => {
    if (placement.kind === "assign") {
      return communityOptions.assign;
    }
    if (placement.kind === "new") {
      return communityOptions.new;
    }
    return (
      communityOptions[`c${placement.id}`] ??
      onetimeInviteCreation.createNewGroupOption
    );
  }, [placement, communityOptions]);

  const {
    memberCommunityAllowsMemberInvites,
    memberCommunityRemainingCapacity,
  } =
    !memberCommunities.length ||
    !memberCommunities[0].allowMemberInvites ||
    memberCommunities[0].maxCapacity === null
      ? {
          memberCommunityAllowsMemberInvites: false,
          memberCommunityRemainingCapacity: 0,
        }
      : {
          memberCommunityAllowsMemberInvites: true,
          memberCommunityRemainingCapacity:
            memberCommunities[0].maxCapacity -
            getMemberCount(memberCommunities[0]),
        };

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex flex-col gap-y-4">
        <p className={inviteSectionLabelClass}>
          {onetimeInviteCreation.responsible.leader.title}
        </p>
        <p className="text-invite-form-body">
          {onetimeInviteCreation.groupContext}
        </p>
        <DropdownSelect
          options={communityOptions}
          value={dropdownSelectedLabel}
          onChange={([key]) => {
            const k = String(key);
            if (k === "assign") {
              setPlacement({ kind: "assign" });
            } else if (k === "new") {
              setPlacement({ kind: "new" });
            } else if (k.startsWith("c")) {
              setPlacement({
                kind: "community",
                id: Number(k.slice(1)),
              });
            }
          }}
          titleOverride={dropdownSelectedLabel}
          dropdownWidth="medium"
        />
      </div>

      {placement.kind === "assign" && (
        <div className="flex flex-col gap-y-4">
          {!memberCommunityAllowsMemberInvites ? (
            <AppMarkdownWrapper
              className="text-invite-form-body"
              markdownContent={onetimeInviteCreation.not_responsible.explanations.genericGroup.join(
                "\n\n",
              )}
            />
          ) : memberCommunityRemainingCapacity > 0 ? (
            <>
              <AppMarkdownWrapper
                className="text-invite-form-body"
                markdownContent={onetimeInviteCreation.not_responsible.explanations.yourGroup.join(
                  "\n\n",
                )}
              />
              <div className="border border-zinc-200 bg-white rounded px-3 py-2.5 flex flex-col gap-y-2 self-start max-w-full">
                <div className="flex flex-row items-center justify-between gap-x-4">
                  <p className={inviteSectionLabelClass}>Your current group</p>
                  <Link
                    to={`/groups?communityId=${memberCommunities[0].id}`}
                    target="_blank"
                    aria-label={`Open ${memberCommunities[0].name} in a new tab`}
                    className="text-zinc-400 hover:text-zinc-700 shrink-0"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>
                <div className="flex flex-row items-center gap-x-2 min-w-0">
                  <AvatarProfile
                    pfp={memberCommunities[0].photo ?? null}
                    size="small"
                  />
                  <div className="flex flex-col min-w-0 sm:flex-row sm:items-baseline sm:gap-x-2">
                    <p className={`${inviteStrongClass} truncate`}>
                      {memberCommunities[0].name}
                    </p>
                    <p className="text-invite-form-body shrink-0">
                      {withCount(memberCommunityRemainingCapacity, "open seat")}
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <AppMarkdownWrapper
              className="text-invite-form-body"
              markdownContent={onetimeInviteCreation.not_responsible.explanations.yourGroupNoCapacity.join(
                "\n\n",
              )}
            />
          )}
        </div>
      )}

      {placement.kind === "new" && (
        <div className="flex flex-col gap-y-4">
          <AppMarkdownWrapper
            className="text-invite-form-body"
            markdownContent={onetimeInviteCreation.responsible.leader.invite.explanation.join(
              "\n\n",
            )}
          />
          <p className={inviteSectionLabelClass}>
            {onetimeInviteCreation.responsible.leader.newGroup.title}
          </p>
          {!isLeader && (
            <p className="text-invite-form-body">
              You are not leading a group yet—create one to be responsible for
              this member.
            </p>
          )}
          <p className="text-invite-form-body">
            Read our{" "}
            <Link to="/groups-guide" className="text-green hover:underline">
              groups guide
            </Link>{" "}
            to learn how to lead a group.
          </p>
          <CommunityCreateForm
            name={user?.name}
            createDisabled={createDisabled}
            onSuccess={onCreateCommunity}
            includePhotoEditor={false}
            hideSubmitButton
            submitRef={communityCreateSubmitRef}
          />
        </div>
      )}

      {placement.kind === "community" && selectedCommunity && (
        <AppMarkdownWrapper
          className="text-invite-form-body"
          markdownContent={onetimeInviteCreation.responsible.leader.invite.explanation.join(
            "\n\n",
          )}
        />
      )}
    </div>
  );
};

export default InviteFormGroupStep;
