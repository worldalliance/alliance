import type { Result } from "@alliance/common/result";
import type {
  FormulaDto,
  FormulaEditDto,
  FormulaProblemDto,
} from "@alliance/shared/client";
import { thrownStatus } from "@alliance/shared/lib/hey-api";
import { isEqual } from "es-toolkit";
import { useEffect, useRef, useState } from "react";
import { useHref, useNavigate } from "react-router";
import {
  partFixChanged,
  type PartFixDraft,
} from "../../components/formulas/PartFixFields";
import type { Refusal } from "../../components/formulas/SaveRefusal";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { asDraft } from "../../lib/formulaDraft";
import {
  useForgetFormulaAdmin,
  useInvalidateFormulasAdmin,
  useSaveFormulasAdmin,
} from "../../lib/useFormulasAdmin";
import { useLeaveGuard } from "../../lib/useLeaveGuard";
import { SAVE_FAILED_FALLBACK, SaveState } from "../../ui/templates/Form";
import { useToast } from "../../ui/ToastProvider";
import { formulaPath, FORMULAS_HREF, NEW } from "./formulaRules";

export type FormulaEditorParams = {
  formulaId: string;
  formulas: FormulaDto[];
  refresh: () => Promise<Result<FormulaDto[], unknown>>;
  /** True once, on the mount that follows the editor's own save. */
  takeFocus: () => boolean;
  requestFocus: () => void;
  remount: () => void;
};

export type FormulaEditor = ReturnType<typeof useFormulaEditor>;

