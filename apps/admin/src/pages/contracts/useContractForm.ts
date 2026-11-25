import type { ContractAdminDto } from "@alliance/shared/client";
import { isEqual } from "es-toolkit";
import { useState, type SetStateAction } from "react";
import { useNavigate } from "react-router";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { contractHref } from "../../lib/hrefs";
import type { useContractAdmin } from "../../lib/useContractAdmin";
import { useLeaveGuard } from "../../lib/useLeaveGuard";
import {
  SAVE_FAILED_FALLBACK,
  SaveState,
  useFocusFirstInvalid,
} from "../../ui/templates/Form";
import { useToast } from "../../ui/ToastProvider";
import {
  comparableOf,
  EMPTY_FORM,
  errorsOf,
  formOf,
  hasErrors,
  memberPointsOf,
  saveBodyOf,
  type ContractErrors,
  type ContractForm,
} from "./contractForm";
import { contractName } from "./contractRules";

/** The contract's form, or a new one's when `contractId` is null. */
export function useContractForm({
  contractId,
  contracts,
  admin: { query, create, update },
  confirmSave,
}: {
  contractId: number | null;
  /** The list, for the rules that depend on the other contracts; null while unknown. */
  contracts: readonly ContractAdminDto[] | null;
  admin: ReturnType<typeof useContractAdmin>;
  /** The content check, which may ask before the save goes ahead. */
  confirmSave: (value: unknown) => Promise<boolean>;
}) {
  const navigate = useNavigate();
  const { success } = useToast();
  const isNew = contractId === null;

  const [seeded, setSeeded] = useState<{
    id: number | null;
    form: ContractForm;
  }>({ id: null, form: EMPTY_FORM });
  const [form, setFormState] = useState(seeded.form);
  const [submitted, setSubmitted] = useState(false);
  const [outcome, setOutcome] = useState<
    { saved: true } | { saved: false; reason: string } | null
  >(null);
  const dirty = !isEqual(comparableOf(form), comparableOf(seeded.form));
  const pointsChanged = !isEqual(
    memberPointsOf(form),
    memberPointsOf(seeded.form),
  );
  const datesChanged =
    form.startDate !== seeded.form.startDate ||
    form.endDate !== seeded.form.endDate;
  const leave = useLeaveGuard(dirty);
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();

  /** Refills the form, except where it has changed since `sent` was saved. */
  const seed = (next: ContractAdminDto, sent?: ContractForm) => {
    const nextForm = formOf(next);
    setSeeded({ id: next.id, form: nextForm });
    setFormState((current) =>
      sent === undefined || current === sent ? nextForm : current,
    );
    setSubmitted(false);
  };
  // A reload refills the form only while it is untouched, so it never
  // overwrites unsaved edits; a copy cached by an earlier visit waits for the
  // fresh one, so stale details are never saved back.
  const loaded = query.data;
  if (
    loaded &&
    loaded.id === contractId &&
    query.isFetchedAfterMount &&
    !query.isError &&
    (seeded.id !== loaded.id ||
      (!dirty &&
        !isEqual(comparableOf(formOf(loaded)), comparableOf(seeded.form))))
  ) {
    seed(loaded);
    setOutcome(null);
  }

  // Shown from the first submit on, so each clears as soon as it is fixed.
  const errors: ContractErrors = submitted
    ? errorsOf(form, { contractId, contracts, datesChanged, now: new Date() })
    : {};

  const setForm = (next: SetStateAction<ContractForm>) => {
    setFormState(next);
    setOutcome(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (
      hasErrors(
        errorsOf(form, {
          contractId,
          contracts,
          datesChanged,
          now: new Date(),
        }),
      )
    ) {
      focusFirstInvalid();
      return;
    }
    const body = saveBodyOf(form);
    if (!(await confirmSave(isNew ? body.create : body.update))) return;
    setOutcome(null);
    try {
      if (isNew) {
        const created = await create.mutateAsync(body.create);
        success("Contract created", contractName(created));
        leave(() => void navigate(contractHref(created.id)));
      } else {
        const saved = await update.mutateAsync(body.update);
        seed(saved, form);
        setOutcome({ saved: true });
        success("Contract saved", contractName(saved));
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
    setSubmitted(false);
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
    /** The form holds this contract, not a stale copy or another's. */
    filled: isNew || seeded.id === contractId,
    state,
    pointsChanged,
    saveError: outcome?.saved === false ? outcome.reason : null,
    submit,
    discard,
  };
}

export type ContractFormState = ReturnType<typeof useContractForm>;
