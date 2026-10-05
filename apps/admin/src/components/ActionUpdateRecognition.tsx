import type { ContributionFormula } from "@alliance/common/forms/contribution-formula";
import {
  readableVariableInputFields,
  variableInputFieldsById,
  type AnyField,
} from "@alliance/common/forms/form-schema";
import { R } from "@alliance/common/result";
import type { Assert, Equal } from "@alliance/common/types";
import {
  actionsCheckUpdateRecognitionAdmin,
  type RecognitionCheckDto,
} from "@alliance/shared/client";
import {
  FormFieldsStatus,
  useFormQuestionFieldsMap,
} from "@alliance/shared/lib/useFormSchema";
import { minBy, uniqBy } from "es-toolkit";
import { useMemo, useState } from "react";
import {
  activeFormula,
  withActiveFormula,
  type ActionUpdateForm,
  type RecognitionMode,
} from "../lib/actionUpdateDetails";
import { adminRefusalMessage } from "../lib/adminRefusal";
import FormSection from "./FormSection";
import { FormulaEditor } from "./FormulaEditor";
import { FormulaResult } from "./formulaResult";
import type { InputSources } from "./VariableInputPickers";

const RECOGNITION_MODE_LABELS: Record<RecognitionMode, string> = {
  normal: "Normal: “Your … led to …”",
  retrospective: "Retrospective: “… weeks ago you …”",
};

const RECOGNITION_MODES = [
  "normal",
  "retrospective",
] as const satisfies readonly RecognitionMode[];

type _typecheck = Assert<
  Equal<(typeof RECOGNITION_MODES)[number], RecognitionMode>
>;

const FORMULA_COPY: Record<
  RecognitionMode,
  { title: string; description: string }
> = {
  normal: {
    title: "Contribution",
    description:
      "Completes “Your #{contribution} led to #{alliance_result}.” from each member's answers, e.g. “3 letters”.",
  },
  retrospective: {
    title: "Retrospective contribution",
    description:
      "Completes “#{weeksago} weeks ago you #{contribution}. #{alliance_result}.” from each member's answers, e.g. “sent 3 letters”. Within a week it reads “Recently you …”, and at one week “1 week ago you …”.",
  },
};

export const COLLECTIVE_RESULT_DESCRIPTIONS: Record<RecognitionMode, string> = {
  normal:
    "Members who completed the action and drew personal recognition read “Your #{contribution} led to” this. Everyone else reads it on its own, after “Update: ” in pushes and texts.",
  retrospective:
    "Members who completed the action and drew personal recognition read “#{weeksago} weeks ago you #{contribution}.” (or “Recently you …” within a week) and then this as its own sentence. Everyone else reads it on its own, after “Update: ” in pushes and texts.",
};

export function RecognitionModeSelect({
  value,
  onChange,
  className,
}: {
  value: RecognitionMode;
  onChange: (mode: RecognitionMode) => void;
  className: string;
}) {
  return (
    <select
      className={className}
      value={value}
      onChange={(e) => {
        const mode = RECOGNITION_MODES.find(
          (option) => option === e.target.value,
        );
        if (mode) onChange(mode);
      }}
    >
      {RECOGNITION_MODES.map((mode) => (
        <option key={mode} value={mode}>
          {RECOGNITION_MODE_LABELS[mode]}
        </option>
      ))}
    </select>
  );
}

export enum ActionFormStatus {
  Loading = "loading",
  LoadFailed = "loadFailed",
  Loaded = "loaded",
}

export type ActionForm =
  | { status: ActionFormStatus.Loading }
  | { status: ActionFormStatus.LoadFailed }
  | {
      status: ActionFormStatus.Loaded;
      taskFormId: number | undefined;
      variantFormIds: readonly number[];
    };

/** Every form a member may have answered: the action's own, then its variants. */
export const actionFormIds = (actionForm: ActionForm): number[] =>
  actionForm.status === ActionFormStatus.Loaded
    ? [
        // The API sends null for a form-less action, despite the generated type.
        ...(actionForm.taskFormId == null ? [] : [actionForm.taskFormId]),
        ...actionForm.variantFormIds,
      ]
    : [];

