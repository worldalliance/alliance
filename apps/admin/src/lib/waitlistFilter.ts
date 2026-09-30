import type {
  AdminWaitlistLinkDto,
  WaitlistEntryFilterDto,
  WaitlistInviteState,
} from "@alliance/shared/client/types.gen";

/** Sets a filter field, dropping it when blank so an empty filter has no keys. */
export function withFilterField<K extends keyof WaitlistEntryFilterDto>({
  filter,
  key,
  value,
}: {
  filter: WaitlistEntryFilterDto;
  key: K;
  value: WaitlistEntryFilterDto[K];
}): WaitlistEntryFilterDto {
  const next = { ...filter };
  const blank =
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0);
  if (blank) {
    delete next[key];
  } else {
    next[key] = value;
  }
  return next;
}

export const isFilterEmpty = (filter: WaitlistEntryFilterDto): boolean =>
  Object.keys(filter).length === 0;

/** Labels a link by organization and channel, adding its code when two match. */
export const linkOptions = (
  links: AdminWaitlistLinkDto[],
  organizationName: ReadonlyMap<number, string>,
) => {
  const base = links.map(
    (link) =>
      `${organizationName.get(link.organizationId) ?? "?"} · ${link.channel}`,
  );
  return links.map((link, i) => {
    const repeated = base.indexOf(base[i]) !== base.lastIndexOf(base[i]);
    return {
      value: link.id,
      label: `${base[i]}${repeated ? ` · ${link.code}` : ""}${link.archivedAt ? " (archived)" : ""}`,
    };
  });
};

export const INVITE_STATE_LABELS: Record<WaitlistInviteState, string> = {
  none: "No invite",
  unused: "Unused",
  claimed: "Claimed",
  revoked: "Revoked",
};

const isInviteState = (value: string): value is WaitlistInviteState =>
  value in INVITE_STATE_LABELS;

export const INVITE_STATES =
  Object.keys(INVITE_STATE_LABELS).filter(isInviteState);
