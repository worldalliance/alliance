import {
  CommunityDto,
  CreateOnetimeInviteDto,
  OnetimeInviteDto,
  userCreateOnetimeInvite,
} from "@alliance/shared/client";
import { getMemberCount } from "@alliance/shared/lib/communityUtils";
import { onetimeInviteCreation } from "@alliance/shared/lib/copy";
import { getOnetimeInviteSignupUrl } from "@alliance/shared/lib/inviteUrls";
import { useMyCommunities } from "@alliance/shared/lib/useMyCommunities";
import { useReusableInvites } from "@alliance/shared/lib/useReusableInvites";
import { CardStyle } from "@alliance/shared/styles/card";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import { getBaseUrl } from "@alliance/sharedweb/lib/config";
import AppMarkdownWrapper from "@alliance/sharedweb/ui/AppMarkdownWrapper";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import Card from "@alliance/sharedweb/ui/Card";
import DropdownSelect from "@alliance/sharedweb/ui/DropdownSelect";
import NewButton, { ButtonColor } from "@alliance/sharedweb/ui/NewButton";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../lib/AuthContext";
import CommunityCreateForm from "./CommunityCreateForm";
import OnetimeInviteForm from "./OnetimeInviteForm";

const inviteTitleClass = "font-semibold text-xl text-zinc-900";
const inviteSectionLabelClass = "text-lg font-semibold text-zinc-900";
const inviteStrongClass = "text-base font-semibold text-zinc-900";

type PlacementSelection =
  | { kind: "community"; id: number }
  | { kind: "assign" }
  | { kind: "new" };

type InviteFormProps = {
  onInviteCreated: (invite: OnetimeInviteDto) => void;
  multipleUseInvite: boolean;
};

