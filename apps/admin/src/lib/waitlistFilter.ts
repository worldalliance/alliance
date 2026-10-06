import type {
  AdminWaitlistLinkDto,
  WaitlistContactMethod,
  WaitlistEntryFilterDto,
  WaitlistInviteState,
  WaitlistSpamStatus,
} from "@alliance/shared/client/types.gen";

const isBlank = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  value === "" ||
  (Array.isArray(value) && value.length === 0);

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
  if (isBlank(value)) {
    delete next[key];
  } else {
    next[key] = value;
  }
  return next;
}

export const compactFilter = (
  filter: WaitlistEntryFilterDto,
): WaitlistEntryFilterDto =>
  Object.fromEntries(
    Object.entries(filter).filter(([, value]) => !isBlank(value)),
  );

const canonical = (filter: WaitlistEntryFilterDto): string =>
  JSON.stringify(
    Object.entries(compactFilter(filter))
      .map(([key, value]) => [
        key,
        Array.isArray(value) ? [...value].sort() : value,
      ])
      .sort(([a], [b]) => String(a).localeCompare(String(b))),
  );

/** Whether two filters match the same entries, ignoring order and blanks. */
export const sameFilter = (
  a: WaitlistEntryFilterDto,
  b: WaitlistEntryFilterDto,
): boolean => canonical(a) === canonical(b);

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

export const CONTACT_METHOD_LABELS: Record<WaitlistContactMethod, string> = {
  email: "Email",
  phone: "Phone",
};

export const isContactMethod = (
  value: string,
): value is WaitlistContactMethod => value in CONTACT_METHOD_LABELS;

/** Spam-like entries get no email and start hidden. */
export const SPAM_STATUSES: Record<
  WaitlistSpamStatus,
  { label: string; spamLike: boolean }
> = {
  clean: { label: "Clean", spamLike: false },
  suspected: { label: "Suspected spam", spamLike: true },
  spam: { label: "Spam", spamLike: true },
  not_spam: { label: "Not spam", spamLike: false },
};

const isSpamStatus = (value: string): value is WaitlistSpamStatus =>
  value in SPAM_STATUSES;

export const SPAM_STATUS_VALUES =
  Object.keys(SPAM_STATUSES).filter(isSpamStatus);

export const INITIAL_WAITLIST_FILTER: WaitlistEntryFilterDto = {
  spamStatuses: SPAM_STATUS_VALUES.filter(
    (status) => !SPAM_STATUSES[status].spamLike,
  ),
};
