import { R } from "@alliance/common/result";
import type {
  WaitlistEntryFilterDto,
  WaitlistEntrySort,
} from "@alliance/shared/client/types.gen";
import {
  fromDateInput,
  fromEndDateInput,
  toDateInput,
  toEndDateInput,
} from "../../lib/dateInput";
import {
  INITIAL_WAITLIST_FILTER,
  INVITE_STATE_LABELS,
  isContactMethod,
  sameFilter,
  SPAM_STATUSES,
} from "../../lib/waitlistFilter";

const DEFAULT_SORT: WaitlistEntrySort = "joined_desc";

const SORTS: Record<WaitlistEntrySort, true> = {
  joined_desc: true,
  joined_asc: true,
  organization_asc: true,
  organization_desc: true,
};

const isSort = (value: string): value is WaitlistEntrySort =>
  Object.hasOwn(SORTS, value);

enum Param {
  Search = "q",
  Organization = "org",
  Link = "link",
  Referrer = "referrer",
  Tag = "tag",
  Invite = "invite",
  Spam = "spam",
  Contact = "contact",
  Mobilized = "mobilized",
  Subscribed = "subscribed",
  Reason = "reason",
  JoinedFrom = "from",
  JoinedTo = "to",
  Sort = "sort",
  Page = "page",
  Cohort = "cohort",
}

/** The spam filter's value when no status is chosen, which the default isn't. */
const ANY = "any";

const FILTER_PARAMS = [
  Param.Search,
  Param.Organization,
  Param.Link,
  Param.Referrer,
  Param.Tag,
  Param.Invite,
  Param.Spam,
  Param.Contact,
  Param.Mobilized,
  Param.Subscribed,
  Param.Reason,
  Param.JoinedFrom,
  Param.JoinedTo,
] as const;

const ID_FIELDS = {
  [Param.Organization]: "organizationIds",
  [Param.Link]: "sourceLinkIds",
  [Param.Referrer]: "referrerIds",
  [Param.Tag]: "tagIds",
} as const;

const BOOLEAN_FIELDS = {
  [Param.Mobilized]: "mobilized",
  [Param.Subscribed]: "subscribed",
  [Param.Reason]: "hasReason",
} as const;

const list = (value: string | null): string[] =>
  value ? value.split(",").filter(Boolean) : [];

const ids = (value: string | null): number[] =>
  list(value)
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);

const oneOf = <T extends string>(
  value: string | null,
  known: Record<T, unknown>,
): T[] => list(value).filter((item): item is T => Object.hasOwn(known, item));

/**
 * The filter a URL names. A missing spam param is the default, which hides
 * spam-like entries; an unknown value is dropped, as if it weren't there.
 */
export function filterFromParams(
  params: URLSearchParams,
): WaitlistEntryFilterDto {
  const filter: WaitlistEntryFilterDto = {};
  const search = params.get(Param.Search)?.trim();
  if (search) filter.search = search;
  for (const [param, field] of Object.entries(ID_FIELDS)) {
    const value = ids(params.get(param));
    if (value.length) filter[field] = value;
  }
  const inviteStates = oneOf(params.get(Param.Invite), INVITE_STATE_LABELS);
  if (inviteStates.length) filter.inviteStates = inviteStates;
  const spam = params.get(Param.Spam);
  if (spam === null) {
    filter.spamStatuses = INITIAL_WAITLIST_FILTER.spamStatuses;
  } else {
    const spamStatuses = oneOf(spam, SPAM_STATUSES);
    if (spamStatuses.length) filter.spamStatuses = spamStatuses;
  }
  const contact = params.get(Param.Contact) ?? "";
  if (isContactMethod(contact)) filter.contactMethod = contact;
  for (const [param, field] of Object.entries(BOOLEAN_FIELDS)) {
    const value = params.get(param);
    if (value === "true" || value === "false") filter[field] = value === "true";
  }
  const from = fromDateInput(params.get(Param.JoinedFrom) ?? "");
  if (R.isSuccess(from) && from.value) filter.joinedFrom = from.value;
  const to = fromEndDateInput(params.get(Param.JoinedTo) ?? "");
  if (R.isSuccess(to) && to.value) filter.joinedBefore = to.value;
  return filter;
}

/** `prev` with its filter params replaced by `filter`'s, and the page reset. */
export function withFilterParams(
  prev: URLSearchParams,
  filter: WaitlistEntryFilterDto,
): URLSearchParams {
  const next = new URLSearchParams(prev);
  for (const param of [...FILTER_PARAMS, Param.Page]) next.delete(param);
  if (filter.search) next.set(Param.Search, filter.search);
  for (const [param, field] of Object.entries(ID_FIELDS)) {
    const value = filter[field];
    if (value?.length) next.set(param, value.join(","));
  }
  if (filter.inviteStates?.length) {
    next.set(Param.Invite, filter.inviteStates.join(","));
  }
  const spamDefault = sameFilter(
    { spamStatuses: filter.spamStatuses },
    INITIAL_WAITLIST_FILTER,
  );
  if (!spamDefault) {
    next.set(Param.Spam, filter.spamStatuses?.join(",") || ANY);
  }
  if (filter.contactMethod) next.set(Param.Contact, filter.contactMethod);
  for (const [param, field] of Object.entries(BOOLEAN_FIELDS)) {
    const value = filter[field];
    if (value !== undefined) next.set(param, String(value));
  }
  if (filter.joinedFrom) {
    next.set(Param.JoinedFrom, toDateInput(filter.joinedFrom));
  }
  if (filter.joinedBefore) {
    next.set(Param.JoinedTo, toEndDateInput(filter.joinedBefore));
  }
  return next;
}

export const sortFromParams = (params: URLSearchParams): WaitlistEntrySort => {
  const sort = params.get(Param.Sort) ?? "";
  return isSort(sort) ? sort : DEFAULT_SORT;
};

export function withSortParam(
  prev: URLSearchParams,
  sort: WaitlistEntrySort,
): URLSearchParams {
  const next = new URLSearchParams(prev);
  next.delete(Param.Page);
  if (sort === DEFAULT_SORT) next.delete(Param.Sort);
  else next.set(Param.Sort, sort);
  return next;
}

export const pageFromParams = (params: URLSearchParams): number => {
  const page = Number(params.get(Param.Page));
  return Number.isInteger(page) && page > 1 ? page : 1;
};

export function withPageParam(
  prev: URLSearchParams,
  page: number,
): URLSearchParams {
  const next = new URLSearchParams(prev);
  if (page > 1) next.set(Param.Page, String(page));
  else next.delete(Param.Page);
  return next;
}

export const cohortFromParams = (params: URLSearchParams): number | null => {
  const [id] = ids(params.get(Param.Cohort));
  return id ?? null;
};

export function withCohortParam(
  prev: URLSearchParams,
  cohortId: number | null,
): URLSearchParams {
  const next = new URLSearchParams(prev);
  if (cohortId === null) next.delete(Param.Cohort);
  else next.set(Param.Cohort, String(cohortId));
  return next;
}