const InviteForm = ({
  onInviteCreated,
  multipleUseInvite,
}: InviteFormProps) => {
  const { user } = useAuth();
  const { error: errorToast, success: successToast } = useToast();
  const [placement, setPlacement] = useState<PlacementSelection>({
    kind: "new",
  });
  const [inviteeName, setInviteeName] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const { communities, refreshCommunities } = useMyCommunities({});
  const { createInvite: createReusableInvite, isCreating: creatingReusable } =
    useReusableInvites();

  useEffect(() => {
    setInviteeName("");
  }, [multipleUseInvite]);

  // Default placement to a group the user leads. Runs once so it never clobbers
  // a manual selection on a later refetch.
  const didInitPlacement = useRef(false);
  useEffect(() => {
    if (didInitPlacement.current || communities.length === 0 || !user) {
      return;
    }
    didInitPlacement.current = true;
    const led = communities.find((community) =>
      community.leaders.some((leader) => leader.id === user.id),
    );
    setPlacement(led ? { kind: "community", id: led.id } : { kind: "new" });
  }, [communities, user]);

  const { leaderCommunities, memberCommunities } = useMemo(() => {
    const leaderCommunities: CommunityDto[] = [];
    const memberCommunities: CommunityDto[] = [];
    if (!user) {
      return { leaderCommunities, memberCommunities };
    }
    for (const community of communities) {
      if (community.leaders?.some((leader) => leader.id === user.id)) {
        leaderCommunities.push(community);
      } else {
        memberCommunities.push(community);
      }
    }
    return { leaderCommunities, memberCommunities };
  }, [communities, user]);

  const isLeader = leaderCommunities.length > 0;

  const leaderCommunitiesById = useMemo(() => {
    return new Map(
      leaderCommunities.map((community) => [community.id, community]),
    );
  }, [leaderCommunities]);
  const selectedCommunity = useMemo(() => {
    if (placement.kind !== "community") {
      return null;
    }
    return leaderCommunitiesById.get(placement.id) ?? null;
  }, [leaderCommunitiesById, placement]);

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

  useEffect(() => {
    if (
      placement.kind === "community" &&
      !leaderCommunitiesById.has(placement.id)
    ) {
      setPlacement(
        leaderCommunities[0]
          ? { kind: "community", id: leaderCommunities[0].id }
          : { kind: "new" },
      );
    }
  }, [placement, leaderCommunities, leaderCommunitiesById]);

  const handleCreateInvite = useCallback(
    async (communityId: number | null) => {
      if (!inviteeName.trim()) {
        errorToast("Please enter the invitee's name");
        return;
      }

      setCreatingInvite(true);
      try {
        const body: CreateOnetimeInviteDto = {
          invitee: inviteeName.trim(),
          ...(communityId !== null && { communityId }),
        };

        const response = await userCreateOnetimeInvite({ body });
        if (response.data) {
          const copied = await copyToClipboard(
            getOnetimeInviteSignupUrl(getBaseUrl(), response.data.code),
          );
          if (copied) {
            successToast("Invite created and copied to clipboard!");
          } else {
            errorToast(
              "Invite created, but it could not be copied to the clipboard.",
            );
          }
          setInviteeName("");
          onInviteCreated(response.data);
        } else {
          errorToast(
            `Failed to create invite: ${
              response.response?.statusText || "Unknown error"
            }`,
          );
        }
      } catch {
        errorToast("Failed to create invite");
      } finally {
        setCreatingInvite(false);
      }
    },
    [inviteeName, errorToast, successToast, onInviteCreated],
  );

  const handleCreateReusableInvite = useCallback((communityId: number | null) => {
    if (!inviteeName.trim()) {
      errorToast("Please enter a group name");
      return;
    }

    createReusableInvite({
      label: inviteeName.trim(),
      communityId,
    }).then(
      async (link) => {
        const copied = await copyToClipboard(link.url);
        if (copied) {
          successToast("Invite link created and copied to clipboard!");
        } else {
          errorToast(
            "Invite link created, but it could not be copied to the clipboard.",
          );
        }
        setInviteeName("");
      },
      (err: Error) =>
        errorToast(`Failed to create invite link: ${err.message}`),
    );
  }, [createReusableInvite, errorToast, inviteeName, successToast]);

  const handleCreateForPlacement = useCallback(
    (communityId: number | null) => {
      if (multipleUseInvite) {
        handleCreateReusableInvite(communityId);
      } else {
        void handleCreateInvite(communityId);
      }
    },
    [handleCreateInvite, handleCreateReusableInvite, multipleUseInvite],
  );

  const onCreateCommunity = useCallback(
    async (community: CommunityDto) => {
      try {
        handleCreateForPlacement(community.id);
        await refreshCommunities();
        setPlacement({ kind: "community", id: community.id });
      } catch {
        errorToast("Failed to refresh groups");
      }
    },
    [errorToast, refreshCommunities, handleCreateForPlacement],
  );

  const inviteIsCreating = multipleUseInvite
    ? creatingReusable
    : creatingInvite;

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
    <Card style={CardStyle.White} className="p-6">
      <div className="flex flex-col gap-y-6">
        <div className="flex flex-col gap-y-4">
          <div className="flex flex-col gap-y-2">
            <p className={inviteTitleClass}>
              {multipleUseInvite
                ? "Invite a group"
                : "Invite an individual"}
            </p>
          </div>
          {multipleUseInvite ? (
            <p className="text-invite-form-body">
              Create one link that can be used by many people. Give it a label
              so you remember where you plan to share it.
            </p>
          ) : (
            <AppMarkdownWrapper
              className="text-invite-form-body"
              markdownContent={onetimeInviteCreation.explanation.join("\n\n")}
            />
          )}
          {!multipleUseInvite && user?.referralCode && (
            <Link
              to={
                getOnetimeInviteSignupUrl(getBaseUrl(), user.referralCode) +
                "&preview=1"
              }
              target="_blank"
              className="text-green hover:underline flex flex-row items-center gap-x-1"
            >
              Preview invite link <ChevronRight className="w-4 h-4" />
            </Link>
          )}
          <OnetimeInviteForm
            inviteePlaceholder={
              multipleUseInvite
                ? "Name of the group you are inviting"
                : "Name of the invitee"
            }
            inviteeName={inviteeName}
            setInviteeName={setInviteeName}
          />
        </div>

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
                    <Link
                      to={`/groups?communityId=${memberCommunities[0].id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="border border-zinc-200 bg-white hover:bg-zinc-50 rounded px-3 py-2.5 flex flex-col gap-y-2 self-start max-w-full"
                    >
                      <p className={inviteSectionLabelClass}>
                        Your current group
                      </p>
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
                            {`${memberCommunityRemainingCapacity} open seat${
                              memberCommunityRemainingCapacity === 1 ? "" : "s"
                            }`}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </>
                ) : (
                  <AppMarkdownWrapper
                    className="text-invite-form-body"
                    markdownContent={onetimeInviteCreation.not_responsible.explanations.yourGroupNoCapacity.join(
                      "\n\n",
                    )}
                  />
                )}
            <NewButton
              color={ButtonColor.Black}
              onClick={() => handleCreateForPlacement(null)}
              disabled={inviteIsCreating || !inviteeName.trim()}
              className="w-full"
            >
              {inviteIsCreating
                ? "Creating..."
                : multipleUseInvite
                  ? "Create invite link"
                  : "Create invite"}
            </NewButton>
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
                    You are not leading a group yet—create one to be responsible
                    for this member.
                  </p>
                )}
                <p className="text-invite-form-body">
                  Read our{" "}
                  <Link
                    to="/groups-guide"
                    className="text-green hover:underline"
                  >
                    groups guide
                  </Link>{" "}
                  to learn how to lead a group.
                </p>
            <CommunityCreateForm
              name={user?.name}
              createButtonTextOverride={
                inviteIsCreating
                  ? "Creating invite..."
                  : onetimeInviteCreation.responsible.leader.newGroup
                      .createButtonText
              }
              createDisabled={inviteIsCreating || !inviteeName.trim()}
              onSuccess={onCreateCommunity}
              includePhotoEditor={false}
              fullWidthButtons={true}
            />
          </div>
        )}

        {placement.kind === "community" && selectedCommunity && (
          <div className="flex flex-col gap-y-4">
                <AppMarkdownWrapper
                  className="text-invite-form-body"
                  markdownContent={onetimeInviteCreation.responsible.leader.invite.explanation.join(
                    "\n\n",
                  )}
                />
            <NewButton
              color={ButtonColor.Black}
              onClick={() => handleCreateForPlacement(placement.id)}
              disabled={inviteIsCreating || !inviteeName.trim()}
              className="w-full"
            >
              {inviteIsCreating
                ? "Creating invite..."
                : multipleUseInvite
                  ? "Create invite link"
                  : "Create invite"}
            </NewButton>
          </div>
        )}
      </div>
    </Card>
  );
};

export default InviteForm;