const EMPTY_FORMULA: ContributionFormula = { inputs: {}, formula: "" };

const STATUS_PRECEDENCE: Record<FormFieldsStatus, number> = {
  [FormFieldsStatus.LoadFailed]: 0,
  [FormFieldsStatus.SchemaUnreadable]: 1,
  [FormFieldsStatus.Pending]: 2,
  [FormFieldsStatus.Ready]: 3,
};

/** The status that most limits what the picker can offer across all forms. */
export const combinedFormFieldsStatus = (
  statuses: readonly FormFieldsStatus[],
): FormFieldsStatus =>
  minBy(statuses, (status) => STATUS_PRECEDENCE[status]) ??
  FormFieldsStatus.Ready;

/**
 * Each completion links to answers on whichever of the action's forms the
 * member got, so the picker offers every form's questions. A field id on
 * several forms shows the earliest form's field.
 */
export const actionFormFields = (
  formIds: readonly number[],
  byForm: Readonly<Record<number, readonly AnyField[]>>,
): AnyField[] =>
  uniqBy(
    formIds.flatMap((formId) =>
      readableVariableInputFields(byForm[formId] ?? []),
    ),
    (field) => field.id,
  );

function useActionFormSources(formIds: readonly number[]): {
  sources: InputSources;
  status: FormFieldsStatus;
} {
  const { byForm, statusByForm } = useFormQuestionFieldsMap(formIds);
  const status = combinedFormFieldsStatus(
    formIds.map((formId) => statusByForm[formId] ?? FormFieldsStatus.Pending),
  );
  const sources = useMemo((): InputSources => {
    const readable = actionFormFields(formIds, byForm);
    return {
      fieldsFor: (sourceFormId) => (sourceFormId === undefined ? readable : []),
      statusOf: () => undefined,
      forms: [],
      ownForm: undefined,
      formsLoaded: true,
      scope: {
        fields: variableInputFieldsById(readable),
        sourceFields: new Map(),
      },
    };
  }, [formIds, byForm]);
  return { sources, status };
}

export function actionFormNotice(
  actionForm: ActionForm,
  fieldsStatus: FormFieldsStatus,
): string | null {
  switch (actionForm.status) {
    case ActionFormStatus.Loading:
      return "Loading the action's form…";
    case ActionFormStatus.LoadFailed:
      return "The action's forms couldn't be loaded, so their questions aren't listed.";
    case ActionFormStatus.Loaded:
      if (actionFormIds(actionForm).length === 0) {
        return "This action has no form, so the formula can't read any answers.";
      }
      switch (fieldsStatus) {
        case FormFieldsStatus.Pending:
          return "Loading the action's form…";
        case FormFieldsStatus.LoadFailed:
        case FormFieldsStatus.SchemaUnreadable:
          return actionFormIds(actionForm).length > 1
            ? "One of the action's forms couldn't be loaded, so its questions aren't listed."
            : "The action's form couldn't be loaded.";
        case FormFieldsStatus.Ready:
          return null;
        default:
          throw new Error(
            `unknown form fields status: ${fieldsStatus satisfies never}`,
          );
      }
    default:
      throw new Error(`unknown action form: ${actionForm satisfies never}`);
  }
}

function ContributionFormulaField({
  mode,
  actionForm,
  formula,
  onChange,
}: {
  mode: RecognitionMode;
  actionForm: ActionForm;
  formula: ContributionFormula | null;
  onChange: (formula: ContributionFormula) => void;
}) {
  const formIds = useMemo(() => actionFormIds(actionForm), [actionForm]);
  const { sources, status } = useActionFormSources(formIds);
  const copy = FORMULA_COPY[mode];
  const notice = actionFormNotice(actionForm, status);
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">{copy.title}</p>
      <p className="text-xs text-gray-500">{copy.description}</p>
      {notice && <p className="text-xs text-amber-700">{notice}</p>}
      <FormulaEditor
        formula={formula ?? EMPTY_FORMULA}
        result={FormulaResult.Text}
        sources={sources}
        onChange={onChange}
      />
    </div>
  );
}

