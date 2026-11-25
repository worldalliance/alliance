import type { Result } from "@alliance/common/result";
import type {
  FormulaDto,
  FormulaEditDto,
  FormulaProblemDto,
} from "@alliance/shared/client";
import { thrownStatus } from "@alliance/shared/lib/hey-api";
import { isEqual } from "es-toolkit";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useHref, useNavigate, useParams } from "react-router";
import ConfirmDialog from "../components/ConfirmDialog";
import FormulaFields from "../components/formulas/FormulaFields";
import FormulaFixes from "../components/formulas/FormulaFixes";
import FormulaHistory from "../components/formulas/FormulaHistory";
import {
  partFixChanged,
  type PartFixDraft,
} from "../components/formulas/PartFixFields";
import SaveRefusal, { type Refusal } from "../components/formulas/SaveRefusal";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { asDraft } from "../lib/formulaDraft";
import { refetchFresh } from "../lib/refetchFresh";
import {
  useForgetFormulaAdmin,
  useFormulasAdmin,
  useInvalidateFormulasAdmin,
  useSaveFormulasAdmin,
} from "../lib/useFormulasAdmin";
import { useLeaveGuard } from "../lib/useLeaveGuard";
import Button, { ButtonColor } from "../ui/Button";
import { useToast } from "../ui/ToastProvider";

const NEW = "new";

const FormulaPage: React.FC = () => {
  const { formulaId = NEW } = useParams();
  /** Set by a save, so the remounted editor's Save button takes back focus. */
  const focusSave = useRef(false);
  const takeFocus = useCallback(() => {
    const taking = focusSave.current;
    focusSave.current = false;
    return taking;
  }, []);
  return (
    <LoadedFormula
      // A link to another formula keeps this route mounted; the key makes it
      // fetch the list afresh for each formula opened.
      key={formulaId}
      formulaId={formulaId}
      takeFocus={takeFocus}
      requestFocus={() => {
        focusSave.current = true;
      }}
    />
  );
};

const LoadedFormula: React.FC<{
  formulaId: string;
  takeFocus: () => boolean;
  requestFocus: () => void;
}> = ({ formulaId, takeFocus, requestFocus }) => {
  const formulas = useFormulasAdmin();
  const [saves, setSaves] = useState(0);
  // The editor freezes the list it opens with, so it opens only once its own
  // fetch succeeds, not on a cached list; once open, a failed refetch keeps it.
  const [opened, setOpened] = useState(false);
  if (!opened && formulas.isSuccess && formulas.isFetchedAfterMount) {
    setOpened(true);
  }
  return opened && formulas.data !== undefined ? (
    <FormulaEditor
      // Only the editor's own save remounts it, so a refetch bringing someone
      // else's version keeps the admin's edits, and their save gets a 409.
      key={saves}
      formulaId={formulaId}
      formulas={formulas.data}
      refresh={() => refetchFresh(formulas.refetch)}
      takeFocus={takeFocus}
      requestFocus={requestFocus}
      remount={() => setSaves((count) => count + 1)}
    />
  ) : formulas.isError ? (
    <p className="p-5 text-sm text-red-700" role="alert">
      {adminRefusalMessage(formulas.error, "Couldn't load formulas.")}
    </p>
  ) : (
    <p className="p-5 text-sm text-zinc-600" role="status">
      Loading formula…
    </p>
  );
};

