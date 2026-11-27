import type { Condition } from "@alliance/common/forms/visible-if-formula";
import Badge, { BadgeTone } from "../../../../ui/Badge";
import Button, { ButtonVariant } from "../../../../ui/Button";
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
      return "Completed tasks";
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
  /** Expression mode, where the expression refers to rules by name. */
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
      className="flex flex-col gap-3 rounded-md border border-line p-3"
    >
      <div className="flex items-start gap-2">
        <div className="flex min-h-control-sm min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">{ruleTitle(condition)}</span>
          {showName && (
            <code className="font-mono text-caption text-fg-muted">{name}</code>
          )}
          {unreferenced && <Badge tone={BadgeTone.Warning}>Not used</Badge>}
        </div>
        <Button
          variant={ButtonVariant.Ghost}
          size="small"
          className="shrink-0 whitespace-nowrap"
          onClick={onRemove}
        >
          Remove rule
        </Button>
      </div>
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