export function RecognitionCopySection({
  form,
  mode,
  prepared,
  actionForm,
  onChange,
}: {
  form: ActionUpdateForm;
  mode: RecognitionMode;
  prepared: boolean;
  actionForm: ActionForm;
  onChange: (form: ActionUpdateForm) => void;
}) {
  const { formulas } = form;
  return (
    <FormSection
      title="Recognition copy"
      description="Completers are split once, at random, between personal recognition and the collective result alone, and keep their side for every update."
    >
      {prepared ? (
        <p className="text-sm text-gray-700">
          Each member&apos;s copy was frozen when this update came due, so
          changing the collective result, mode or formula no longer reaches
          anyone.
        </p>
      ) : formulas ? (
        <div className="space-y-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">Mode</span>
            <RecognitionModeSelect
              value={mode}
              onChange={(notificationMode) =>
                onChange({ ...form, notificationMode })
              }
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            />
          </label>
          <ContributionFormulaField
            key={mode}
            mode={mode}
            actionForm={actionForm}
            formula={activeFormula(formulas, mode)}
            onChange={(formula) =>
              onChange({
                ...form,
                formulas: withActiveFormula({ formulas, mode, formula }),
              })
            }
          />
        </div>
      ) : (
        <p className="text-sm text-red-700" role="alert">
          A saved contribution formula can&apos;t be read by this version of the
          admin panel. Refresh the page before editing it.
        </p>
      )}
    </FormSection>
  );
}

export function NotificationHeldBanner({ reason }: { reason: string }) {
  return (
    <div
      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
      role="alert"
    >
      <p className="font-medium">
        This update&apos;s notifications are on hold.
      </p>
      <p>{reason}</p>
      <p className="mt-1 text-xs">
        Fix the copy and save; they go out within a minute.
      </p>
    </div>
  );
}

/** Evaluates the saved copy for everyone it would go to now. */
export function RecognitionCheck({
  updateId,
  disabledReason,
}: {
  updateId: number;
  disabledReason: string | null;
}) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<RecognitionCheckDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runCheck = async () => {
    setChecking(true);
    setError(null);
    const checked = await R.fromPromise(
      actionsCheckUpdateRecognitionAdmin({
        path: { id: updateId },
        throwOnError: true,
      }),
      (thrown) => {
        console.error(thrown);
        return adminRefusalMessage(thrown, "Couldn't check the recipients.");
      },
    );
    setChecking(false);
    setResult(checked.ok ? checked.value.data : null);
    if (!checked.ok) setError(checked.error);
  };

  const clean =
    result && result.problems.length === 0 && result.members.length === 0;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={runCheck}
          disabled={checking || disabledReason !== null}
          className="px-3 py-1.5 border border-gray-300 bg-white text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
        >
          {checking ? "Checking..." : "Check recipients"}
        </button>
        <p className="text-xs text-gray-500">
          {disabledReason ??
            "Resolves each recipient's contribution, as sending would."}
        </p>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {result && (
        <p className="text-sm text-gray-700">
          Collective result in email subjects: “{result.collectiveSubject}”
        </p>
      )}
      {clean && (
        <p className="text-sm text-green-700">
          Every recipient&apos;s copy resolves.
        </p>
      )}
      {result && !clean && (
        <div
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {result.problems.map((problem) => (
            <p key={problem}>{problem}</p>
          ))}
          {result.members.length > 0 && (
            <>
              <p className="font-medium">
                The contribution doesn&apos;t resolve for these members:
              </p>
              <ul className="list-disc pl-5">
                {result.members.map((member) => (
                  <li key={member.userId}>
                    {member.name} (#{member.userId}): {member.error}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