const FormulaEditor: React.FC<{
  formulaId: string;
  formulas: FormulaDto[];
  refresh: () => Promise<Result<FormulaDto[], Error>>;
  /** True once, on the mount that follows the editor's own save. */
  takeFocus: () => boolean;
  requestFocus: () => void;
  remount: () => void;
}> = ({
  formulaId,
  formulas: loaded,
  refresh,
  takeFocus,
  requestFocus,
  remount,
}) => {
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
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  /**
   * A save succeeded. The fields stay read-only until the remount, which would
   * drop edits made meanwhile, or for good when the reload fails, since a
   * further save would carry stale base versions.
   */
  const [saved, setSaved] = useState(false);
  const busy = saveFormulas.isPending || saved;
  /** Cleared on leaving, so a save's reload doesn't touch the page the admin went to. */
  const mounted = useRef(true);
  const saveButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (takeFocus()) saveButton.current?.focus();
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
  const newHref = useHref(`/tasks/formulas/${NEW}`);
  const ownHref = useHref(`/tasks/formulas/${primary.id}`);
  const reload = async () => {
    if (!isNew) return window.location.assign(ownHref);
    // A save can commit and lose its answer, so the new formula may be stored.
    const latest = await refresh();
    const listed =
      latest.ok && latest.value.some((formula) => formula.id === primary.id);
    window.location.assign(listed ? ownHref : newHref);
  };

  if (formulaId !== NEW && isNew) {
    return (
      <div className="p-5 space-y-2">
        <p className="text-sm text-zinc-700">
          This formula doesn&apos;t exist, or was deleted.
        </p>
        <Link to="/tasks/formulas" className="text-sm underline">
          Back to formulas
        </Link>
      </div>
    );
  }

  const problemsFor = (id: string) =>
    problems.filter((problem) => problem.id === id);
  const readers = formulas.filter((formula) =>
    formula.reads.includes(primary.id),
  );
  const reads = formulas.filter((formula) =>
    stored?.reads.includes(formula.id),
  );

  const submit = (deleting: boolean) => {
    setRefusal(null);
    saveFormulas.mutate(
      {
        edits: deleting ? fixes : [primary, ...fixes],
        partFixes: partFixes.map((draft) => draft.fix),
        deletions:
          deleting && primary.baseVersionId !== null
            ? [{ id: primary.id, baseVersionId: primary.baseVersionId }]
            : [],
      },
      {
        onSuccess: async (refused) => {
          setConfirmingDelete(false);
          setProblems(refused);
          setRefusedDelete(deleting);
          if (refused.length > 0) return;
          setFixes([]);
          setPartFixes([]);
          success(deleting ? `Deleted ${stored?.name}.` : "Saved.");
          if (deleting) {
            forget(primary.id);
            navigateUnprompted(() => navigate("/tasks/formulas"));
            await invalidate();
            return;
          }
          if (isNew) {
            // Its page fetches the list afresh, so it finds the new formula.
            navigateUnprompted(() => navigate(`/tasks/formulas/${primary.id}`));
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
          setConfirmingDelete(false);
          setRefusal({
            message: adminRefusalMessage(error, "Couldn't save."),
            outdated: thrownStatus(error) === 409,
          });
        },
      },
    );
  };

  return (
    <div className="p-5 space-y-6">
      <title>{`${isNew ? "New formula" : stored.name} - Admin`}</title>
      <div className="space-y-1">
        <Link to="/tasks/formulas" className="text-sm underline text-zinc-600">
          Formulas
        </Link>
        <h1 className="text-lg font-bold text-zinc-900">
          {isNew ? "New formula" : stored.name}
        </h1>
      </div>

      <SaveRefusal refusal={refusal} onReload={reload} />
      {problems.length > 0 && (
        <p
          role="alert"
          className="border border-red-300 bg-red-50 rounded p-3 text-sm text-red-800 max-w-3xl"
        >
          {refusedDelete
            ? "Nothing was deleted. Fix the problems below, then delete again."
            : "Nothing was saved. Fix the problems below, then save again."}
        </p>
      )}

      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy) submit(false);
        }}
      >
        <FormulaFields
          draft={primary}
          problems={problemsFor(primary.id)}
          onChange={setPrimary}
          readOnly={busy}
        />

        <FormulaFixes
          fixes={fixes}
          onFixesChange={setFixes}
          partFixes={partFixes}
          onPartFixesChange={setPartFixes}
          problems={problems.filter((problem) => problem.id !== primary.id)}
          formulas={formulas}
          readOnly={busy}
          heading="Problems in other formulas and parts"
          onStopped={(id) => {
            setProblems(problems.filter((problem) => problem.id !== id));
            saveButton.current?.focus();
          }}
        />

        <div className="flex gap-3">
          <Button
            ref={saveButton}
            type="submit"
            color={ButtonColor.Black}
            aria-disabled={busy}
            className="aria-disabled:opacity-50 aria-disabled:cursor-not-allowed"
          >
            {saveFormulas.isPending || (saved && refusal === null)
              ? "Saving…"
              : "Save"}
          </Button>
          {!isNew && (
            <Button
              color={ButtonColor.RedOutline}
              aria-disabled={busy}
              className="aria-disabled:opacity-50 aria-disabled:cursor-not-allowed"
              onClick={() => {
                if (!busy) setConfirmingDelete(true);
              }}
            >
              Delete formula
            </Button>
          )}
        </div>
      </form>

      {!isNew && (
        <div className="grid gap-6 md:grid-cols-2 max-w-3xl">
          <FormulaLinks
            title="Uses"
            formulas={reads}
            empty="No other formulas."
          />
          <FormulaLinks
            title="Used by"
            formulas={readers}
            empty="Nothing reads this formula yet."
          />
        </div>
      )}
      {stored !== undefined && <FormulaHistory formula={stored} />}

      <ConfirmDialog
        isOpen={confirmingDelete}
        title={`Delete ${stored?.name ?? "formula"}?`}
        message={
          readers.length > 0
            ? `${readers.length === 1 ? "A formula reads" : `${readers.length} formulas read`} it, so the delete is refused unless the same save fixes what reads it. Its saved versions are kept.`
            : "It leaves the list and its name is free to reuse. Its saved versions are kept."
        }
        confirmLabel="Delete formula"
        destructive
        isLoading={busy}
        onConfirm={() => submit(true)}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
};

const FormulaLinks: React.FC<{
  title: string;
  formulas: FormulaDto[];
  empty: string;
}> = ({ title, formulas, empty }) => (
  <section className="space-y-1">
    <h2 className="font-semibold text-zinc-900">{title}</h2>
    {formulas.length === 0 ? (
      <p className="text-sm text-zinc-600">{empty}</p>
    ) : (
      <ul className="text-sm space-y-1">
        {formulas.map((formula) => (
          <li key={formula.id}>
            <Link
              to={`/tasks/formulas/${formula.id}`}
              className="font-mono underline"
            >
              {formula.name}
            </Link>
          </li>
        ))}
      </ul>
    )}
  </section>
);

export default FormulaPage;
