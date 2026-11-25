import type {
  CreateGeneralUpdateDto,
  GeneralUpdateAdminDto,
  UpdateGeneralUpdateDto,
} from "@alliance/shared/client";
import type { Dispatch, SetStateAction } from "react";
import { href } from "react-router";
import { BadgeTone } from "../../ui/Badge";
import { formatLocalDateTime, resolveDateValue } from "../../ui/DateTimePicker";

export const GENERAL_UPDATES_HREF = href("/content/general-updates");

export const generalUpdateHref = (id: number | "new") =>
  href("/content/general-updates/:id", { id: String(id) });

/** The schedule in the admin's local time, as a `datetime-local` input holds it. */
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

export const formOf = (update: GeneralUpdateAdminDto): GeneralUpdateForm => ({
  name: update.name,
  startDate: formatLocalDateTime(resolveDateValue(update.startDate), "minute"),
  endDate: formatLocalDateTime(resolveDateValue(update.endDate), "minute"),
  useManualCohort: update.useManualCohort,
  manualCohortUserIds: update.manualCohortUserIds ?? [],
  tagIds: update.tags?.map((tag) => tag.id) ?? [],
  suiteIds: update.suites?.map((suite) => suite.id) ?? [],
});

/** What a save sends. A suite's schedule is the server's to set, so the dates stay out. */
export const saveBodyOf = (form: GeneralUpdateForm) => {
  const ownSchedule = !usesSuiteSchedule(form);
  return {
    name: form.name,
    startDate:
      ownSchedule && form.startDate
        ? new Date(form.startDate).toISOString()
        : undefined,
    endDate:
      ownSchedule && form.endDate
        ? new Date(form.endDate).toISOString()
        : undefined,
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

/** Members see an update from its start until its end; one with no start is a draft. */
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
  [GeneralUpdateStatus.Draft]: "Not shown to members yet.",
  [GeneralUpdateStatus.Active]: "Members see this on save.",
  [GeneralUpdateStatus.Scheduled]: "Shown from its start date.",
  [GeneralUpdateStatus.Expired]: "Not shown: its end date has passed.",
};

/** What saving the form as it stands does for members, for the save bar. */
export const saveReachOf = (form: GeneralUpdateForm, now: Date): string =>
  usesSuiteSchedule(form)
    ? "Shown on its suite's dates."
    : SAVE_REACH[statusOf(form, now)];
