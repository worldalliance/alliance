import type { AdminActionUpdateDto } from "@alliance/shared/client";
import { isEqual } from "es-toolkit";
import { useCallback, useMemo, useState } from "react";
import {
  detailsBody,
  formOf,
  usesRecognition,
  type ActionUpdateForm,
  type CardImageChoice,
} from "../../../lib/actionUpdateDetails";
import { adminRefusalMessage } from "../../../lib/adminRefusal";
import type { useActionUpdateAdmin } from "../../../lib/useActionUpdateAdmin";
import { useLeaveGuard } from "../../../lib/useLeaveGuard";
import {
  SAVE_FAILED_FALLBACK,
  SaveState,
  useFocusFirstInvalid,
} from "../../../ui/templates/Form";
import { useToast } from "../../../ui/ToastProvider";

export type UpdateDetailsErrors = { title?: string; shortNotifString?: string };

const errorsOf = (form: ActionUpdateForm): UpdateDetailsErrors => ({
  ...(!form.title.trim() && { title: "Enter a title" }),
  ...(!usesRecognition(form.notificationMode) &&
    form.notifyType !== "none" &&
    !form.shortNotifString.trim() && {
      shortNotifString:
        "Write the notification text, or set the audience to No notification",
    }),
});

/**
 * The update's details form. It lives above the record's tabs, so unsaved
 * details survive a look at the Content tab.
 */
export function useUpdateDetails({
  updateId,
  admin: { query, update: updateMutation },
  confirmSave,
}: {
  updateId: number | null;
  admin: ReturnType<typeof useActionUpdateAdmin>;
  /** The content check, which may ask before the save goes ahead. */
  confirmSave: (value: unknown) => Promise<boolean>;
}) {
  const { success } = useToast();
  const update = query.data;
  const [form, setFormState] = useState<ActionUpdateForm | null>(null);
  const [source, setSource] = useState<AdminActionUpdateDto | null>(null);
  const [errors, setErrors] = useState<UpdateDetailsErrors>({});
  const [outcome, setOutcome] = useState<
    { saved: true } | { saved: false; reason: string } | null
  >(null);
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();

  const fill = useCallback((next: AdminActionUpdateDto) => {
    setSource(next);
    setFormState(formOf(next));
    setErrors({});
  }, []);

  // A copy cached by an earlier visit may be stale, and saving a form filled
  // from it would write those stale details back. A newer copy refills a form
  // with no edits, so someone else's change never reads as an unsaved edit.
  const edited = source !== null && !isEqual(form, formOf(source));
  if (
    update &&
    query.isFetchedAfterMount &&
    !query.isError &&
    update !== source &&
    (source?.id !== update.id || !edited)
  ) {
    fill(update);
  }

  // A draft of another update was already discarded at the prompt that left it.
  useLeaveGuard(edited && source?.id === updateId, { allowSamePath: true });

  const savedForm = useMemo(() => update && formOf(update), [update]);
  const filled = updateId !== null && source?.id === updateId;
  const hasUnsavedDetails = !isEqual(form, savedForm);

  const setForm = (next: ActionUpdateForm) => {
    setFormState(next);
    setErrors({});
    setOutcome(null);
  };

  // An upload lands after the edits made while it ran, so it updates the form
  // as it stands rather than the one it was chosen from.
  const setCardImage = (cardImage: CardImageChoice) => {
    setFormState((current) => current && { ...current, cardImage });
    setErrors({});
    setOutcome(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    const found = errorsOf(form);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      focusFirstInvalid();
      return;
    }
    const body = detailsBody(form);
    if (!(await confirmSave(body))) return;
    setOutcome(null);
    try {
      const saved = await updateMutation.mutateAsync(body);
      fill(saved);
      setOutcome({ saved: true });
      success("Project update saved", saved.title);
    } catch (error) {
      setOutcome({
        saved: false,
        reason: adminRefusalMessage(error, SAVE_FAILED_FALLBACK),
      });
    }
  };

  const discard = () => {
    if (source) setForm(formOf(source));
  };

  const state = updateMutation.isPending
    ? SaveState.Saving
    : outcome?.saved === false
      ? SaveState.Failed
      : hasUnsavedDetails
        ? SaveState.Dirty
        : outcome?.saved
          ? SaveState.Saved
          : SaveState.Clean;

  return {
    form,
    setForm,
    setCardImage,
    /** Refills the form from what a write returned. */
    fill,
    formRef,
    errors,
    /** The form holds this update's details, not a stale copy or another's. */
    filled,
    hasUnsavedDetails,
    state,
    saveError: outcome?.saved === false ? outcome.reason : null,
    submit,
    discard,
  };
}

export type UpdateDetails = ReturnType<typeof useUpdateDetails>;
