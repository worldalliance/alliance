import type { AnyField } from "@alliance/common/forms/form-schema";
import type {
  Condition,
  FormulaNode,
  VisibleIfFormula,
} from "@alliance/common/forms/visible-if-formula";
import {
  formulaConditionNames,
  parseVisibilityFormula,
  serializeVisibilityFormula,
} from "@alliance/shared/forms/visibilityFormula";
import { cn } from "@alliance/shared/styles/util";
import { useMemo, useState } from "react";
import {
  isDraftValidatorId,
  useCustomValidatorDrafts,
} from "../customValidatorDrafts";
import { AddRuleMenu } from "./AddRuleMenu";
import {
  buildFormula,
  checkExpression,
  Combinator,
  nextConditionName,
  sameFormula,
  simpleFormulaOf,
  sortedConditionNames,
  type SimpleFormula,
} from "./conditionFormula";
import { ConditionRule, type RuleSources } from "./ConditionRule";
import type { OutputBlockOption } from "./ContextRules";
import { ExpressionEditor } from "./ExpressionEditor";
import { isConditionalController, type RuleCondition } from "./fieldConditions";
import { INPUT_CLASS } from "./styles";

const BUTTON_CLASS =
  "rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100";

type ConditionalVisibilityProps = {
  field: { id?: string; visibleIfFormula?: VisibleIfFormula };
  previousFields: AnyField[];
  /** Fields after the element on its page, listed under "Later in form". */
  laterFields?: AnyField[];
  onChange: (updates: { visibleIfFormula?: VisibleIfFormula }) => void;
  /**
   * When provided, enables an "output block visible" condition type referencing
   * any other block (field or display) in the current output view by id. Only
   * meaningful inside the output view builder.
   */
  outputBlocks?: OutputBlockOption[];
};

function ReplaceExpression({
  onChoose,
}: {
  onChoose: (combinator: Combinator) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
      Replace the expression with:
      <button
        type="button"
        className={BUTTON_CLASS}
        onClick={() => onChoose(Combinator.All)}
      >
        All rules
      </button>
      <button
        type="button"
        className={BUTTON_CLASS}
        onClick={() => onChoose(Combinator.Any)}
      >
        Any rule
      </button>
    </div>
  );
}

