import {
  NOT_SUBMITTED,
  type SubmitOutcome,
} from "@alliance/shared/forms/submitOutcome";
import { type useFormValidation } from "@alliance/shared/forms/useFormValidation";

export async function submitForm(
  params: Pick<ReturnType<typeof useFormValidation>, "validateAllPages"> & {
    /** Null when the form has nowhere to submit to, as in a preview. */
    send: (() => Promise<boolean>) | null;
    pauseSyncing: () => void;
    resumeSyncing: () => void;
    clearStoredDraft: () => void;
  },
): Promise<SubmitOutcome> {
  const { isValid, firstInvalidPageIndex } = await params.validateAllPages();
  if (!isValid) return { submitted: false, firstInvalidPageIndex };
  if (!params.send) return NOT_SUBMITTED;

  params.pauseSyncing();
  try {
    const submitted = await params.send();
    if (submitted) params.clearStoredDraft();
    else params.resumeSyncing();
    return { submitted, firstInvalidPageIndex: null };
  } catch {
    params.resumeSyncing();
    return NOT_SUBMITTED;
  }
}
