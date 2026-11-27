import type { GeneralUpdateAdminDto } from "@alliance/shared/client";
import { isEqual } from "es-toolkit";
import { useState, type SetStateAction } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { generalUpdateHref } from "../../lib/hrefs";
import type { useGeneralUpdateAdmin } from "../../lib/useGeneralUpdateAdmin";
import { useLeaveGuard } from "../../lib/useLeaveGuard";
import {
  SAVE_FAILED_FALLBACK,
  SaveState,
  useFocusFirstInvalid,
} from "../../ui/templates/Form";
import { useToast } from "../../ui/ToastProvider";
import {
  EMPTY_FORM,
  formOf,
  saveBodyOf,
  withSuite,
  type GeneralUpdateForm,
} from "./generalUpdateRules";

export type GeneralUpdateErrors = { name?: string };

const newForm = (suiteIdParam: string | null): GeneralUpdateForm => {
  const suiteId = suiteIdParam ? parseInt(suiteIdParam, 10) : NaN;
  return Number.isNaN(suiteId) ? EMPTY_FORM : withSuite(EMPTY_FORM, suiteId);
};

/**
 * The details form of a general update, or of a new one when `updateId` is
 * null. It lives above the record's tabs, so unsaved details survive a look
 * at the Content tab.
 */
export function useGeneralUpdateDetails({
  updateId,
  admin: { query, create, update },
  confirmSave,
}: {
  updateId: number | null;
  admin: ReturnType<typeof useGeneralUpdateAdmin>;
  /** The content check, which may ask before the save goes ahead. */
  confirmSave: (value: unknown) => Promise<boolean>;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { success } = useToast();

  const [seeded, setSeeded] = useState<{
    id: number | null;
    form: GeneralUpdateForm;
  }>(() => ({ id: null, form: newForm(searchParams.get("suiteId")) }));
  const [form, setFormState] = useState(seeded.form);
  const [errors, setErrors] = useState<GeneralUpdateErrors>({});
  const [outcome, setOutcome] = useState<
    { saved: true } | { saved: false; reason: string } | null
  >(null);
  const dirty = !isEqual(form, seeded.form);
  const leave = useLeaveGuard(dirty, { allowSamePath: true });
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();

  const seed = (next: GeneralUpdateAdminDto) => {
    const nextForm = formOf(next);
    setSeeded({ id: next.id, form: nextForm });
    setFormState(nextForm);
    setErrors({});
  };
  // A copy cached by an earlier visit may be stale, and saving a form filled
  // from it would write those stale details back. A later refetch reseeds the
  // form only while it is untouched.
  const loaded = query.data;
  if (
    loaded &&
    loaded.id === updateId &&
    query.isFetchedAfterMount &&
    !query.isError &&
    (seeded.id !== loaded.id ||
      (!dirty && !isEqual(formOf(loaded), seeded.form)))
  ) {
    seed(loaded);
    setOutcome(null);
  }

  const setForm = (next: SetStateAction<GeneralUpdateForm>) => {
    setFormState(next);
    setErrors({});
    setOutcome(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setErrors({ name: "Enter a title" });
      focusFirstInvalid();
      return;
    }
    const body = saveBodyOf(form);
    if (!(await confirmSave(body))) return;
    setOutcome(null);
    try {
      if (updateId === null) {
        const created = await create.mutateAsync(body);
        success("General update created", created.name);
        leave(() => void navigate(generalUpdateHref(created.id)));
      } else {
        const saved = await update.mutateAsync(body);
        seed(saved);
        setOutcome({ saved: true });
        success("General update saved", saved.name);
      }
    } catch (error) {
      setOutcome({
        saved: false,
        reason: adminRefusalMessage(error, SAVE_FAILED_FALLBACK),
      });
    }
  };

  const discard = () => {
    setFormState(seeded.form);
    setErrors({});
    setOutcome(null);
  };

  const state =
    create.isPending || update.isPending
      ? SaveState.Saving
      : outcome?.saved === false
        ? SaveState.Failed
        : dirty
          ? SaveState.Dirty
          : outcome?.saved
            ? SaveState.Saved
            : SaveState.Clean;

  return {
    form,
    setForm,
    formRef,
    errors,
    /** The form holds this record's details, not a stale copy or another's. */
    filled: updateId === null || seeded.id === updateId,
    state,
    saveError: outcome?.saved === false ? outcome.reason : null,
    submit,
    discard,
  };
}

export type GeneralUpdateDetails = ReturnType<typeof useGeneralUpdateDetails>;
