import type { Condition } from "@alliance/common/forms/visible-if-formula";
import { invertCondition } from "./conditionFormula";
import {
  CompletedActionsRule,
  DeviceRule,
  FirstContractSignedRule,
  OutputBlockRule,
  UserHasCityRule,
  UserPropertyRule,
  type OutputBlockOption,
} from "./ContextRules";
import type { ControllerField, RuleCondition } from "./fieldConditions";
import { FieldRule } from "./FieldRule";
import { ValidatorRule } from "./ValidatorRule";

export type RuleSources = {
  earlierControllers: ControllerField[];
  laterControllers: ControllerField[];
  outputBlocks: OutputBlockOption[] | undefined;
  selfId: string | undefined;
};

function ruleTitle(condition: Condition): string {
  switch (condition.kind) {
    case "equals":
    case "includesOption":
    case "anySelected":
    case "selectedCount":
    case "hasValue":
      return condition.sourceFormId === undefined
        ? "Answer on this form"
        : "Answer on another form";
    case "validator":
      return "Validator";
    case "deviceType":
      return "Device";
    case "outputBlockVisible":
      return "Output block";
    case "userHasCity":
      return "User's city";
    case "userPropertyHasValue":
      return "User property";
    case "firstContractSigned":
      return "First contract signed";
    case "completedActionCount":
      return "Completed actions";
    default:
      throw new Error(
        `unknown condition: ${JSON.stringify(condition satisfies never)}`,
      );
  }
}

function RuleBody({
  condition,
  negated,
  allowNegation,
  sources,
  onChange,
  onRemove,
}: {
  condition: Condition;
  negated: boolean;
  allowNegation: boolean;
  sources: RuleSources;
  onChange: (rule: RuleCondition) => void;
  onRemove: () => void;
}) {
  const shown = (negated && invertCondition(condition)) || condition;
  const set = (next: Condition) =>
    onChange({ condition: next, negated: false });
  switch (shown.kind) {
    case "equals":
    case "includesOption":
    case "anySelected":
    case "selectedCount":
    case "hasValue":
      return (
        <FieldRule
          condition={shown}
          negated={shown === condition && negated}
          allowNegation={allowNegation}
          earlierControllers={sources.earlierControllers}
          laterControllers={sources.laterControllers}
          onChange={onChange}
        />
      );
    case "validator":
      return (
        <ValidatorRule condition={shown} onChange={set} onRemove={onRemove} />
      );
    case "deviceType":
      return <DeviceRule condition={shown} onChange={set} />;
    case "outputBlockVisible":
      return (
        <OutputBlockRule
          condition={shown}
          onChange={set}
          outputBlocks={sources.outputBlocks ?? []}
          selfId={sources.selfId}
        />
      );
    case "userHasCity":
      return <UserHasCityRule condition={shown} onChange={set} />;
    case "userPropertyHasValue":
      return <UserPropertyRule condition={shown} onChange={set} />;
    case "firstContractSigned":
      return <FirstContractSignedRule condition={shown} onChange={set} />;
    case "completedActionCount":
      return <CompletedActionsRule condition={shown} onChange={set} />;
    default:
      throw new Error(
        `unknown condition: ${JSON.stringify(shown satisfies never)}`,
      );
  }
}

export function ConditionRule({
  name,
  condition,
  negated,
  showName,
  unreferenced,
  allowNegation,
  sources,
  onChange,
  onRemove,
}: {
  name: string;
  condition: Condition;
  negated: boolean;
  /** Advanced mode, where the expression refers to rules by name. */
  showName: boolean;
  unreferenced: boolean;
  allowNegation: boolean;
  sources: RuleSources;
  onChange: (rule: RuleCondition) => void;
  onRemove: () => void;
}) {
  return (
    <li
      aria-label={`Rule ${name}`}
      className="space-y-2 rounded border border-gray-200 bg-white p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-700">
          {ruleTitle(condition)}
          {showName && (
            <code className="ml-2 rounded bg-gray-100 px-1 font-normal text-gray-600">
              {name}
            </code>
          )}
        </span>
        <button
          type="button"
          className="text-[11px] text-gray-500 hover:text-red-500"
          onClick={onRemove}
        >
          Remove rule
        </button>
      </div>
      {unreferenced && (
        <p className="text-[11px] text-amber-600">
          The expression doesn&apos;t use {name} yet.
        </p>
      )}
      <RuleBody
        condition={condition}
        negated={negated}
        allowNegation={allowNegation}
        sources={sources}
        onChange={onChange}
        onRemove={onRemove}
      />
    </li>
  );
}
