import type {
  CreateGeneralUpdateDto,
  GeneralUpdateAdminDto,
  UpdateGeneralUpdateDto,
} from "@alliance/shared/client";
import type { Dispatch, SetStateAction } from "react";
import { href } from "react-router";
import { BadgeTone } from "../../ui/Badge";

export const GENERAL_UPDATES_HREF = href("/content/general-updates");

/** The dates are UTC instants as ISO strings, or "" for none. */
export type GeneralUpdateForm = {
  name: string;
  startDate: string;
  endDate: string;
  useManualCohort: boolean;
  manualCohortUserIds: number[];
  tagIds: string[];
  suiteIds: number[];
};

export type GeneralUpdateFieldsProps = {
  form: GeneralUpdateForm;
  setForm: Dispatch<SetStateAction<GeneralUpdateForm>>;
};

export const EMPTY_FORM: GeneralUpdateForm = {
  name: "",
  startDate: "",
  endDate: "",
  useManualCohort: false,
  manualCohortUserIds: [],
  tagIds: [],
  suiteIds: [],
};

export const withSuite = (
  form: GeneralUpdateForm,
  suiteId: number,
): GeneralUpdateForm =>
  form.suiteIds.includes(suiteId)
    ? form
    : { ...form, suiteIds: [...form.suiteIds, suiteId] };

export const usesSuiteSchedule = (form: GeneralUpdateForm) =>
  form.suiteIds.length > 0;

const instantOf = (date: string | null | undefined) =>
  date ? new Date(date).toISOString() : "";

export const formOf = (update: GeneralUpdateAdminDto): GeneralUpdateForm => ({
  name: update.name,
  startDate: instantOf(update.startDate),
  endDate: instantOf(update.endDate),
  useManualCohort: update.useManualCohort,
  manualCohortUserIds: update.manualCohortUserIds ?? [],
  tagIds: update.tags?.map((tag) => tag.id) ?? [],
  suiteIds: update.suites?.map((suite) => suite.id) ?? [],
});

/**
 * What a save sends. A suite's schedule is the server's to set, so the dates
 * stay out. Without a suite an empty date goes as `null`, which clears a
 * stored one: left out, the server would keep the old date.
 */
export const saveBodyOf = (form: GeneralUpdateForm) => {
  const ownSchedule = !usesSuiteSchedule(form);
  return {
    name: form.name,
    startDate: ownSchedule ? form.startDate || null : undefined,
    endDate: ownSchedule ? form.endDate || null : undefined,
    useManualCohort: form.useManualCohort,
    manualCohortUserIds: form.useManualCohort ? form.manualCohortUserIds : [],
    tagIds: form.tagIds,
    suiteIds: form.suiteIds,
  } satisfies CreateGeneralUpdateDto & UpdateGeneralUpdateDto;
};

export enum GeneralUpdateStatus {
  Draft = "draft",
  Active = "active",
  Scheduled = "scheduled",
  Expired = "expired",
}

/** The order the list groups them in. */
export const GENERAL_UPDATE_STATUSES = [
  GeneralUpdateStatus.Draft,
  GeneralUpdateStatus.Active,
  GeneralUpdateStatus.Scheduled,
  GeneralUpdateStatus.Expired,
] as const;

export const STATUS_LABEL: Record<GeneralUpdateStatus, string> = {
  [GeneralUpdateStatus.Draft]: "Draft",
  [GeneralUpdateStatus.Active]: "Active",
  [GeneralUpdateStatus.Scheduled]: "Scheduled",
  [GeneralUpdateStatus.Expired]: "Expired",
};

export const STATUS_TONE: Record<GeneralUpdateStatus, BadgeTone> = {
  [GeneralUpdateStatus.Draft]: BadgeTone.Neutral,
  [GeneralUpdateStatus.Active]: BadgeTone.Success,
  [GeneralUpdateStatus.Scheduled]: BadgeTone.Info,
  [GeneralUpdateStatus.Expired]: BadgeTone.Neutral,
};

type Schedule = {
  startDate?: string | null;
  endDate?: string | null;
};

/**
 * One with no start is a draft. From its start every member can open it under
 * General updates; until its end it is also on its audience's home pages.
 */
export function statusOf(
  { startDate, endDate }: Schedule,
  now: Date,
): GeneralUpdateStatus {
  if (!startDate) return GeneralUpdateStatus.Draft;
  if (new Date(startDate) > now) return GeneralUpdateStatus.Scheduled;
  if (!endDate || new Date(endDate) > now) return GeneralUpdateStatus.Active;
  return GeneralUpdateStatus.Expired;
}

export function groupByStatus<T extends Schedule>(
  updates: readonly T[],
  now: Date,
): { status: GeneralUpdateStatus; updates: T[] }[] {
  return GENERAL_UPDATE_STATUSES.map((status) => ({
    status,
    updates: updates.filter((update) => statusOf(update, now) === status),
  })).filter((group) => group.updates.length > 0);
}

const SAVE_REACH: Record<GeneralUpdateStatus, string> = {
  [GeneralUpdateStatus.Draft]:
    "Saves with no start date, so members don't see it.",
  [GeneralUpdateStatus.Active]: "Members see this on save.",
  [GeneralUpdateStatus.Scheduled]: "Members see this from its start date.",
  [GeneralUpdateStatus.Expired]:
    "Past its end date: off home pages, still under General updates for every member.",
};

/** What saving the form as it stands stores and shows members, for the save bar. */
export const saveReachOf = (form: GeneralUpdateForm, now: Date): string =>
  usesSuiteSchedule(form)
    ? "Saves no dates: the update follows its suite's."
    : SAVE_REACH[statusOf(form, now)];

/** The standing fact on a record members can already open, where every save is live. */
export const LIVE_NOTICE: Record<GeneralUpdateStatus, string | null> = {
  [GeneralUpdateStatus.Draft]: null,
  [GeneralUpdateStatus.Scheduled]: null,
  [GeneralUpdateStatus.Active]:
    "Members see this update now. A save to its details or content reaches them on their next load.",
  [GeneralUpdateStatus.Expired]:
    "Past its end date, but every member still sees this under General updates. A save reaches them on their next load.",
};
