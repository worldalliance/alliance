import { fieldPickerLabel } from "@alliance/common/forms/element-descriptors";
import type { AnyField } from "@alliance/common/forms/form-schema";
import { useFormOptions } from "@alliance/shared/lib/useFormsAdmin";
import {
  FormFieldsStatus,
  useFormQuestionFields,
  useFormQuestionFieldsPeek,
} from "@alliance/shared/lib/useFormSchema";
import { describeCondition } from "../../../lib/visibilitySummary";
import {
  formFieldsErrorReason,
  FormPickerError,
  FormPickerErrorReason,
} from "../../FormPickerError";
import {
  applyFieldComparison,
  COMPARISON_NEGATES,
  comparisonOf,
  defaultFieldRule,
  FIELD_COMPARISON_LABELS,
  fieldComparisons,
  isConditionalController,
  type ControllerField,
  type FieldCondition,
  type RuleCondition,
} from "./fieldConditions";
import { FieldRuleValue } from "./FieldRuleValue";
import { RetryButton } from "./RetryButton";
import { INPUT_CLASS } from "./styles";

/** A new rule on another form: its first question if already cached, else a
 * blank one the admin picks once the questions load. */
export function crossFormRule(
  formId: number,
  cached: readonly AnyField[] | undefined,
): FieldCondition {
  const first = cached?.find(isConditionalController);
  return first
    ? defaultFieldRule(first, formId)
    : { kind: "hasValue", when: "", hasValue: true, sourceFormId: formId };
}

function SourceFormSelect({
  formId,
  onChange,
}: {
  formId: number;
  onChange: (formId: number) => void;
}) {
  const { options, isLoading, isError, refetch } = useFormOptions();
  const listed = options.some((form) => form.id === formId);
  return (
    <div className="space-y-1">
      <select
        aria-label="Source form"
        className={INPUT_CLASS}
        value={formId}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {!listed && (
          <option value={formId}>
            {isLoading ? `Loading forms… (#${formId})` : `Form #${formId}`}
          </option>
        )}
        {options.map((form) => (
          <option key={form.id} value={form.id}>
            {form.title} (#{form.id})
          </option>
        ))}
      </select>
      {isError && (
        <div className="flex items-center gap-2">
          <FormPickerError
            reason={FormPickerErrorReason.FormList}
            className="text-[11px]"
          />
          <RetryButton onClick={refetch} />
        </div>
      )}
    </div>
  );
}

/** A rule on an answer, on this form or (with `sourceFormId`) another one. */
export function FieldRule({
  condition,
  negated,
  allowNegation,
  earlierControllers,
  laterControllers,
  onChange,
}: {
  condition: FieldCondition;
  negated: boolean;
  allowNegation: boolean;
  earlierControllers: ControllerField[];
  laterControllers: ControllerField[];
  onChange: (rule: RuleCondition) => void;
}) {
  const { sourceFormId } = condition;
  const external = useFormQuestionFields(sourceFormId);
  const peekFormFields = useFormQuestionFieldsPeek();

  const externalControllers =
    sourceFormId === undefined
      ? []
      : external.fields.filter(isConditionalController);
  const pool =
    sourceFormId === undefined
      ? [...earlierControllers, ...laterControllers]
      : externalControllers;
  const controller = pool.find((f) => f.id === condition.when);
  const isLater =
    sourceFormId === undefined &&
    laterControllers.some((f) => f.id === condition.when);
  const externalStatus =
    sourceFormId === undefined ? FormFieldsStatus.Ready : external.status;
  const externalError = formFieldsErrorReason(externalStatus);

  const current = comparisonOf(condition, { negated });
  const comparisons = controller
    ? fieldComparisons(controller).filter(
        (comparison) => allowNegation || !COMPARISON_NEGATES[comparison],
      )
    : [];
  if (current && !comparisons.includes(current)) comparisons.push(current);

  const chooseQuestion = (id: string) => {
    const next = pool.find((f) => f.id === id);
    if (next) {
      onChange({
        condition: defaultFieldRule(next, sourceFormId),
        negated: false,
      });
    }
  };

  const questionOption = (f: ControllerField) => (
    <option key={f.id} value={f.id}>
      {fieldPickerLabel(f)}
    </option>
  );

  return (
    <div className="space-y-2">
      {sourceFormId !== undefined && (
        <SourceFormSelect
          formId={sourceFormId}
          onChange={(formId) =>
            onChange({
              condition: crossFormRule(formId, peekFormFields(formId)),
              negated: false,
            })
          }
        />
      )}
      <select
        aria-label="Question"
        className={INPUT_CLASS}
        value={condition.when}
        disabled={externalStatus !== FormFieldsStatus.Ready}
        onChange={(event) => chooseQuestion(event.target.value)}
      >
        {!controller && (
          <option value={condition.when}>
            {externalStatus === FormFieldsStatus.Pending
              ? "Loading questions…"
              : condition.when === ""
                ? "Choose a question"
                : `Unavailable question (${condition.when})`}
          </option>
        )}
        {sourceFormId === undefined ? (
          <>
            {earlierControllers.map(questionOption)}
            {laterControllers.length > 0 && (
              <optgroup label="Later in form">
                {laterControllers.map(questionOption)}
              </optgroup>
            )}
          </>
        ) : (
          externalControllers.map(questionOption)
        )}
      </select>
      {externalError && sourceFormId !== undefined && (
        <div className="flex items-center gap-2">
          <FormPickerError reason={externalError} className="text-[11px]" />
          <RetryButton onClick={external.refetch} />
        </div>
      )}
      {!controller &&
        condition.when !== "" &&
        externalStatus === FormFieldsStatus.Ready && (
          <p className="text-[11px] text-red-600">
            {sourceFormId === undefined
              ? "This question isn't available to this rule: it was deleted, or it's on a later page."
              : "That form has no question with this id that a rule can use."}{" "}
            The rule still checks: {negated ? "NOT " : ""}
            {describeCondition(condition, (id) => id)}.
          </p>
        )}
      {isLater && (
        <p className="text-[11px] text-amber-600">
          This field comes later in the form, so this element can appear or
          disappear above where the member is answering.
        </p>
      )}
      {controller && current && (
        <>
          <select
            aria-label="Comparison"
            className={INPUT_CLASS}
            value={current}
            onChange={(event) => {
              const comparison = comparisons.find(
                (c) => c === event.target.value,
              );
              if (!comparison) return;
              onChange(
                applyFieldComparison({
                  comparison,
                  controller,
                  sourceFormId,
                  previous: condition,
                }),
              );
            }}
          >
            {comparisons.map((comparison) => (
              <option key={comparison} value={comparison}>
                {FIELD_COMPARISON_LABELS[comparison]}
              </option>
            ))}
          </select>
          <FieldRuleValue
            comparison={current}
            controller={controller}
            condition={condition}
            onChange={(next) => onChange({ condition: next, negated })}
          />
        </>
      )}
    </div>
  );
}
