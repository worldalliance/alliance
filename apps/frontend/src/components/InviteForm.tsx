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
import { cn } from "@alliance/shared/styles/util";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import { getBaseUrl } from "@alliance/sharedweb/lib/config";
import AppMarkdownWrapper from "@alliance/sharedweb/ui/AppMarkdownWrapper";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import Card from "@alliance/sharedweb/ui/Card";
import DropdownSelect from "@alliance/sharedweb/ui/DropdownSelect";
import NewButton, {
  ButtonColor,
  ButtonSize,
} from "@alliance/sharedweb/ui/NewButton";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { ChevronRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router";
import { useAuth } from "../lib/AuthContext";
import CommunityCreateForm from "./CommunityCreateForm";
import OnetimeInviteForm from "./OnetimeInviteForm";

const inviteTitleClass = "font-semibold text-xl text-zinc-900";
const inviteSectionLabelClass = "text-lg font-semibold text-zinc-900";
const inviteStrongClass = "text-base font-semibold text-zinc-900";

enum InviteFormStep {
  Type = "type",
  Name = "name",
  Group = "group",
}

const INVITE_FORM_STEPS = [
  InviteFormStep.Type,
  InviteFormStep.Name,
  InviteFormStep.Group,
] as const;

const NEXT_STEP: Record<InviteFormStep, InviteFormStep | null> = {
  [InviteFormStep.Type]: InviteFormStep.Name,
  [InviteFormStep.Name]: InviteFormStep.Group,
  [InviteFormStep.Group]: null,
};

const PREV_STEP: Record<InviteFormStep, InviteFormStep | null> = {
  [InviteFormStep.Type]: null,
  [InviteFormStep.Name]: InviteFormStep.Type,
  [InviteFormStep.Group]: InviteFormStep.Name,
};

const STEP_INDEX: Record<InviteFormStep, number> = {
  [InviteFormStep.Type]: 0,
  [InviteFormStep.Name]: 1,
  [InviteFormStep.Group]: 2,
};

type PlacementSelection =
  | { kind: "community"; id: number }
  | { kind: "assign" }
  | { kind: "new" };

type InviteFormProps = {
  onInviteCreated: (invite: OnetimeInviteDto) => void;
};

const InviteForm = ({ onInviteCreated }: InviteFormProps) => {
  const { user } = useAuth();
  const { error: errorToast, success: successToast } = useToast();
  const [step, setStep] = useState(InviteFormStep.Type);
  const [multipleUseInvite, setMultipleUseInvite] = useState(false);
  const [placement, setPlacement] = useState<PlacementSelection>({
    kind: "new",
  });
  const [inviteeName, setInviteeName] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [creatingCommunity, setCreatingCommunity] = useState(false);
  const { communities, refreshCommunities } = useMyCommunities({});
  const { createInvite: createReusableInvite, isCreating: creatingReusable } =
    useReusableInvites();
  const communityCreateSubmitRef = useRef<(() => Promise<void>) | null>(null);

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

  const resetWizard = useCallback(() => {
    setInviteeName("");
    setStep(InviteFormStep.Type);
  }, []);

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
        // Started rather than awaited: the clipboard write has to be issued
        // inside the click, before the request it depends on resolves.
        const request = userCreateOnetimeInvite({ body });
        const copying = copyToClipboard(
          request.then((response) =>
            response.data
              ? getOnetimeInviteSignupUrl(getBaseUrl(), response.data.code)
              : Promise.reject(new Error("invite was not created")),
          ),
        );

        const response = await request;
        if (response.data) {
          if (await copying) {
            successToast("Invite created and copied to clipboard!");
          } else {
            errorToast(
              "Invite created, but it could not be copied to the clipboard.",
            );
          }
          onInviteCreated(response.data);
          resetWizard();
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
    [inviteeName, errorToast, successToast, onInviteCreated, resetWizard],
  );

  const handleCreateReusableInvite = useCallback(
    async (communityId: number | null) => {
      if (!inviteeName.trim()) {
        errorToast("Please enter a group name");
        return;
      }

      const creation = createReusableInvite({
        label: inviteeName.trim(),
        communityId,
      });
      const copying = copyToClipboard(creation.then((link) => link.url));
      return creation.then(
        async () => {
          if (await copying) {
            successToast("Invite link created and copied to clipboard!");
          } else {
            errorToast(
              "Invite link created, but it could not be copied to the clipboard.",
            );
          }
          resetWizard();
        },
        (err: Error) =>
          errorToast(`Failed to create invite link: ${err.message}`),
      );
    },
    [createReusableInvite, errorToast, inviteeName, resetWizard, successToast],
  );

  /** Both branches report their own failures, so this settles rather than rejects. */
  const handleCreateForPlacement = useCallback(
    async (communityId: number | null) => {
      if (multipleUseInvite) {
        await handleCreateReusableInvite(communityId);
      } else {
        await handleCreateInvite(communityId);
      }
    },
    [handleCreateInvite, handleCreateReusableInvite, multipleUseInvite],
  );

  const onCreateCommunity = useCallback(
    async (community: CommunityDto) => {
      await handleCreateForPlacement(community.id);
      try {
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
  const wizardIsBusy = inviteIsCreating || creatingCommunity;

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

  const goBack = useCallback(() => {
    const prev = PREV_STEP[step];
    if (prev) {
      setStep(prev);
    }
  }, [step]);

  const goNext = useCallback(() => {
    const next = NEXT_STEP[step];
    if (next) {
      setStep(next);
    }
  }, [step]);

  const canAdvance = useMemo(() => {
    const canAdvanceByStep: Record<InviteFormStep, boolean> = {
      [InviteFormStep.Type]: true,
      [InviteFormStep.Name]: inviteeName.trim().length > 0,
      [InviteFormStep.Group]: false,
    };
    return canAdvanceByStep[step];
  }, [inviteeName, step]);

  const canCreate = useMemo(() => {
    if (!inviteeName.trim() || wizardIsBusy) {
      return false;
    }
    switch (placement.kind) {
      case "assign":
        return true;
      case "community":
        return selectedCommunity !== null;
      case "new":
        return true;
      default:
        throw new Error(`unknown placement: ${placement satisfies never}`);
    }
  }, [inviteeName, placement, selectedCommunity, wizardIsBusy]);

  const handlePrimaryAction = useCallback(() => {
    switch (step) {
      case InviteFormStep.Type:
      case InviteFormStep.Name:
        if (canAdvance) {
          goNext();
        }
        break;
      case InviteFormStep.Group:
        if (!canCreate) {
          return;
        }
        switch (placement.kind) {
          case "new":
            void (async () => {
              setCreatingCommunity(true);
              try {
                await communityCreateSubmitRef.current?.();
              } finally {
                setCreatingCommunity(false);
              }
            })();
            break;
          case "assign":
            void handleCreateForPlacement(null);
            break;
          case "community":
            void handleCreateForPlacement(placement.id);
            break;
          default:
            throw new Error(`unknown placement: ${placement satisfies never}`);
        }
        break;
      default:
        throw new Error(`unknown step: ${step satisfies never}`);
    }
  }, [
    canAdvance,
    canCreate,
    goNext,
    handleCreateForPlacement,
    placement,
    step,
  ]);

  const primaryDisabled =
    step === InviteFormStep.Group ? !canCreate : !canAdvance;

  const primaryLabel = useMemo(() => {
    if (wizardIsBusy && step === InviteFormStep.Group) {
      return placement.kind === "new" ? "Creating..." : "Creating invite...";
    }
    switch (step) {
      case InviteFormStep.Type:
      case InviteFormStep.Name:
        return "Next";
      case InviteFormStep.Group:
        return placement.kind === "new"
          ? onetimeInviteCreation.responsible.leader.newGroup.createButtonText
          : multipleUseInvite
            ? "Create invite link"
            : "Create invite";
      default:
        throw new Error(`unknown step: ${step satisfies never}`);
    }
  }, [multipleUseInvite, placement.kind, step, wizardIsBusy]);

  let stepContent: ReactNode;
  switch (step) {
    case InviteFormStep.Type:
      stepContent = (
        <div className="flex flex-col gap-y-4">
          <p className={inviteTitleClass}>Who are you inviting?</p>
          <div
            className="grid grid-cols-1 sm:grid-cols-2 gap-2"
            role="radiogroup"
            aria-label="Invite type"
          >
            <button
              type="button"
              role="radio"
              aria-checked={!multipleUseInvite}
              className={
                multipleUseInvite
                  ? "rounded px-4 py-6 text-left border border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
                  : "rounded px-4 py-6 text-left border border-zinc-900 bg-zinc-100 text-zinc-900"
              }
              onClick={() => setMultipleUseInvite(false)}
            >
              <span className="block text-lg font-semibold">One person</span>
              <span className="block text-sm text-zinc-500">
                Single-use invite link
              </span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={multipleUseInvite}
              className={
                multipleUseInvite
                  ? "rounded px-4 py-6 text-left border border-zinc-900 bg-zinc-100 text-zinc-900"
                  : "rounded px-4 py-6 text-left border border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
              }
              onClick={() => setMultipleUseInvite(true)}
            >
              <span className="block text-lg font-semibold">Many people</span>
              <span className="block text-sm text-zinc-500">
                Multi-use invite link
              </span>
            </button>
          </div>
        </div>
      );
      break;
    case InviteFormStep.Name:
      stepContent = (
        <div className="flex flex-col gap-y-4">
          <div className="flex flex-col gap-y-2">
            <p className={inviteTitleClass}>
              {multipleUseInvite ? "Invite a group" : "Invite an individual"}
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
            autoFocus
            onEnter={handlePrimaryAction}
          />
        </div>
      );
      break;
    case InviteFormStep.Group:
      stepContent = (
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
                <Link to="/groups-guide" className="text-green hover:underline">
                  groups guide
                </Link>{" "}
                to learn how to lead a group.
              </p>
              <CommunityCreateForm
                name={user?.name}
                createDisabled={inviteIsCreating || !inviteeName.trim()}
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
      break;
    default:
      throw new Error(`unknown step: ${step satisfies never}`);
  }

  const currentStepIndex = STEP_INDEX[step];

  return (
    <Card style={CardStyle.White} className="p-6">
      <div className="flex flex-col gap-y-6">
        <div
          className="flex gap-1.5"
          aria-label={`Step ${currentStepIndex + 1} of ${INVITE_FORM_STEPS.length}`}
        >
          {INVITE_FORM_STEPS.map((formStep) => (
            <div
              key={formStep}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                STEP_INDEX[formStep] <= currentStepIndex
                  ? "bg-zinc-900"
                  : "bg-zinc-200",
              )}
            />
          ))}
        </div>

        {stepContent}

        <div className="flex flex-row gap-2 pt-2">
          {step !== InviteFormStep.Type && (
            <NewButton
              color={ButtonColor.Grey}
              size={ButtonSize.Large}
              className="flex-1 h-12! justify-center"
              centerIcon
              onClick={goBack}
              disabled={wizardIsBusy}
            >
              Back
            </NewButton>
          )}
          <NewButton
            color={ButtonColor.Black}
            size={ButtonSize.Large}
            className="flex-1 h-12! justify-center"
            centerIcon
            onClick={handlePrimaryAction}
            disabled={primaryDisabled}
          >
            {primaryLabel}
          </NewButton>
        </div>
      </div>
    </Card>
  );
};

export default InviteForm;
