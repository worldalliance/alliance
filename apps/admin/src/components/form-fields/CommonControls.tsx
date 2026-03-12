import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  CustomValidatorType,
  CustomValidatorTypeDto,
  tasksCustomValidators,
  tasksFindOneCustomValidator,
  tasksTestCustomExpression,
  userGetTags,
  userList,
  type TagDto,
  type UserDto,
  CustomExpressionUserDto,
} from "@alliance/shared/client";
import type { DisplayBlock } from "@alliance/shared/forms/display-blocks";
import {
  DEVICE_VISIBILITY_TARGETS,
  type AnyField,
  type CheckboxField,
  type Condition,
  type ContractField,
  type DeviceVisibilityTarget,
  type EmailField,
  type MultiSelectField,
  type PhoneField,
  type RangeField,
  type RadioField,
  type SelectField,
  type TextField,
  type TextareaField,
  type VisibleIfFormula,
} from "@alliance/shared/forms/formschema";
import {
  conditionNameForIndex,
  defaultFormulaForConditionCount,
  parseVisibilityFormula,
  serializeVisibilityFormula,
} from "@alliance/shared/forms/visibilityFormula";
import {
  isDraftValidatorId,
  useCustomValidatorDrafts,
} from "./customValidatorDrafts";
import Card from "@alliance/sharedweb/ui/Card";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";

function getFormulaConditionRefs(node: VisibleIfFormula["formula"]): string[] {
  if (typeof node === "string") return [node];
  if (node.op === "NOT") {
    return getFormulaConditionRefs(
      typeof node.operand === "string" ? node.operand : node.operand
    );
  }
  const left =
    typeof node.left === "string"
      ? [node.left]
      : getFormulaConditionRefs(node.left);
  const right =
    typeof node.right === "string"
      ? [node.right]
      : getFormulaConditionRefs(node.right);
  return [...left, ...right];
}

const DEVICE_LABELS: Record<DeviceVisibilityTarget, string> = {
  mobile: "Mobile",
  tablet: "Tablet",
  desktop: "Desktop",
};
const DEFAULT_RANGE_OPTIONS = 10;
const MIN_RANGE_OPTIONS = 2;
const MAX_RANGE_OPTIONS = 50;

const getRangeValues = (field: RangeField): number[] => {
  const desired = field.optionCount ?? DEFAULT_RANGE_OPTIONS;
  const normalized = Number.isFinite(desired)
    ? Math.floor(desired)
    : DEFAULT_RANGE_OPTIONS;
  const count = Math.min(
    MAX_RANGE_OPTIONS,
    Math.max(MIN_RANGE_OPTIONS, normalized)
  );
  return Array.from({ length: count }, (_, index) => index + 1);
};

type RequiredToggleProps = {
  checked: boolean | undefined;
  onChange: (checked: boolean) => void;
  className?: string;
  label?: string;
};

export function RequiredToggle({
  checked,
  onChange,
  className = "",
  label = "Required",
}: RequiredToggleProps) {
  return (
    <label className={cn("flex items-center text-xs text-gray-700", className)}>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mr-2"
      />
      {label}
    </label>
  );
}

type RequiredAsteriskProps = {
  required?: boolean;
  className?: string;
};

export function RequiredAsterisk({
  required,
  className = "text-red-500 ml-1",
}: RequiredAsteriskProps) {
  if (!required) return null;
  return <span className={className}>*</span>;
}

type OutputFieldToggleProps = {
  checked?: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
};

export function OutputFieldToggle({
  checked,
  onChange,
  className = "",
}: OutputFieldToggleProps) {
  return (
    <label className={cn("flex items-center text-xs text-gray-700", className)}>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mr-2"
      />
      Set as output field
    </label>
  );
}

type OutputPrivateByDefaultToggleProps = {
  checked?: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
};

export function OutputPrivateByDefaultToggle({
  checked,
  onChange,
  className = "",
}: OutputPrivateByDefaultToggleProps) {
  return (
    <label className={cn("flex items-center text-xs text-gray-700", className)}>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mr-2"
      />
      Private by default
    </label>
  );
}

// ---------------- Conditional Visibility ----------------
type ConditionalVisibilityProps = {
  field: (AnyField | DisplayBlock) & {
    visibleIf?: Condition[] | Condition;
    visibleIfFormula?: VisibleIfFormula;
  };
  previousFields: AnyField[];
  onChange: (updates: {
    visibleIf?: Condition[];
    visibleIfFormula?: VisibleIfFormula;
  }) => void;
};

type TextContentControllerField =
  | TextField
  | TextareaField
  | EmailField
  | PhoneField;

type ControllerField =
  | CheckboxField
  | ContractField
  | RadioField
  | SelectField
  | MultiSelectField
  | RangeField
  | TextContentControllerField;

function isTextContentController(f: AnyField): f is TextContentControllerField {
  return (
    f.kind === "text" ||
    f.kind === "textarea" ||
    f.kind === "email" ||
    f.kind === "phone"
  );
}

function isConditionalController(f: AnyField): f is ControllerField {
  return (
    f.kind === "checkbox" ||
    f.kind === "contract" ||
    f.kind === "radio" ||
    f.kind === "select" ||
    f.kind === "multiselect" ||
    f.kind === "range" ||
    isTextContentController(f)
  );
}

type FieldCondition = Extract<Condition, { when: string }>;
type ValidatorCondition = Extract<Condition, { validatorId: number }>;
type DeviceCondition = Extract<
  Condition,
  { deviceType: DeviceVisibilityTarget[] }
>;

