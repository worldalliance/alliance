import { errorMessage } from "@alliance/common/errorMessage";
import { CommunityDto } from "@alliance/shared/client";
import { onetimeInviteCreation } from "@alliance/shared/lib/copy";
import { getOnetimeInviteSignupUrl } from "@alliance/shared/lib/inviteUrls";
import { useInvitePlacement } from "@alliance/shared/lib/useInvitePlacement";
import { useMyCommunities } from "@alliance/shared/lib/useMyCommunities";
import { useOnetimeInvitesOverview } from "@alliance/shared/lib/useOnetimeInvitesOverview";
import { useReusableInvites } from "@alliance/shared/lib/useReusableInvites";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import { getInviteBaseUrl } from "@alliance/sharedweb/lib/config";
import AppMarkdownWrapper from "@alliance/sharedweb/ui/AppMarkdownWrapper";
import Card from "@alliance/sharedweb/ui/Card";
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
import InviteFormGroupStep from "./InviteFormGroupStep";
import OnetimeInviteForm from "./OnetimeInviteForm";

const inviteTitleClass = "font-semibold text-xl text-zinc-900";

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

type InviteFormProps = {
  onInviteCreated: () => void;
  onReusableInviteCreated: () => void;
};

const InviteForm = ({
  onInviteCreated,
  onReusableInviteCreated,
}: InviteFormProps) => {
  const { user } = useAuth();
  const { error: errorToast, success: successToast } = useToast();
  const [step, setStep] = useState(InviteFormStep.Type);
  const [multipleUseInvite, setMultipleUseInvite] = useState(false);
  const [inviteeName, setInviteeName] = useState("");
  const [creatingCommunity, setCreatingCommunity] = useState(false);
  const { communities } = useMyCommunities({});
  const { placement, setPlacement, leaderCommunities, selectedCommunity } =
    useInvitePlacement(communities, user?.id);
  const { createInvite: createReusableInvite, isCreating: creatingReusable } =
    useReusableInvites();
  const { createInvite, isCreatingInvite } = useOnetimeInvitesOverview();
  const communityCreateSubmitRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    setInviteeName("");
  }, [multipleUseInvite]);

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

      // Started rather than awaited: the clipboard write has to be issued
      // inside the click, before the request it depends on resolves.
      const creation = createInvite({
        invitee: inviteeName.trim(),
        ...(communityId !== null && { communityId }),
      });
      const copying = copyToClipboard(
        creation.then((invite) =>
          getOnetimeInviteSignupUrl(getInviteBaseUrl(), invite.code),
        ),
      );
      return creation.then(
        async () => {
          if (await copying) {
            successToast("Invite created and copied to clipboard!");
          } else {
            errorToast(
              "Invite created, but it could not be copied to the clipboard.",
            );
          }
          onInviteCreated();
          resetWizard();
        },
        (error: unknown) =>
          errorToast(
            `Failed to create invite: ${errorMessage({
              error,
              fallback: "Unknown error",
            })}`,
          ),
      );
    },
    [
      createInvite,
      errorToast,
      inviteeName,
      onInviteCreated,
      resetWizard,
      successToast,
    ],
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
          onReusableInviteCreated();
          resetWizard();
        },
        (err: Error) =>
          errorToast(`Failed to create invite link: ${err.message}`),
      );
    },
    [
      createReusableInvite,
      errorToast,
      inviteeName,
      onReusableInviteCreated,
      resetWizard,
      successToast,
    ],
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
      setPlacement({ kind: "community", id: community.id });
    },
    [handleCreateForPlacement, setPlacement],
  );

  const inviteIsCreating = multipleUseInvite
    ? creatingReusable
    : isCreatingInvite;
  const wizardIsBusy = inviteIsCreating || creatingCommunity;

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
            : "Copy new invite link";
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
                getOnetimeInviteSignupUrl(
                  getInviteBaseUrl(),
                  user.referralCode,
                ) + "&preview=1"
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
        <InviteFormGroupStep
          communities={communities}
          leaderCommunities={leaderCommunities}
          placement={placement}
          setPlacement={setPlacement}
          selectedCommunity={selectedCommunity}
          createDisabled={inviteIsCreating || !inviteeName.trim()}
          onCreateCommunity={onCreateCommunity}
          communityCreateSubmitRef={communityCreateSubmitRef}
        />
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
