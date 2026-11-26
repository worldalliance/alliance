import type { AnyField } from "@alliance/common/forms/form-schema";
import {
  isDraftValidatorId,
  type Condition,
  type FormulaNode,
  type VisibleIfFormula,
} from "@alliance/common/forms/visible-if-formula";
import {
  formulaConditionNames,
  serializeVisibilityFormula,
} from "@alliance/shared/forms/visibilityFormula";
import { useMemo, useState } from "react";
import { ItemList } from "../kit/ItemList";
import Button, { ButtonVariant } from "../../../../ui/Button";
import { Select } from "../../../../ui/Select";
import { Field } from "../../../../ui/templates/Form";
import { useCustomValidatorDrafts } from "../questions/customValidatorDrafts";
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
import { useExpressionBuffer } from "./expressionBuffers";
import { ExpressionEditor } from "./ExpressionEditor";
import { isConditionalController, type RuleCondition } from "./fieldConditions";

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
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span className="text-caption text-fg-muted">Replace with</span>
      <Button
        variant={ButtonVariant.Default}
        size="small"
        onClick={() => onChoose(Combinator.All)}
      >
        All rules
      </Button>
      <Button
        variant={ButtonVariant.Default}
        size="small"
        onClick={() => onChoose(Combinator.Any)}
      >
        Any rule
      </Button>
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
  const [typed, setBuffer] = useExpressionBuffer(field);
  const [expressionRequested, setExpressionRequested] = useState(
    () => (visibility !== undefined && simple === null) || typed !== null,
  );
  const [focusExpression, setFocusExpression] = useState(false);
  const advanced = expressionRequested || (!!visibility && simple === null);
  const conditions = visibility?.conditions ?? {};

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
      const formula = pending?.ok
        ? pending.value
        : (visibility?.formula ?? name);
      if (typed !== null) setBuffer({ text: typed, formula });
      write(nextConditions, formula);
    } else {
      writeSimple(nextConditions, {
        combinator,
        rules: [...rules, { name, negated: false }],
      });
    }
  };

  const removeRule = (name: string) => {
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
    setFocusExpression(false);
    setBuffer(null);
    writeSimple(conditions, {
      combinator: chosen,
      rules: sortedConditionNames(conditions).map((name) => ({
        name,
        negated: false,
      })),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {!advanced ? (
        <Button
          variant={ButtonVariant.Ghost}
          size="small"
          onClick={() => {
            setExpressionRequested(true);
            setFocusExpression(true);
          }}
        >
          Edit as expression
        </Button>
      ) : canLeaveExpression ? (
        <Button
          variant={ButtonVariant.Ghost}
          size="small"
          onClick={() => {
            setExpressionRequested(false);
            setFocusExpression(false);
            setBuffer(null);
          }}
        >
          Use all/any rules
        </Button>
      ) : (
        <ReplaceExpression onChoose={replaceExpression} />
      )}
      {advanced ? (
        <ExpressionEditor
          focusOnMount={focusExpression}
          text={expressionText}
          error={
            blankAndUnconditional
              ? null
              : checkedText.ok
                ? null
                : checkedText.error
          }
          onChange={(text) => {
            const checked = checkExpression(text, conditions);
            setBuffer(
              visibility === undefined && text.trim() === ""
                ? null
                : {
                    text,
                    formula: checked.ok
                      ? checked.value
                      : (visibility?.formula ?? null),
                  },
            );
            if (
              checked.ok &&
              !(visibility && sameFormula(checked.value, visibility.formula))
            ) {
              write(conditions, checked.value);
            }
          }}
        />
      ) : rules.length === 0 ? (
        <p className="text-fg-muted">
          Always shown. Add a rule to show this only when it matches.
        </p>
      ) : (
        rules.length > 1 && (
          <Field label="Show when">
            {(control) => (
              <Select
                {...control}
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
              </Select>
            )}
          </Field>
        )
      )}
      {rules.length > 0 && (
        <ItemList label="Rules">
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
                allowNegation={!advanced}
                sources={sources}
                onChange={(next) => changeRule({ name, negated, next })}
                onRemove={() => removeRule(name)}
              />
            );
          })}
        </ItemList>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <AddRuleMenu sources={sources} onAdd={addRule} />
      </div>
    </div>
  );
}