export function useFormulaEditor({
  formulaId,
  formulas: loaded,
  refresh,
  takeFocus,
  requestFocus,
  remount,
}: FormulaEditorParams) {
  /** The list as the editor opened it, which unsaved changes are measured against. */
  const [formulas] = useState(loaded);
  const navigate = useNavigate();
  const { success } = useToast();
  const saveFormulas = useSaveFormulasAdmin();
  const invalidate = useInvalidateFormulasAdmin();
  const forget = useForgetFormulaAdmin();
  const stored = formulas.find((formula) => formula.id === formulaId);
  const [primary, setPrimary] = useState<FormulaEditDto>(() =>
    stored === undefined
      ? {
          id: crypto.randomUUID(),
          baseVersionId: null,
          name: "",
          text: "",
          notes: null,
        }
      : asDraft(stored),
  );
  /** Other formulas the admin is fixing in the same save. */
  const [fixes, setFixes] = useState<FormulaEditDto[]>([]);
  const [partFixes, setPartFixes] = useState<PartFixDraft[]>([]);
  const [problems, setProblems] = useState<FormulaProblemDto[]>([]);
  const [refusedDelete, setRefusedDelete] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  /** Why the last save failed, for its SaveBar; a 409 is a refusal instead, for its Reload. */
  const [saveError, setSaveError] = useState<string | null>(null);
  /**
   * A save succeeded. The fields stay read-only until the remount, which would
   * drop edits made meanwhile, or for good when the reload fails, since a
   * further save would carry stale base versions.
   */
  const [saved, setSaved] = useState(false);
  const busy = saveFormulas.isPending || saved;
  const deleting =
    saveFormulas.isPending &&
    (saveFormulas.variables?.deletions.length ?? 0) > 0;
  /** Cleared on leaving, so a save's reload doesn't touch the page the admin went to. */
  const mounted = useRef(true);
  /** The form, whose submit button is the bar's Save. */
  const formRef = useRef<HTMLFormElement>(null);
  const focusSave = () =>
    formRef.current
      ?.querySelector<HTMLButtonElement>("button[type=submit]")
      ?.focus();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (takeFocus()) focusSave();
  }, [takeFocus]);

  const original = new Map(formulas.map((formula) => [formula.id, formula]));
  const isNew = stored === undefined;
  const changed = (draft: FormulaEditDto) => {
    const before = original.get(draft.id);
    return before === undefined
      ? draft.name !== "" || draft.text !== "" || draft.notes !== null
      : !isEqual(draft, asDraft(before));
  };
  const hasUnsavedChanges =
    !saved &&
    (changed(primary) || fixes.some(changed) || partFixes.some(partFixChanged));
  const navigateUnprompted = useLeaveGuard(hasUnsavedChanges);
  const ownPath = formulaPath(primary.id);
  const newHref = useHref(formulaPath(NEW));
  const ownHref = useHref(ownPath);
  const reload = async () => {
    if (!isNew) return window.location.assign(ownHref);
    // A save can commit and lose its answer, so the new formula may be stored.
    const latest = await refresh();
    const listed =
      latest.ok && latest.value.some((formula) => formula.id === primary.id);
    window.location.assign(listed ? ownHref : newHref);
  };

  const readers = formulas.filter((formula) =>
    formula.reads.includes(primary.id),
  );
  const reads = formulas.filter((formula) =>
    stored?.reads.includes(formula.id),
  );

  const submit = (deletingNow: boolean) => {
    setRefusal(null);
    setSaveError(null);
    saveFormulas.mutate(
      {
        edits: deletingNow ? fixes : [primary, ...fixes],
        partFixes: partFixes.map((draft) => draft.fix),
        deletions:
          deletingNow && primary.baseVersionId !== null
            ? [{ id: primary.id, baseVersionId: primary.baseVersionId }]
            : [],
      },
      {
        onSuccess: async (refused) => {
          setProblems(refused);
          setRefusedDelete(deletingNow);
          if (refused.length > 0) return;
          setFixes([]);
          setPartFixes([]);
          success(deletingNow ? `Deleted ${stored?.name}.` : "Saved.");
          if (deletingNow) {
            forget(primary.id);
            navigateUnprompted(() => navigate(FORMULAS_HREF));
            await invalidate();
            return;
          }
          if (isNew) {
            // Its page fetches the list afresh, so it finds the new formula.
            navigateUnprompted(() => navigate(ownPath));
            requestFocus();
            return;
          }
          // Remounting on the list from before the save would show the old text.
          setSaved(true);
          const refreshed = await refresh();
          if (!mounted.current) return;
          if (!refreshed.ok) {
            setRefusal({
              message: "Saved, but couldn't load it again. Reload to see it.",
              outdated: true,
            });
            return;
          }
          requestFocus();
          remount();
        },
        onError: (error) => {
          const outdated = thrownStatus(error) === 409;
          if (deletingNow || outdated) {
            setRefusal({
              message: adminRefusalMessage(
                error,
                deletingNow
                  ? "Couldn't delete the formula."
                  : "Couldn't save the formula.",
              ),
              outdated,
            });
          } else {
            setSaveError(adminRefusalMessage(error, SAVE_FAILED_FALLBACK));
          }
        },
      },
    );
  };

  const saveState =
    saveFormulas.isPending || (saved && refusal === null)
      ? SaveState.Saving
      : saveError !== null
        ? SaveState.Failed
        : hasUnsavedChanges
          ? SaveState.Dirty
          : SaveState.Clean;
  const saveStateText: Partial<Record<SaveState, string>> | undefined = deleting
    ? { [SaveState.Saving]: "Deleting…" }
    : saved
      ? { [SaveState.Clean]: "Reload to keep editing" }
      : undefined;

  return {
    formulas,
    stored,
    isNew,
    primary,
    setPrimary,
    fixes,
    setFixes,
    partFixes,
    setPartFixes,
    problems,
    /** The problems that refused the last save in what the primary fields hold. */
    primaryProblems: problems.filter((problem) => problem.id === primary.id),
    otherProblems: problems.filter((problem) => problem.id !== primary.id),
    refusedDelete,
    refusal,
    saveError,
    busy,
    deleting,
    saveState,
    saveStateText,
    readers,
    reads,
    formRef,
    reload,
    save: () => {
      if (!busy) submit(false);
    },
    remove: () => submit(true),
    discard: () => {
      requestFocus();
      remount();
    },
    /** "Stop fixing it" dropped the fix of `id`. */
    stopFixing: (id: string) => {
      setProblems(problems.filter((problem) => problem.id !== id));
      focusSave();
    },
  };
}
