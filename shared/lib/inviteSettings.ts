import { withCount } from "@alliance/common/plural";
import { useMemo, useState } from "react";
import type {
  CommunityDto,
  OnetimeInviteDto,
  ShareUrlMineDto,
} from "../client";
import { inviteDestination, onetimeInviteCreation } from "./copy";
import { getOnetimeInviteSignupUrl } from "./inviteUrls";
import {
  inviteDestinationSelection,
  onetimeInviteNotes,
  reusableInviteNotes,
  type InviteNote,
} from "./inviteUtils";
import { formatTime } from "./utils";

/** A group they lead, or `null` for "wherever there is room". */
export type InviteSettingsDestination = number | null;

type InviteSettingsChanges = {
  name?: string;
  communityId?: InviteSettingsDestination;
};

/** What the invite settings modal edits, on web and mobile alike. */
export type InviteSettingsTarget = {
  /** Header line: whatever names this invite today. */
  title: string;
  /** Header sub-line: uses, age, whatever is worth knowing at a glance. */
  meta: string;
  /** The link people follow, shown and copyable. */
  url: string;
  name: {
    label: string;
    value: string;
    placeholder: string;
    helper: string;
    /** Blank is a legitimate clear for a label, but not for an invitee's name. */
    required?: boolean;
  };
  destination: {
    /** `undefined` when the invite never named one — nothing to preselect. */
    current: InviteSettingsDestination | undefined;
    /** Wording for the "no particular group" choice, which differs per invite type. */
    openLabel: string;
    openDetail: string;
    notes: InviteNote[];
  };
  delete: { enabled: boolean; disabledReason: string };
  onSave: (changes: InviteSettingsChanges) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
};

export function onetimeInviteSettings({
  invite,
  baseUrl,
  updateInvite,
}: {
  invite: OnetimeInviteDto;
  baseUrl: string;
  updateInvite: (vars: {
    inviteId: number;
    invitee?: string;
    communityId?: InviteSettingsDestination;
  }) => Promise<unknown>;
}): Omit<InviteSettingsTarget, "onDelete"> {
  return {
    title: invite.invitee,
    meta: `Invited ${formatTime(new Date(invite.createdAt), { addSuffix: true })}`,
    url: getOnetimeInviteSignupUrl(baseUrl, invite.code),
    name: {
      label: "Who this invite is for",
      value: invite.invitee,
      placeholder: "Their name",
      helper: "Shown to you and to the group lead who takes them on.",
      required: true,
    },
    destination: {
      current: invite.community?.id ?? null,
      openLabel: onetimeInviteCreation.assignToOpenGroup,
      openDetail: inviteDestination.onetime.openDetail,
      notes: onetimeInviteNotes,
    },
    delete: { enabled: true, disabledReason: "" },
    onSave: ({ name, communityId }) =>
      updateInvite({
        inviteId: invite.id,
        ...(name !== undefined && { invitee: name }),
        ...(communityId !== undefined && { communityId }),
      }),
  };
}

export function reusableInviteSettings({
  link,
  updateInvite,
}: {
  link: ShareUrlMineDto;
  updateInvite: (vars: {
    id: string;
    label?: string;
    communityId?: InviteSettingsDestination;
  }) => Promise<unknown>;
}): Omit<InviteSettingsTarget, "onDelete"> {
  return {
    title: link.label || (link.duplicate ? "Untitled link" : "Primary invite"),
    meta: `${withCount(link.signupCount, "signup")} so far`,
    url: link.url,
    name: {
      label: "Label",
      value: link.label ?? "",
      placeholder: "e.g. Instagram bio",
      helper:
        "Only you can see this — it is a reminder of where you shared the link.",
    },
    destination: {
      current: inviteDestinationSelection(link),
      openLabel: inviteDestination.reusable.openLabel,
      openDetail: inviteDestination.reusable.openDetail,
      notes: reusableInviteNotes(link),
    },
    delete: {
      enabled: link.duplicate,
      disabledReason: "Your primary link cannot be deleted",
    },
    onSave: ({ name, communityId }) =>
      updateInvite({
        id: link.id,
        ...(name !== undefined && { label: name }),
        ...(communityId !== undefined && { communityId }),
      }),
  };
}

/** The unsaved edits in an open invite settings modal. */
export function useInviteSettingsDraft({
  target,
  leaderCommunities,
}: {
  target: InviteSettingsTarget;
  leaderCommunities: Pick<CommunityDto, "id" | "name">[];
}) {
  const [name, setName] = useState(target.name.value);
  const [destination, setDestination] = useState<
    InviteSettingsDestination | undefined
  >(target.destination.current);

  const trimmedName = name.trim();
  const nameChanged = trimmedName !== target.name.value;
  const nameMissing = !!target.name.required && !trimmedName;
  const destinationChanged =
    destination !== undefined && destination !== target.destination.current;

  const changes: InviteSettingsChanges = {
    ...(nameChanged && { name: trimmedName }),
    ...(destinationChanged && { communityId: destination }),
  };

  const options = useMemo(
    (): {
      value: InviteSettingsDestination;
      name: string;
      detail: string;
    }[] => [
      ...leaderCommunities.map((community) => ({
        value: community.id,
        name: community.name,
        detail: inviteDestination.ledGroupDetail,
      })),
      {
        value: null,
        name: target.destination.openLabel,
        detail: target.destination.openDetail,
      },
    ],
    [leaderCommunities, target.destination],
  );

  return {
    name,
    setName,
    destination,
    setDestination,
    nameMissing,
    dirty: nameChanged || destinationChanged,
    changes,
    options,
  };
}