export function ConditionalVisibility({
  field,
  previousFields,
  laterFields,
  onChange,
  outputBlocks,
}: ConditionalVisibilityProps) {
  const visibility = field.visibleIfFormula;
  const { removeDraft } = useCustomValidatorDrafts();
  const sources = useMemo<RuleSources>(
    () => ({
      earlierControllers: previousFields.filter(isConditionalController),
      laterControllers: (laterFields ?? []).filter(isConditionalController),
      outputBlocks,
      selfId: field.id,
    }),
    [previousFields, laterFields, outputBlocks, field.id],
  );

  const simple = visibility ? simpleFormulaOf(visibility) : null;
  const [expressionRequested, setExpressionRequested] = useState(
    () => visibility !== undefined && simple === null,
  );
  const advanced = expressionRequested || (!!visibility && simple === null);
  const conditions = visibility?.conditions ?? {};

  // Null while the expression shows the saved formula. Typed text stays as
  // typed while it matches the saved formula, and stays with its error while
  // it doesn't parse or names a missing rule, instead of being saved.
  const [typed, setTyped] = useState<string | null>(null);
  const [syncedFormula, setSyncedFormula] = useState(visibility?.formula);
  if (visibility?.formula !== syncedFormula) {
    setSyncedFormula(visibility?.formula);
    if (typed !== null) {
      const parsed = parseVisibilityFormula(typed);
      const wasSaved =
        parsed.ok &&
        !!syncedFormula &&
        sameFormula(parsed.value, syncedFormula);
      const checked = checkExpression(typed, conditions);
      const isSaved =
        checked.ok &&
        !!visibility &&
        sameFormula(checked.value, visibility.formula);
      if (wasSaved && !isSaved) setTyped(null);
    }
  }
  const expressionText =
    typed ?? (visibility ? serializeVisibilityFormula(visibility.formula) : "");
  const checkedText = checkExpression(expressionText, conditions);
  const blankAndUnconditional =
    visibility === undefined && expressionText.trim() === "";
  const textSaved =
    typed === null ||
    blankAndUnconditional ||
    (checkedText.ok &&
      !!visibility &&
      sameFormula(checkedText.value, visibility.formula));
  const canLeaveExpression =
    advanced && textSaved && (visibility === undefined || simple !== null);
  if (advanced && !expressionRequested) setExpressionRequested(true);

  const write = (
    nextConditions: Record<string, Condition>,
    formula: FormulaNode | null,
  ) =>
    onChange({
      visibleIfFormula:
        formula === null ? undefined : { conditions: nextConditions, formula },
    });
  const writeSimple = (
    nextConditions: Record<string, Condition>,
    next: SimpleFormula,
  ) => write(nextConditions, buildFormula(next));

  const combinator = simple?.combinator ?? Combinator.All;
  const rules = advanced
    ? sortedConditionNames(conditions).map((name) => ({
        name,
        negated: false,
      }))
    : (simple?.rules ?? []);
  const referenced = new Set(
    visibility ? formulaConditionNames(visibility.formula) : [],
  );

  const addRule = (condition: Condition) => {
    const name = nextConditionName(visibility);
    const nextConditions = { ...conditions, [name]: condition };
    if (advanced) {
      const pending =
        typed === null ? null : checkExpression(typed, nextConditions);
      write(
        nextConditions,
        pending?.ok ? pending.value : (visibility?.formula ?? name),
      );
    } else {
      writeSimple(nextConditions, {
        combinator,
        rules: [...rules, { name, negated: false }],
      });
    }
  };

  const removeRule = (name: string) => {
    if (advanced && referenced.has(name)) return;
    const removed = conditions[name];
    if (
      removed?.kind === "validator" &&
      isDraftValidatorId(removed.validatorId)
    ) {
      removeDraft(removed.validatorId);
    }
    const { [name]: _removed, ...nextConditions } = conditions;
    if (advanced) {
      write(nextConditions, visibility?.formula ?? null);
    } else {
      writeSimple(nextConditions, {
        combinator,
        rules: rules.filter((rule) => rule.name !== name),
      });
    }
  };

  const changeRule = ({
    name,
    negated,
    next,
  }: {
    name: string;
    negated: boolean;
    next: RuleCondition;
  }) => {
    const nextConditions = { ...conditions, [name]: next.condition };
    if (advanced || next.negated === negated) {
      write(nextConditions, visibility?.formula ?? null);
    } else {
      writeSimple(nextConditions, {
        combinator,
        rules: rules.map((rule) =>
          rule.name === name ? { name, negated: next.negated } : rule,
        ),
      });
    }
  };

  const replaceExpression = (chosen: Combinator) => {
    setExpressionRequested(false);
    setTyped(null);
    writeSimple(conditions, {
      combinator: chosen,
      rules: sortedConditionNames(conditions).map((name) => ({
        name,
        negated: false,
      })),
    });
  };

  return (
    <div className="space-y-2 pt-2">
      <span className="block text-xs font-medium text-gray-700">
        Conditional visibility
      </span>
      {advanced ? (
        <ExpressionEditor
          text={expressionText}
          error={
            blankAndUnconditional
              ? null
              : checkedText.ok
                ? null
                : checkedText.error
          }
          onChange={(text) => {
            setTyped(text);
            const checked = checkExpression(text, conditions);
            if (
              checked.ok &&
              !(visibility && sameFormula(checked.value, visibility.formula))
            ) {
              write(conditions, checked.value);
            }
          }}
        />
      ) : rules.length === 0 ? (
        <p className="text-[11px] text-gray-500">
          Always shown. Add a rule to show this only when it matches.
        </p>
      ) : (
        rules.length > 1 && (
          <label className="flex items-center gap-2 whitespace-nowrap text-xs text-gray-700">
            Show when
            <select
              aria-label="Combine rules"
              className={cn(INPUT_CLASS, "w-auto")}
              value={combinator}
              onChange={(event) =>
                writeSimple(conditions, {
                  combinator:
                    event.target.value === Combinator.Any
                      ? Combinator.Any
                      : Combinator.All,
                  rules,
                })
              }
            >
              <option value={Combinator.All}>all of these rules match</option>
              <option value={Combinator.Any}>any of these rules match</option>
            </select>
          </label>
        )
      )}
      {rules.length > 0 && (
        <ul className="space-y-2">
          {rules.map(({ name, negated }) => {
            const condition = conditions[name];
            if (!condition) return null;
            return (
              <ConditionRule
                key={name}
                name={name}
                condition={condition}
                negated={negated}
                showName={advanced}
                unreferenced={advanced && !referenced.has(name)}
                removable={!advanced || !referenced.has(name)}
                allowNegation={!advanced}
                sources={sources}
                onChange={(next) => changeRule({ name, negated, next })}
                onRemove={() => removeRule(name)}
              />
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <AddRuleMenu sources={sources} onAdd={addRule} />
        {!advanced && (
          <button
            type="button"
            className={BUTTON_CLASS}
            onClick={() => setExpressionRequested(true)}
          >
            Edit as expression
          </button>
        )}
        {canLeaveExpression && (
          <button
            type="button"
            className={BUTTON_CLASS}
            onClick={() => {
              setExpressionRequested(false);
              setTyped(null);
            }}
          >
            Use all/any rules
          </button>
        )}
      </div>
      {advanced && !canLeaveExpression && (
        <ReplaceExpression onChoose={replaceExpression} />
      )}
    </div>
  );
}
