import type { CommunityDto, ShareUrlMineDto } from "@alliance/shared/client";
import { inviteDestination } from "@alliance/shared/lib/copy";
import {
  inviteDestinationLabel,
  inviteDestinationSelection,
  reusableInviteNotes,
} from "@alliance/shared/lib/inviteUtils";
import { useMyCommunities } from "@alliance/shared/lib/useMyCommunities";
import { useReusableInvites } from "@alliance/shared/lib/useReusableInvites";
import { cn } from "@alliance/shared/styles/util";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import { interactiveListRowClass } from "@alliance/sharedweb/ui/List";
import NewButton, { ButtonColor } from "@alliance/sharedweb/ui/NewButton";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { ChevronRight, Copy as CopyIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../lib/AuthContext";
import ExpandableList from "./ExpandableList";
import InviteSettingsModal, {
  type InviteSettingsTarget,
} from "./InviteSettingsModal";

/** Read-only list; links are created by `InviteForm`, which picks a group. */
const InviteShareLink = () => {
  const { user } = useAuth();
  const { error: errorToast } = useToast();
  const { links, isPending, isError, updateInvite, deleteInvite } =
    useReusableInvites();
  const { communities } = useMyCommunities({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openLinkId, setOpenLinkId] = useState<string | null>(null);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
    };
  }, []);

  const leaderCommunities = useMemo(
    () =>
      user
        ? communities.filter((community: CommunityDto) =>
            community.leaders.some((leader) => leader.id === user.id),
          )
        : [],
    [communities, user],
  );

  const handleCopy = useCallback(
    async (link: ShareUrlMineDto) => {
      if (!(await copyToClipboard(link.url))) {
        errorToast("Could not copy the link to the clipboard.");
        return;
      }
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
      setCopiedId(link.id);
      copiedTimeoutRef.current = setTimeout(() => {
        setCopiedId(null);
        copiedTimeoutRef.current = null;
      }, 2000);
    },
    [errorToast],
  );

  const openLink = links.find((link) => link.id === openLinkId) ?? null;
  const openTarget: InviteSettingsTarget | null = openLink && {
    title:
      openLink.label ||
      (openLink.duplicate ? "Untitled link" : "Primary invite"),
    meta: `${openLink.signupCount} ${openLink.signupCount === 1 ? "signup" : "signups"} so far`,
    url: openLink.url,
    name: {
      label: "Label",
      value: openLink.label ?? "",
      placeholder: "e.g. Instagram bio",
      helper:
        "Only you can see this — it is a reminder of where you shared the link.",
    },
    destination: {
      current: inviteDestinationSelection(openLink),
      openLabel: inviteDestination.reusable.openLabel,
      openDetail: inviteDestination.reusable.openDetail,
      notes: reusableInviteNotes(openLink),
    },
    delete: {
      enabled: openLink.duplicate,
      disabledReason: "Your primary link cannot be deleted",
      confirmMessage:
        "Delete this invite link? Anyone you've already shared it with won't be able to use it.",
    },
    onSave: ({ name, communityId }) =>
      updateInvite({
        id: openLink.id,
        ...(name !== undefined && { label: name }),
        ...(communityId !== undefined && { communityId }),
      }),
    onDelete: () => deleteInvite(openLink.id),
  };

  if (isError) {
    return <p className="text-red-500 text-sm">Failed to load invite links</p>;
  }
  if (isPending) {
    return <p className="text-zinc-500 text-sm">Loading…</p>;
  }
  if (links.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-col gap-y-1">
        <p className="font-semibold text-2xl">Your multi-use invites</p>
        <p className="text-zinc-500">
          Each link can be shared with and used by many people. Select one to
          rename it, change its group, or delete it.
        </p>
      </div>
      <ExpandableList>
        {links.map((link) => (
          <InviteLinkRow
            key={link.id}
            link={link}
            copied={copiedId === link.id}
            destinationLabel={inviteDestinationLabel(link)}
            onCopy={handleCopy}
            onOpen={setOpenLinkId}
          />
        ))}
      </ExpandableList>
      {openTarget && (
        <InviteSettingsModal
          target={openTarget}
          leaderCommunities={leaderCommunities}
          onClose={() => setOpenLinkId(null)}
        />
      )}
    </div>
  );
};

type InviteLinkRowProps = {
  link: ShareUrlMineDto;
  copied: boolean;
  destinationLabel: string;
  onCopy: (link: ShareUrlMineDto) => void;
  onOpen: (id: string) => void;
};

const InviteLinkRow = ({
  link,
  copied,
  destinationLabel,
  onCopy,
  onOpen,
}: InviteLinkRowProps) => (
  <div
    role="button"
    tabIndex={0}
    onClick={() => onOpen(link.id)}
    onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onOpen(link.id);
      }
    }}
    aria-label={`Settings for ${link.label || "this invite link"}`}
    className={cn(
      "group flex w-full flex-col justify-between gap-y-3 p-4 text-left sm:flex-row sm:items-center sm:gap-x-4 sm:gap-y-0",
      interactiveListRowClass,
    )}
  >
    <div className="flex min-w-0 flex-col gap-y-0.5 overflow-hidden sm:flex-1 sm:pr-4">
      <div className="flex min-w-0 items-center gap-x-1.5">
        <span
          className={cn(
            "min-w-0 truncate text-lg font-semibold",
            link.label ? "text-zinc-900" : "italic text-zinc-400",
          )}
        >
          {link.label || (link.duplicate ? "Add a label" : "Primary invite")}
        </span>
        {!link.duplicate && (
          <span className="shrink-0 rounded-full bg-green/10 px-2 py-0.5 text-xs font-semibold text-green">
            Primary
          </span>
        )}
      </div>
      <p className="break-all font-mono text-sm text-zinc-400">{link.url}</p>
      <p className="text-sm text-zinc-500">
        {link.signupCount} {link.signupCount === 1 ? "use" : "uses"} ·{" "}
        {destinationLabel}
      </p>
    </div>

    <div className="flex shrink-0 flex-row items-center gap-2 sm:justify-end">
      <NewButton
        color={copied ? ButtonColor.Green : ButtonColor.White}
        disabled={copied}
        onClick={(event) => {
          event.stopPropagation();
          onCopy(link);
        }}
        iconLeft={!copied && CopyIcon}
        className="shrink-0 whitespace-nowrap"
      >
        {copied ? "Copied!" : "Copy link"}
      </NewButton>
      <ChevronRight
        size={18}
        className="hidden shrink-0 text-zinc-300 transition-colors group-hover:text-zinc-500 sm:block"
      />
    </div>
  </div>
);

export default InviteShareLink;
