import type { Dispatch, SetStateAction } from "react";

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

export const withSuite = (
  form: GeneralUpdateForm,
  suiteId: number,
): GeneralUpdateForm =>
  form.suiteIds.includes(suiteId)
    ? form
    : { ...form, suiteIds: [...form.suiteIds, suiteId] };

export const usesSuiteSchedule = (form: GeneralUpdateForm) =>
  form.suiteIds.length > 0;