function isFieldCondition(cond: Condition): cond is FieldCondition {
  return "when" in cond;
}

function isValidatorCondition(cond: Condition): cond is ValidatorCondition {
  return "validatorId" in cond;
}

function isDeviceCondition(cond: Condition): cond is DeviceCondition {
  return "deviceType" in cond;
}

function isHasValueCondition(
  condition: Condition
): condition is Extract<Condition, { hasValue: boolean }> {
  return "hasValue" in condition;
}

function isIncludesOptionCondition(
  condition: Condition
): condition is Extract<Condition, { includesOption: string }> {
  return "includesOption" in condition;
}

function isAnySelectedCondition(
  condition: Condition
): condition is Extract<Condition, { anySelected: boolean }> {
  return "anySelected" in condition;
}

function isEqualsCondition(
  condition: Condition
): condition is Extract<
  Condition,
  { equals: string | number | boolean | null }
> {
  return "equals" in condition;
}

function normalizeConditions(input?: Condition[] | Condition): Condition[] {
  if (!input) return [];
  return Array.isArray(input) ? input : [input];
}

export function ConditionalVisibility({
  field,
  previousFields,
  onChange,
}: ConditionalVisibilityProps) {
  const ANY_SELECTED_VALUE = "__ANY_SELECTED__";
  const controllers = (previousFields || []).filter((f): f is ControllerField =>
    isConditionalController(f)
  );
  const {
    validators,
    loading: validatorsLoading,
    error: validatorsError,
  } = useCustomValidators();
  const { createDraftId, drafts, removeDraft, setDraft } =
    useCustomValidatorDrafts();
  const usableValidators = useMemo(
    () => validators.filter((validator) => validator.usableForVisibility),
    [validators]
  );

  const conditions = useMemo(() => {
    const formula = field.visibleIfFormula;
    if (formula?.conditions && Object.keys(formula.conditions).length > 0) {
      const names = Object.keys(formula.conditions).sort((a, b) => {
        const na = parseInt(a.replace("condition", ""), 10) || 0;
        const nb = parseInt(b.replace("condition", ""), 10) || 0;
        return na - nb;
      });
      return names.map((name) => formula.conditions[name]);
    }
    return normalizeConditions(field.visibleIf);
  }, [field.visibleIf, field.visibleIfFormula]);

  const formulaText = useMemo(() => {
    const formula = field.visibleIfFormula;
    if (formula?.formula) {
      return serializeVisibilityFormula(formula.formula);
    }
    return defaultFormulaForConditionCount(conditions.length);
  }, [field.visibleIfFormula, conditions.length]);

  const allowedConditionNames = useMemo(
    () => new Set(conditions.map((_, i) => conditionNameForIndex(i))),
    [conditions]
  );

  const buildConditionForField = useCallback(
    (controller: ControllerField | undefined): FieldCondition | null => {
      if (!controller) {
        return null;
      }
      if (isTextContentController(controller)) {
        return {
          when: controller.id,
          hasValue: true,
        };
      }
      if (controller.kind === "checkbox") {
        return {
          when: controller.id,
          equals: true,
        };
      }
      if (controller.kind === "contract") {
        return {
          when: controller.id,
          equals: true,
        };
      }
      if (controller.kind === "multiselect") {
        return {
          when: controller.id,
          includesOption: controller.options?.[0]?.value ?? "",
        };
      }
      if (controller.kind === "range") {
        const values = getRangeValues(controller);
        return {
          when: controller.id,
          equals: values[0] ?? 1,
        };
      }
      return {
        when: controller.id,
        equals: controller.options?.[0]?.value ?? "",
      };
    },
    []
  );

  const [conditionError, setConditionError] = useState<string | null>(null);
  const [formulaError, setFormulaError] = useState<string | null>(null);
  const [formulaInput, setFormulaInput] = useState(formulaText);
  useEffect(() => {
    setFormulaInput(formulaText);
  }, [formulaText]);

  const canUseFieldControllers = controllers.length > 0;
  const canUseValidators = usableValidators.length > 0;
  const noControllerOrValidatorOptions =
    !canUseFieldControllers && !canUseValidators;

  const updateConditions = useCallback(
    (next: Condition[], preserveFormula?: boolean) => {
      setConditionError(null);
      setFormulaError(null);
      const names = next.map((_, i) => conditionNameForIndex(i));
      const conditionsMap: Record<string, Condition> = {};
      names.forEach((name, i) => {
        conditionsMap[name] = next[i];
      });
      const allowed = new Set(names);
      let formulaNode: VisibleIfFormula["formula"];
      if (
        preserveFormula &&
        field.visibleIfFormula?.formula &&
        Object.keys(field.visibleIfFormula.conditions ?? {}).length ===
          next.length
      ) {
        const current = field.visibleIfFormula.formula;
        const refs = getFormulaConditionRefs(current);
        if (refs.every((r) => allowed.has(r))) {
          formulaNode = current;
        } else {
          formulaNode = parseOrDefaultFormula(
            defaultFormulaForConditionCount(next.length),
            allowed
          );
        }
      } else {
        formulaNode = parseOrDefaultFormula(
          defaultFormulaForConditionCount(next.length),
          allowed
        );
      }
      if (next.length === 0) {
        onChange({ visibleIfFormula: undefined, visibleIf: undefined });
        return;
      }
      onChange({
        visibleIfFormula: { conditions: conditionsMap, formula: formulaNode },
      });
    },
    [onChange, field.visibleIfFormula]
  );

  function parseOrDefaultFormula(
    defaultStr: string,
    allowed: Set<string>
  ): VisibleIfFormula["formula"] {
    const parsed = parseVisibilityFormula(defaultStr, allowed);
    if ("error" in parsed) {
      const fallback = parseVisibilityFormula(
        "condition1",
        new Set(["condition1"])
      );
      return "node" in fallback ? fallback.node : "condition1";
    }
    return parsed.node;
  }

  const handleFormulaChange = useCallback(
    (text: string) => {
      setFormulaError(null);
      if (conditions.length === 0) return;
      const allowed = allowedConditionNames;
      const parsed = parseVisibilityFormula(text.trim(), allowed);
      if ("error" in parsed) {
        setFormulaError(parsed.error);
        return;
      }
      const conditionsMap: Record<string, Condition> = {};
      conditions.forEach((c, i) => {
        conditionsMap[conditionNameForIndex(i)] = c;
      });
      onChange({
        visibleIfFormula: { conditions: conditionsMap, formula: parsed.node },
      });
    },
    [conditions, allowedConditionNames, onChange]
  );

  const removeCondition = useCallback(
    (index: number) => {
      const existing = conditions[index];
      if (
        existing &&
        isValidatorCondition(existing) &&
        isDraftValidatorId(existing.validatorId)
      ) {
        removeDraft(existing.validatorId);
      }
      const next = conditions.filter((_, idx) => idx !== index);
      updateConditions(next);
    },
    [conditions, removeDraft, updateConditions]
  );

  const createDefaultFieldCondition = useCallback((): FieldCondition | null => {
    return buildConditionForField(controllers[0]);
  }, [buildConditionForField, controllers]);

  const addFieldCondition = useCallback((): boolean => {
    const condition = createDefaultFieldCondition();
    if (!condition) {
      setConditionError(
        "Add a checkbox, contract, select, radio, multiselect, range, or text field earlier on this page first."
      );
      return false;
    }
    const next = [...conditions, condition];
    updateConditions(next);
    return true;
  }, [conditions, createDefaultFieldCondition, updateConditions]);

  const pickDefaultValidatorType = useCallback(():
    | CustomValidatorType
    | undefined => {
    const withoutId = usableValidators.find(
      (validator) => !validator.withIdField
    );
    return withoutId?.id ?? usableValidators[0]?.id;
  }, [usableValidators]);

  const [validatorConfigs, setValidatorConfigs] = useState<
    Record<
      number,
      { type: CustomValidatorType; idArgument?: string; expression?: string }
    >
  >({});

  const pendingValidatorFetch = useRef<Set<number>>(new Set());

  useEffect(() => {
    const missing = conditions
      .filter(isValidatorCondition)
      .map((condition) => condition.validatorId)
      .filter(
        (id) =>
          !isDraftValidatorId(id) &&
          validatorConfigs[id] === undefined &&
          !pendingValidatorFetch.current.has(id)
      );
    if (!missing.length) {
      return;
    }

    missing.forEach((id) => pendingValidatorFetch.current.add(id));
    Promise.all(
      missing.map(async (id) => {
        try {
          const response = await tasksFindOneCustomValidator({
            path: { id },
          });
          if (!response.data) {
            throw new Error("Missing validator data");
          }
          return [
            id,
            {
              type: response.data.type,
              idArgument: response.data.idArgument,
              expression: response.data.expression,
            },
          ];
        } catch (error) {
          console.error("Failed to load visibility validator", error);
          return [id, undefined] as const;
        }
      })
    )
      .then((entries) => {
        const resolved = entries.filter((entry) => entry[1] !== undefined);
        if (resolved.length === 0) return;
        setValidatorConfigs((prev) => {
          const next = { ...prev };
          for (const [id, config] of resolved) {
            next[id as unknown as number] = config as {
              type: CustomValidatorType;
              idArgument?: string;
              expression?: string;
            };
          }
          return next;
        });
      })
      .finally(() => {
        missing.forEach((id) => pendingValidatorFetch.current.delete(id));
      });
  }, [conditions, validatorConfigs]);

  const addValidatorCondition = useCallback(
    async (opts?: {
      type?: CustomValidatorType;
      idArgument?: string;
      resultEquals?: boolean;
      expression?: string;
    }): Promise<boolean> => {
      const desiredType = opts?.type ?? pickDefaultValidatorType();
      if (!desiredType) {
        setConditionError(
          "No custom validators are available for conditional visibility."
        );
        return false;
      }
      const draftId = createDraftId();
      setDraft(draftId, {
        type: desiredType,
        idArgument: opts?.idArgument,
        expression: opts?.expression,
      });
      const nextCondition: ValidatorCondition = {
        validatorId: draftId,
        resultEquals: opts?.resultEquals ?? true,
      };
      const next = [...conditions, nextCondition];
      updateConditions(next);
      return true;
    },
    [
      conditions,
      createDraftId,
      pickDefaultValidatorType,
      setDraft,
      updateConditions,
    ]
  );

  const addDeviceCondition = useCallback(() => {
    const defaultCondition: DeviceCondition = {
      deviceType: [...DEVICE_VISIBILITY_TARGETS],
    };
    const next = [...conditions, defaultCondition];
    updateConditions(next);
  }, [conditions, updateConditions]);

  const handleDeviceConditionChange = useCallback(
    (index: number, target: DeviceVisibilityTarget, enabled: boolean) => {
      const next = [...conditions];
      const condition = next[index];
      if (!isDeviceCondition(condition)) {
        return;
      }
      const currentSelection = new Set(condition.deviceType ?? []);
      if (enabled) {
        currentSelection.add(target);
      } else {
        currentSelection.delete(target);
      }
      next[index] = {
        deviceType: DEVICE_VISIBILITY_TARGETS.filter((type) =>
          currentSelection.has(type)
        ),
      };
      updateConditions(next, true);
    },
    [conditions, updateConditions]
  );

  const handleControllerChange = useCallback(
    (index: number, id: string) => {
      const nextField = controllers.find((f) => f.id === id);
      if (!nextField) {
        return;
      }
      const nextCondition = buildConditionForField(nextField);
      if (!nextCondition) {
        return;
      }
      const next = [...conditions];
      next[index] = nextCondition;
      updateConditions(next, true);
    },
    [buildConditionForField, conditions, controllers, updateConditions]
  );

  const handleConditionValueChange = useCallback(
    (index: number, value: string) => {
      const next = [...conditions];
      const current = next[index];
      if (!isFieldCondition(current)) {
        return;
      }
      const controller = controllers.find((f) => f.id === current.when);
      if (!controller) {
        return;
      }
      if (isTextContentController(controller)) {
        next[index] = {
          when: controller.id,
          hasValue: value === "true",
        };
      } else if (controller.kind === "checkbox") {
        next[index] = {
          when: controller.id,
          equals: value === "true",
        };
      } else if (controller.kind === "contract") {
        next[index] = {
          when: controller.id,
          equals: value === "true",
        };
      } else if (controller.kind === "multiselect") {
        next[index] =
          value === ANY_SELECTED_VALUE
            ? {
                when: controller.id,
                anySelected: true,
              }
            : {
                when: controller.id,
                includesOption: value,
              };
      } else if (controller.kind === "range") {
        next[index] = {
          when: controller.id,
          equals: Number(value),
        };
      } else {
        next[index] = {
          when: controller.id,
          equals: value,
        };
      }
      updateConditions(next, true);
    },
    [conditions, controllers, updateConditions]
  );

  const handleValidatorSelection = useCallback(
    async (
      index: number,
      validatorType: CustomValidatorType | undefined,
      idArgument?: string,
      expression?: string
    ) => {
      if (!validatorType) {
        removeCondition(index);
        return;
      }
      console.log(
        "handleValidatorSelection",
        validatorType,
        idArgument,
        expression
      );
      const next = [...conditions];
      const existing = next[index];
      const resultEquals = isValidatorCondition(existing)
        ? existing.resultEquals ?? true
        : true;
      const existingValidatorId = isValidatorCondition(existing)
        ? existing.validatorId
        : undefined;
      const draftId = isDraftValidatorId(existingValidatorId)
        ? existingValidatorId
        : createDraftId();
      setDraft(draftId, { type: validatorType, idArgument, expression });
      next[index] = {
        validatorId: draftId,
        resultEquals,
      };
      updateConditions(next, true);
    },
    [conditions, createDraftId, removeCondition, setDraft, updateConditions]
  );

  const handleValidatorExpectationChange = useCallback(
    (index: number, value: string) => {
      const next = [...conditions];
      const condition = next[index];
      if (!isValidatorCondition(condition)) {
        return;
      }
      next[index] = {
        ...condition,
        resultEquals: value === "true",
      };
      updateConditions(next, true);
    },
    [conditions, updateConditions]
  );

  const renderFieldCondition = (condition: FieldCondition, index: number) => {
    const controller = controllers.find((f) => f.id === condition.when);
    const hasContentValue = isHasValueCondition(condition)
      ? String(condition.hasValue ?? true)
      : "true";
    const multiSelectValue =
      controller?.kind === "multiselect"
        ? isAnySelectedCondition(condition)
          ? ANY_SELECTED_VALUE
          : isIncludesOptionCondition(condition)
          ? condition.includesOption ?? ""
          : isEqualsCondition(condition) && typeof condition.equals === "string"
          ? condition.equals
          : ""
        : "";
    const rangeValues =
      controller?.kind === "range" ? getRangeValues(controller) : [];
    return (
      <div className="space-y-2">
        <div>
          <label className="block text-xs text-gray-700 mb-1">
            Show when field
          </label>
          <select
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={controller ? controller.id : controllers[0]?.id ?? ""}
            onChange={(event) =>
              handleControllerChange(index, event.target.value)
            }
          >
            {controllers.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {controller ? (
          <div>
            <label className="block text-xs text-gray-700 mb-1">
              {isTextContentController(controller)
                ? "has content"
                : controller.kind === "multiselect"
                ? "includes option"
                : "equals"}
            </label>
            {isTextContentController(controller) ? (
              <select
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={hasContentValue}
                onChange={(event) =>
                  handleConditionValueChange(index, event.target.value)
                }
              >
                <option value="true">Has any text</option>
                <option value="false">Is empty</option>
              </select>
            ) : controller.kind === "checkbox" ? (
              <select
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={String(
                  isEqualsCondition(condition) &&
                    typeof condition.equals === "boolean"
                    ? condition.equals
                    : false
                )}
                onChange={(event) =>
                  handleConditionValueChange(index, event.target.value)
                }
              >
                <option value="true">Checked</option>
                <option value="false">Unchecked</option>
              </select>
            ) : controller.kind === "contract" ? (
              <select
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={String(
                  isEqualsCondition(condition) &&
                    typeof condition.equals === "boolean"
                    ? condition.equals
                    : true
                )}
                onChange={(event) =>
                  handleConditionValueChange(index, event.target.value)
                }
              >
                <option value="true">
                  {controller.yesLabel?.trim() || "Yes"}
                </option>
                <option value="false">
                  {controller.noLabel?.trim() || "No"}
                </option>
              </select>
            ) : controller.kind === "multiselect" ? (
              <select
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={multiSelectValue}
                onChange={(event) =>
                  handleConditionValueChange(index, event.target.value)
                }
              >
                <option value={ANY_SELECTED_VALUE}>Any option selected</option>
                {controller.options?.map((opt, idx) => (
                  <option key={idx} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : controller.kind === "range" ? (
              <select
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={String(
                  isEqualsCondition(condition) ? condition.equals ?? "" : ""
                )}
                onChange={(event) =>
                  handleConditionValueChange(index, event.target.value)
                }
              >
                {rangeValues.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            ) : (
              <select
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={String(
                  isEqualsCondition(condition) ? condition.equals ?? "" : ""
                )}
                onChange={(event) =>
                  handleConditionValueChange(index, event.target.value)
                }
              >
                {controller.options?.map((opt, idx) => (
                  <option key={idx} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-gray-400">
            Select a field to compare before configuring a value.
          </p>
        )}
      </div>
    );
  };

  const renderValidatorCondition = (
    condition: ValidatorCondition,
    index: number
  ) => {
    const config = isDraftValidatorId(condition.validatorId)
      ? drafts[condition.validatorId]
      : validatorConfigs[condition.validatorId];
    return (
      <div className="space-y-2">
        <CustomValidatorSelect
          type={config?.type}
          idArgument={config?.idArgument}
          expression={config?.expression}
          onChange={(validatorType, idArgument, expression) =>
            void handleValidatorSelection(
              index,
              validatorType,
              idArgument,
              expression
            )
          }
          filter={(validator) => validator.usableForVisibility}
          label="Visibility validator"
        />
        {!config && !validatorsLoading && (
          <p className="text-[11px] text-gray-400">
            Loading validator details…
          </p>
        )}
        <div>
          <label className="block text-xs text-gray-700 mb-1">
            Show when validator result is
          </label>
          <select
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={String(condition.resultEquals ?? true)}
            onChange={(event) =>
              handleValidatorExpectationChange(index, event.target.value)
            }
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        </div>
      </div>
    );
  };

  const renderDeviceCondition = (condition: DeviceCondition, index: number) => {
    const selected = new Set(condition.deviceType ?? []);
    return (
      <div className="space-y-2">
        <div>
          <label className="block text-xs text-gray-700 mb-1">
            Show on device types
          </label>
          <div className="space-y-1">
            {DEVICE_VISIBILITY_TARGETS.map((target) => (
              <label
                key={target}
                className="flex items-center text-xs text-gray-700"
              >
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={selected.has(target)}
                  onChange={(event) =>
                    handleDeviceConditionChange(
                      index,
                      target,
                      event.target.checked
                    )
                  }
                />
                {DEVICE_LABELS[target]}
              </label>
            ))}
          </div>
        </div>
        {selected.size === 0 && (
          <p className="text-[11px] text-red-500">
            Select at least one device type to make this rule effective.
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="border-gray-200 pt-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-700">
          Conditional visibility
        </label>
      </div>

      {noControllerOrValidatorOptions && (
        <p className="mt-1 text-[11px] text-gray-400">
          No earlier checkbox/contract/select/radio/multiselect/range/text
          fields or visibility validators are available. You can still add
          device type rules below.
        </p>
      )}

      {conditionError && (
        <p className="mt-1 text-[11px] text-red-500">{conditionError}</p>
      )}

      {conditions.length > 0 && (
        <div className="mt-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Visibility formula
          </label>
          <p className="text-[11px] text-gray-500 mb-1">
            Combine conditions with AND, OR, NOT. E.g. condition1 AND
            (condition2 OR NOT condition3)
          </p>
          <input
            type="text"
            className={cn(
              "w-full px-2 py-1.5 text-xs border rounded focus:outline-none focus:ring-1",
              formulaError
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-300 focus:ring-blue-500"
            )}
            value={formulaInput}
            onChange={(e) => {
              setFormulaInput(e.target.value);
              setFormulaError(null);
            }}
            onBlur={() => handleFormulaChange(formulaInput)}
            placeholder="e.g. condition1 AND condition2"
          />
          {formulaError && (
            <p className="mt-1 text-[11px] text-red-500">{formulaError}</p>
          )}
        </div>
      )}

      <div className="mt-2 space-y-3">
        {conditions.map((condition, index) => (
          <div
            key={index}
            className="rounded border border-gray-200 bg-white p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-700">
                Condition {index + 1}
                <span className="text-gray-400 font-normal ml-1">
                  ({conditionNameForIndex(index)})
                </span>
              </span>
              <button
                type="button"
                className="text-[11px] text-gray-500 hover:text-red-500"
                onClick={() => removeCondition(index)}
              >
                Remove
              </button>
            </div>
            {isFieldCondition(condition) ? (
              renderFieldCondition(condition, index)
            ) : isValidatorCondition(condition) ? (
              renderValidatorCondition(condition, index)
            ) : isDeviceCondition(condition) ? (
              renderDeviceCondition(condition, index)
            ) : (
              <p className="text-[11px] text-red-500">
                Unsupported condition type. Remove and re-create this rule.
              </p>
            )}
          </div>
        ))}

        {conditions.length === 0 && (
          <p className="text-[11px] text-gray-500">
            No conditions configured yet. Add at least one rule below.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-40"
            onClick={() => {
              if (!addFieldCondition()) {
                return;
              }
            }}
            disabled={!canUseFieldControllers}
          >
            + Field condition
          </button>
          <button
            type="button"
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-40"
            onClick={() => void addValidatorCondition()}
            disabled={!canUseValidators}
          >
            + Validator condition
          </button>
          <button
            type="button"
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
            onClick={addDeviceCondition}
          >
            + Device condition
          </button>
        </div>
        {!canUseFieldControllers && (
          <p className="text-[11px] text-gray-400">
            Add a checkbox, contract, select, radio, multiselect, range, or text
            field earlier on this page to use answer-based visibility.
            Device-type rules are always available.
          </p>
        )}
        {!canUseValidators && (
          <p className="text-[11px] text-gray-400">
            No custom validators are currently available for visibility.
          </p>
        )}
        {validatorsLoading && (
          <p className="text-[11px] text-gray-500">
            Loading visibility validators…
          </p>
        )}
        {validatorsError && !validatorsLoading && (
          <p className="text-[11px] text-red-500">{validatorsError}</p>
        )}
      </div>
    </div>
  );
}
// ---------------- Custom Validators ----------------

let cachedValidators: CustomValidatorTypeDto[] | null = null;
let cachedValidatorsError: string | null = null;
let pendingValidatorsRequest: Promise<CustomValidatorTypeDto[]> | null = null;

async function fetchCustomValidators(): Promise<CustomValidatorTypeDto[]> {
  const response = await tasksCustomValidators();
  if (response.data) {
    return response.data;
  }

  if (response.error) {
    throw response.error;
  }

  throw new Error("Unknown error loading custom validators");
}

function useCustomValidators(): {
  validators: CustomValidatorTypeDto[];
  loading: boolean;
  error: string | null;
} {
  const [validators, setValidators] = useState<CustomValidatorTypeDto[]>(
    () => cachedValidators ?? []
  );
  const [loading, setLoading] = useState<boolean>(
    () => !cachedValidators && !cachedValidatorsError
  );
  const [error, setError] = useState<string | null>(
    () => cachedValidatorsError
  );

  useEffect(() => {
    if (cachedValidators) {
      setLoading(false);
      return;
    }

    let isCancelled = false;
    if (!pendingValidatorsRequest) {
      pendingValidatorsRequest = fetchCustomValidators();
    }

    setLoading(true);

    pendingValidatorsRequest
      .then((data) => {
        if (isCancelled) return;
        cachedValidators = data;
        cachedValidatorsError = null;
        setValidators(data);
        setError(null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (isCancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load validators";
        cachedValidatorsError = message;
        setError(message);
        setLoading(false);
      })
      .finally(() => {
        pendingValidatorsRequest = null;
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  return {
    validators,
    loading,
    error,
  };
}

let cachedUsers: UserDto[] | null = null;
let cachedUsersError: string | null = null;
let pendingUsersRequest: Promise<UserDto[]> | null = null;

async function fetchUsers(): Promise<UserDto[]> {
  const response = await userList();
  if (response.data) {
    return response.data;
  }

  if (response.error) {
    throw response.error;
  }

  throw new Error("Unknown error loading users");
}

function useUsers(enabled: boolean): {
  users: UserDto[];
  loading: boolean;
  error: string | null;
} {
  const [users, setUsers] = useState<UserDto[]>(() => cachedUsers ?? []);
  const [loading, setLoading] = useState<boolean>(
    () => enabled && !cachedUsers && !cachedUsersError
  );
  const [error, setError] = useState<string | null>(() => cachedUsersError);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (cachedUsers) {
      setUsers(cachedUsers);
      setLoading(false);
      return;
    }

    let isCancelled = false;
    if (!pendingUsersRequest) {
      pendingUsersRequest = fetchUsers();
    }

    setLoading(true);

    pendingUsersRequest
      .then((data) => {
        if (isCancelled) return;
        cachedUsers = data;
        cachedUsersError = null;
        setUsers(data);
        setError(null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (isCancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load users";
        cachedUsersError = message;
        setError(message);
        setLoading(false);
      })
      .finally(() => {
        pendingUsersRequest = null;
      });

    return () => {
      isCancelled = true;
    };
  }, [enabled]);

  return {
    users,
    loading,
    error,
  };
}

let cachedTags: TagDto[] | null = null;
let cachedTagsError: string | null = null;
let pendingTagsRequest: Promise<TagDto[]> | null = null;

async function fetchTags(): Promise<TagDto[]> {
  const response = await userGetTags();
  if (response.data) {
    return response.data;
  }
  if (response.error) {
    throw response.error;
  }
  throw new Error("Unknown error loading tags");
}

function useTags(enabled: boolean): {
  tags: TagDto[];
  loading: boolean;
  error: string | null;
} {
  const [tags, setTags] = useState<TagDto[]>(() => cachedTags ?? []);
  const [loading, setLoading] = useState<boolean>(
    () => enabled && !cachedTags && !cachedTagsError
  );
  const [error, setError] = useState<string | null>(() => cachedTagsError);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (cachedTags) {
      setTags(cachedTags);
      setLoading(false);
      return;
    }

    let isCancelled = false;
    if (!pendingTagsRequest) {
      pendingTagsRequest = fetchTags();
    }

    setLoading(true);

    pendingTagsRequest
      .then((data) => {
        if (isCancelled) return;
        cachedTags = data;
        cachedTagsError = null;
        setTags(data);
        setError(null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (isCancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load tags";
        cachedTagsError = message;
        setError(message);
        setLoading(false);
      })
      .finally(() => {
        pendingTagsRequest = null;
      });

    return () => {
      isCancelled = true;
    };
  }, [enabled]);

  return { tags, loading, error };
}

type CustomValidatorSelectProps = {
  type?: CustomValidatorType;
  idArgument?: string;
  expression?: string;
  onChange: (
    validatorType: CustomValidatorType | undefined,
    idArgument?: string,
    expression?: string
  ) => void;
  className?: string;
  label?: string;
  filter?: (validator: CustomValidatorTypeDto) => boolean;
};

export function CustomValidatorSelect({
  type,
  idArgument,
  expression,
  onChange,
  className = "",
  label = "Custom validator",
  filter,
}: CustomValidatorSelectProps) {
  const { validators, loading, error } = useCustomValidators();
  const isMemberTag = type === "MemberTag";
  const isCustomExpression = type === "CustomExpression";
  const { tags, loading: tagsLoading } = useTags(isMemberTag);
  const {
    users,
    loading: usersLoading,
    error: usersError,
  } = useUsers(isCustomExpression);
  const activeUsers = useMemo(
    () => users.filter((user) => user.hasActiveContract),
    [users]
  );
  const [expressionTest, setExpressionTest] = useState<{
    result?: boolean;
    error?: string;
    totals?: {
      pass: number;
      fail: number;
      total: number;
    };
    passUsers?: Array<CustomExpressionUserDto>;
    failUsers?: Array<CustomExpressionUserDto>;
    selectedUserLabel?: string;
  } | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const availableValidators = useMemo(() => {
    if (!filter) {
      return validators;
    }
    const filtered = validators.filter(filter);
    if (!type) {
      return filtered;
    }
    const selected = validators.find((validator) => validator.id === type);
    if (
      selected &&
      !filtered.some((validator) => validator.id === selected.id)
    ) {
      return [...filtered, selected];
    }
    return filtered;
  }, [validators, filter, type]);

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextValue = event.target.value;
    if (!nextValue) {
      onChange(undefined, idArgument, expression);
      return;
    }
    onChange(nextValue as CustomValidatorType, idArgument, expression);
  };

  const hasValidators = availableValidators.length > 0;
  const sortedTags = useMemo(
    () => [...tags].sort((a, b) => a.name.localeCompare(b.name)),
    [tags]
  );
  const hasExpression = Boolean(expression?.trim());
  const sortedUsers = useMemo(
    () => [...activeUsers].sort((a, b) => a.name.localeCompare(b.name)),
    [activeUsers]
  );
  const selectedUser = useMemo(
    () => activeUsers.find((user) => user.id === selectedUserId),
    [selectedUserId, activeUsers]
  );
  const selectedUserLabel = useMemo(() => {
    if (!selectedUser) {
      return undefined;
    }
    return selectedUser.anonymous
      ? `Anonymous (${selectedUser.id})`
      : `${selectedUser.name} (${selectedUser.id})`;
  }, [selectedUser]);
  const passUsers = useMemo(() => {
    if (!expressionTest?.passUsers) {
      return [];
    }
    return [...expressionTest.passUsers].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [expressionTest?.passUsers]);
  const failUsers = useMemo(() => {
    if (!expressionTest?.failUsers) {
      return [];
    }
    return [...expressionTest.failUsers].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [expressionTest?.failUsers]);

  useEffect(() => {
    setExpressionTest(null);
  }, [expression, type, selectedUserId]);

  useEffect(() => {
    if (!isCustomExpression) {
      return;
    }
    if (sortedUsers.length === 0) {
      setSelectedUserId(null);
      return;
    }
    if (
      !selectedUserId ||
      !sortedUsers.some((user) => user.id === selectedUserId)
    ) {
      setSelectedUserId(sortedUsers[0]?.id ?? null);
    }
  }, [isCustomExpression, selectedUserId, sortedUsers]);

  const runExpressionTest = useCallback(async () => {
    if (!isCustomExpression) {
      return;
    }
    if (!expression?.trim()) {
      setExpressionTest({ error: "Expression is empty." });
      return;
    }
    if (!selectedUserId) {
      setExpressionTest({ error: "Select a user to test against." });
      return;
    }
    if (usersLoading) {
      setExpressionTest({ error: "Users are still loading. Try again soon." });
      return;
    }
    if (usersError) {
      setExpressionTest({ error: usersError });
      return;
    }

    setIsTesting(true);
    try {
      const response = await tasksTestCustomExpression({
        body: {
          expression,
          userId: selectedUserId,
        },
      });

      if (response.error) {
        throw response.error;
      }

      if (!response.data) {
        throw new Error("Missing custom expression results.");
      }

      const selectedResult = response.data.selectedUserResult;
      if (typeof selectedResult !== "boolean") {
        throw new Error("Missing selected user result.");
      }

      setExpressionTest({
        result: selectedResult,
        selectedUserLabel,
        totals: {
          pass: response.data.passCount,
          fail: response.data.failCount,
          total: response.data.totalCount,
        },
        passUsers: response.data.passUsers ?? [],
        failUsers: response.data.failUsers ?? [],
      });
    } catch (err) {
      const message =
        (err as { message: string } | undefined)?.message ??
        "Expression failed to run.";
      setExpressionTest({ error: message });
    } finally {
      setIsTesting(false);
    }
  }, [
    expression,
    isCustomExpression,
    selectedUserId,
    selectedUserLabel,
    usersError,
    usersLoading,
  ]);
  const canTestExpression =
    hasExpression &&
    !isTesting &&
    Boolean(selectedUserId) &&
    !usersLoading &&
    !usersError;

  return (
    <div className={cn("space-y-1", className)}>
      <label className="block text-xs font-medium text-gray-700">{label}</label>
      <div className="flex items-center gap-2">
        <select
          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
          value={type ?? ""}
          onChange={handleChange}
          disabled={loading || (!hasValidators && !type)}
        >
          <option value="">None</option>
          {availableValidators.map((validator) => (
            <option key={validator.id} value={validator.id}>
              {validator.name}
            </option>
          ))}
        </select>
        {!!validators.find((validator) => validator.id === type)?.withIdField &&
          (isMemberTag ? (
            <select
              value={idArgument ?? ""}
              onChange={(e) =>
                onChange(
                  type,
                  e.target.value === "" ? undefined : e.target.value,
                  expression
                )
              }
              className="px-2 py-1 text-xs border border-gray-300 rounded bg-white w-32"
              disabled={tagsLoading}
            >
              <option value="">
                {tagsLoading ? "Loading..." : "Select a tag"}
              </option>
              {sortedTags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={idArgument ?? ""}
              onChange={(e) =>
                onChange(
                  type,
                  e.target.value === "" ? undefined : e.target.value,
                  expression
                )
              }
              className="px-2 py-1 text-xs border border-gray-300 rounded bg-white w-24"
            />
          ))}
      </div>
      {type === "CustomExpression" && (
        <div className="space-y-2">
          <textarea
            value={expression ?? ""}
            onChange={(e) => onChange(type, idArgument, e.target.value)}
            className="px-2 py-1 text-xs border border-gray-300 rounded bg-white w-full font-mono"
          />
          <Card style={CardStyle.Grey} className="p-2! gap-y-2">
            <div className="space-y-1">
              <label className="block text-[11px] text-gray-700">
                Test user (active contracts)
              </label>
              <select
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                value={selectedUserId ?? ""}
                onChange={(event) =>
                  setSelectedUserId(
                    event.target.value ? Number(event.target.value) : null
                  )
                }
                disabled={
                  usersLoading ||
                  Boolean(usersError) ||
                  activeUsers.length === 0
                }
              >
                <option value="">Select a user</option>
                {sortedUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.anonymous ? "Anonymous" : user.name} ({user.id})
                  </option>
                ))}
              </select>
              {usersLoading && (
                <p className="text-[11px] text-gray-500">Loading users…</p>
              )}
              {usersError && !usersLoading && (
                <p className="text-[11px] text-red-500">{usersError}</p>
              )}
              {!usersLoading && !usersError && activeUsers.length === 0 && (
                <p className="text-[11px] text-gray-400">
                  No active-contract users available to test.
                </p>
              )}
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={runExpressionTest}
                disabled={!canTestExpression}
                className="text-[11px] text-blue-600 hover:text-blue-700 disabled:text-gray-400"
              >
                {isTesting ? "Testing…" : "Test expression"}
              </button>
              <span className="text-[10px] text-gray-400">
                Runs against selected user and all users
              </span>
            </div>
            {expressionTest?.error && (
              <p className="text-[11px] text-red-500">{expressionTest.error}</p>
            )}
            {expressionTest &&
              expressionTest.result !== undefined &&
              !expressionTest.error && (
                <p
                  className={cn(
                    "text-[11px]",
                    expressionTest.result ? "text-green-600" : "text-red-600"
                  )}
                >
                  {expressionTest.selectedUserLabel
                    ? `${expressionTest.selectedUserLabel}: `
                    : "Selected user: "}
                  {String(expressionTest.result)}
                </p>
              )}
            {expressionTest?.totals && !expressionTest.error && (
              <p className="text-[11px] text-gray-600">
                Active-contract users: {expressionTest.totals.pass} pass,{" "}
                {expressionTest.totals.fail} fail (total{" "}
                {expressionTest.totals.total})
              </p>
            )}
            {expressionTest?.passUsers &&
              expressionTest?.failUsers &&
              !expressionTest.error && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <details className="rounded border border-gray-200 bg-white p-2">
                    <summary className="cursor-pointer text-[11px] text-gray-700">
                      Passing users ({passUsers.length})
                    </summary>
                    {passUsers.length === 0 ? (
                      <p className="mt-1 text-[11px] text-gray-400">
                        No users passed.
                      </p>
                    ) : (
                      <ul className="mt-1 max-h-40 overflow-auto text-[11px] text-gray-700">
                        {passUsers.map((user) => (
                          <li key={user.id}>
                            {user.anonymous ? "Anonymous" : user.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>
                  <details className="rounded border border-gray-200 bg-white p-2">
                    <summary className="cursor-pointer text-[11px] text-gray-700">
                      Failing users ({failUsers.length})
                    </summary>
                    {failUsers.length === 0 ? (
                      <p className="mt-1 text-[11px] text-gray-400">
                        No users failed.
                      </p>
                    ) : (
                      <ul className="mt-1 max-h-40 overflow-auto text-[11px] text-gray-700">
                        {failUsers.map((user) => (
                          <li key={user.id}>
                            {user.anonymous ? "Anonymous" : user.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>
                </div>
              )}
          </Card>
        </div>
      )}
      {loading && (
        <p className="text-[11px] text-gray-500">Loading validators…</p>
      )}
      {error && !loading && <p className="text-[11px] text-red-500">{error}</p>}
      {!loading && !hasValidators && !error && (
        <p className="text-[11px] text-gray-500">No custom validators found.</p>
      )}
    </div>
  );
}

export function AutoExtractUserDataToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center text-xs text-gray-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mr-1"
      />
      Automatically extract into user data
    </label>
  );
}
