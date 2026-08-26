import {
  DEVICE_VISIBILITY_TARGETS,
  type DeviceVisibilityTarget,
} from "@alliance/common/forms/device";
import type { DisplayBlock } from "@alliance/common/forms/display-blocks";
import { fieldPickerLabel } from "@alliance/common/forms/element-descriptors";
import {
  type AnyField,
  type CheckboxField,
  type ContractField,
  type EmailField,
  type MultiSelectField,
  type NumberField,
  type Page,
  type PhoneField,
  type RadioField,
  type RangeField,
  type SelectField,
  type TextareaField,
  type TextField,
} from "@alliance/common/forms/form-schema";
import {
  type Condition,
  type VisibleIfFormula,
} from "@alliance/common/forms/visible-if-formula";
import {
  CustomExpressionUserDto,
  CustomValidatorType,
  CustomValidatorTypeDto,
  tasksCustomValidatorsAdmin,
  tasksFindOneCustomValidatorAdmin,
  tasksTestCustomExpressionAdmin,
  userListAdmin,
  type UserDto,
} from "@alliance/shared/client";
import {
  conditionNameForIndex,
  defaultFormulaForConditionCount,
  parseVisibilityFormula,
  serializeVisibilityFormula,
} from "@alliance/shared/forms/visibilityFormula";
import {
  FormFieldsStatus,
  useFormQuestionFieldsMap,
  useFormQuestionFieldsPeek,
} from "@alliance/shared/lib/useFormSchema";
import { useFormOptions } from "@alliance/shared/lib/useFormsAdmin";
import { useTagsAdmin } from "@alliance/shared/lib/useTagsAdmin";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import Card from "@alliance/sharedweb/ui/Card";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  formFieldsErrorReason,
  FormPickerError,
  FormPickerErrorReason,
} from "../FormPickerError";
import {
  isDraftValidatorId,
  useCustomValidatorDrafts,
} from "./customValidatorDrafts";

function getFormulaConditionRefs(node: VisibleIfFormula["formula"]): string[] {
  if (typeof node === "string") return [node];
  if (node.op === "NOT") {
    return getFormulaConditionRefs(
      typeof node.operand === "string" ? node.operand : node.operand,
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
    Math.max(MIN_RANGE_OPTIONS, normalized),
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

/** Option values that appear more than once in the list (schema rejects these on save). */
export function duplicateOptionValues(
  options: readonly { value: string }[],
): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const { value } of options) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return duplicates;
}

type DuplicateOptionsWarningProps = {
  duplicates: Set<string>;
};

export function DuplicateOptionsWarning({
  duplicates,
}: DuplicateOptionsWarningProps) {
  if (duplicates.size === 0) return null;
  return (
    <p className="mt-1 text-[11px] text-red-500">
      Duplicate option values ({Array.from(duplicates).join(", ")}): each option
      needs a unique value or the form won&apos;t save.
    </p>
  );
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
export type OutputBlockOption = { id: string; label: string };

type ConditionalVisibilityProps = {
  field: (AnyField | DisplayBlock | Page) & {
    visibleIfFormula?: VisibleIfFormula;
  };
  previousFields: AnyField[];
  onChange: (updates: { visibleIfFormula?: VisibleIfFormula }) => void;
  /**
   * When provided, enables an "output block visible" condition type referencing
   * any other block (field or display) in the current output view by id. Only
   * meaningful inside the output view builder.
   */
  outputBlocks?: OutputBlockOption[];
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
  | NumberField
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
    f.kind === "number" ||
    isTextContentController(f)
  );
}

function defaultNumberEqualsForVisibility(controller: NumberField): number {
  if (
    typeof controller.defaultValue === "number" &&
    Number.isFinite(controller.defaultValue)
  ) {
    return controller.defaultValue;
  }
  if (typeof controller.min === "number" && Number.isFinite(controller.min)) {
    return controller.min;
  }
  return 0;
}

type FieldCondition = Extract<
  Condition,
  { kind: "equals" | "includesOption" | "anySelected" | "hasValue" }
>;
type ValidatorCondition = Extract<Condition, { kind: "validator" }>;
type DeviceCondition = Extract<Condition, { kind: "deviceType" }>;
type OutputBlockVisibleCondition = Extract<
  Condition,
  { kind: "outputBlockVisible" }
>;
type UserHasCityCondition = Extract<Condition, { kind: "userHasCity" }>;
type FirstContractSignedCondition = Extract<
  Condition,
  { kind: "firstContractSigned" }
>;
type CompletedActionCountCondition = Extract<
  Condition,
  { kind: "completedActionCount" }
>;

function isFieldCondition(cond: Condition): cond is FieldCondition {
  return (
    cond.kind === "equals" ||
    cond.kind === "includesOption" ||
    cond.kind === "anySelected" ||
    cond.kind === "hasValue"
  );
}

function isValidatorCondition(cond: Condition): cond is ValidatorCondition {
  return cond.kind === "validator";
}

function isDeviceCondition(cond: Condition): cond is DeviceCondition {
  return cond.kind === "deviceType";
}

function isOutputBlockVisibleCondition(
  cond: Condition,
): cond is OutputBlockVisibleCondition {
  return cond.kind === "outputBlockVisible";
}

function isUserHasCityCondition(cond: Condition): cond is UserHasCityCondition {
  return cond.kind === "userHasCity";
}

function isFirstContractSignedCondition(
  cond: Condition,
): cond is FirstContractSignedCondition {
  return cond.kind === "firstContractSigned";
}

function isCompletedActionCountCondition(
  cond: Condition,
): cond is CompletedActionCountCondition {
  return cond.kind === "completedActionCount";
}

/** Format an ISO datetime for a datetime-local input (local wall-clock). */
function isoToDatetimeLocalValue(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(
    parsed.getDate(),
  )}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

function isHasValueCondition(
  condition: Condition,
): condition is Extract<Condition, { kind: "hasValue" }> {
  return condition.kind === "hasValue";
}

function isIncludesOptionCondition(
  condition: Condition,
): condition is Extract<Condition, { kind: "includesOption" }> {
  return condition.kind === "includesOption";
}

function isAnySelectedCondition(
  condition: Condition,
): condition is Extract<Condition, { kind: "anySelected" }> {
  return condition.kind === "anySelected";
}

function isEqualsCondition(
  condition: Condition,
): condition is Extract<Condition, { kind: "equals" }> {
  return condition.kind === "equals";
}

export function ConditionalVisibility({
  field,
  previousFields,
  onChange,
  outputBlocks,
}: ConditionalVisibilityProps) {
  const ANY_SELECTED_VALUE = "__ANY_SELECTED__";
  const controllers = (previousFields || []).filter((f): f is ControllerField =>
    isConditionalController(f),
  );
  const {
    validators,
    loading: validatorsLoading,
    error: validatorsError,
  } = useCustomValidators();
  const { createDraftId, drafts, removeDraft, setDraft } =
    useCustomValidatorDrafts();

  const {
    options: formList,
    isLoading: formListLoading,
    isError: formListFailed,
  } = useFormOptions();

  const activeExternalFormIds = useMemo(() => {
    const ids = new Set<number>();
    const formula = field.visibleIfFormula;
    if (formula?.conditions) {
      for (const cond of Object.values(formula.conditions)) {
        if (isFieldCondition(cond) && typeof cond.sourceFormId === "number") {
          ids.add(cond.sourceFormId);
        }
      }
    }
    return Array.from(ids);
  }, [field.visibleIfFormula]);

  const { byForm: externalFieldsMap, statusByForm: externalFieldsStatus } =
    useFormQuestionFieldsMap(activeExternalFormIds);
  const peekFormFields = useFormQuestionFieldsPeek();

  const getExternalControllers = useCallback(
    (formId: number): ControllerField[] => {
      const fields = externalFieldsMap[formId] ?? [];
      return fields.filter((f): f is ControllerField =>
        isConditionalController(f),
      );
    },
    [externalFieldsMap],
  );

  const usableValidators = useMemo(
    () => validators.filter((validator) => validator.usableForVisibility),
    [validators],
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
    return [];
  }, [field.visibleIfFormula]);

  const formulaText = useMemo(() => {
    const formula = field.visibleIfFormula;
    if (formula?.formula) {
      return serializeVisibilityFormula(formula.formula);
    }
    return defaultFormulaForConditionCount(conditions.length);
  }, [field.visibleIfFormula, conditions.length]);

  const allowedConditionNames = useMemo(
    () => new Set(conditions.map((_, i) => conditionNameForIndex(i))),
    [conditions],
  );

  const buildConditionForField = useCallback(
    (
      controller: ControllerField | undefined,
      sourceFormId?: number,
    ): FieldCondition | null => {
      if (!controller) {
        return null;
      }
      const base = sourceFormId
        ? { when: controller.id, sourceFormId }
        : { when: controller.id };
      if (isTextContentController(controller)) {
        return { kind: "hasValue", ...base, hasValue: true };
      }
      if (controller.kind === "checkbox") {
        return { kind: "equals", ...base, equals: true };
      }
      if (controller.kind === "contract") {
        return { kind: "equals", ...base, equals: true };
      }
      if (controller.kind === "multiselect") {
        return {
          kind: "includesOption",
          ...base,
          includesOption: controller.options?.[0]?.value ?? "",
        };
      }
      if (controller.kind === "number") {
        return {
          kind: "equals",
          ...base,
          equals: defaultNumberEqualsForVisibility(controller),
        };
      }
      if (controller.kind === "range") {
        const values = getRangeValues(controller);
        return { kind: "equals", ...base, equals: values[0] ?? 1 };
      }
      return {
        kind: "equals",
        ...base,
        equals: controller.options?.[0]?.value ?? "",
      };
    },
    [],
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
            allowed,
          );
        }
      } else {
        formulaNode = parseOrDefaultFormula(
          defaultFormulaForConditionCount(next.length),
          allowed,
        );
      }
      if (next.length === 0) {
        onChange({ visibleIfFormula: undefined });
        return;
      }
      onChange({
        visibleIfFormula: { conditions: conditionsMap, formula: formulaNode },
      });
    },
    [onChange, field.visibleIfFormula],
  );

  function parseOrDefaultFormula(
    defaultStr: string,
    allowed: Set<string>,
  ): VisibleIfFormula["formula"] {
    const parsed = parseVisibilityFormula(defaultStr, allowed);
    if ("error" in parsed) {
      const fallback = parseVisibilityFormula(
        "condition1",
        new Set(["condition1"]),
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
    [conditions, allowedConditionNames, onChange],
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
    [conditions, removeDraft, updateConditions],
  );

  const createDefaultFieldCondition = useCallback((): FieldCondition | null => {
    return buildConditionForField(controllers[0]);
  }, [buildConditionForField, controllers]);

  const addFieldCondition = useCallback((): boolean => {
    const condition = createDefaultFieldCondition();
    if (!condition) {
      setConditionError(
        "Add a checkbox, contract, select, radio, multiselect, range, number, or text field earlier on this page first.",
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
      (validator) => !validator.withIdField,
    );
    return withoutId?.id ?? usableValidators[0]?.id;
  }, [usableValidators]);

  type ValidatorConfig = {
    type: CustomValidatorType;
    idArgument: string | null;
    expression: string | null;
  };

  const [validatorConfigs, setValidatorConfigs] = useState<
    Record<number, ValidatorConfig>
  >({});

  const pendingValidatorFetch = useRef<Set<number>>(new Set());

  useEffect(() => {
    const missing = conditions
      .filter(isValidatorCondition)
      .map((condition) => condition.validatorId)
      .filter(
        (id): boolean =>
          !isDraftValidatorId(id) &&
          validatorConfigs[id] === undefined &&
          !pendingValidatorFetch.current.has(id),
      );
    if (!missing.length) {
      return;
    }

    missing.forEach((id) => pendingValidatorFetch.current.add(id));
    Promise.all(
      missing.map(async (id) => {
        try {
          const response = await tasksFindOneCustomValidatorAdmin({
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
          ] as const;
        } catch (error) {
          console.error("Failed to load visibility validator", error);
          return [id, undefined] as const;
        }
      }),
    )
      .then((entries) => {
        const resolved = entries.filter(
          (entry): entry is readonly [number, ValidatorConfig] =>
            entry[1] !== undefined,
        );
        if (resolved.length === 0) return;
        setValidatorConfigs((prev) => {
          const next = { ...prev };
          for (const [id, config] of resolved) {
            next[id] = config;
          }
          return next;
        });
      })
      .finally(() => {
        missing.forEach((id) => pendingValidatorFetch.current.delete(id));
      });
  }, [conditions, validatorConfigs]);

  const addValidatorCondition = useCallback(
    async (params: {
      type: CustomValidatorType | undefined;
      idArgument: string | null;
      resultEquals: boolean;
      expression: string | null;
    }): Promise<boolean> => {
      const desiredType = params.type ?? pickDefaultValidatorType();
      if (!desiredType) {
        setConditionError(
          "No custom validators are available for conditional visibility.",
        );
        return false;
      }
      const draftId = createDraftId();
      setDraft(draftId, {
        type: desiredType,
        idArgument: params.idArgument,
        expression: params.expression,
      });
      const nextCondition: ValidatorCondition = {
        kind: "validator",
        validatorId: draftId,
        resultEquals: params.resultEquals,
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
    ],
  );

  const handleSourceFormChange = useCallback(
    (index: number, formId: number) => {
      const cached = peekFormFields(formId);
      const extCtrls = (cached ?? []).filter((f): f is ControllerField =>
        isConditionalController(f),
      );
      // Nothing cached, or nothing in it to point at: seed a placeholder, so
      // the form still gets selected and the next render's
      // activeExternalFormIds starts the query that fills the picker in.
      const placeholder: FieldCondition = {
        kind: "hasValue",
        when: "",
        hasValue: true,
        sourceFormId: formId,
      };
      const next = [...conditions];
      next[index] = buildConditionForField(extCtrls[0], formId) ?? placeholder;
      updateConditions(next, true);
    },
    [buildConditionForField, conditions, peekFormFields, updateConditions],
  );

  const addCrossFormCondition = useCallback(() => {
    if (formList.length === 0) return;
    const firstFormId = formList[0].id;
    const cached = peekFormFields(firstFormId);
    if (cached) {
      const extCtrls = cached.filter((f): f is ControllerField =>
        isConditionalController(f),
      );
      const first = extCtrls[0];
      const cond = buildConditionForField(first, firstFormId);
      if (cond) {
        updateConditions([...conditions, cond]);
        return;
      }
    }
    const placeholder: FieldCondition = {
      kind: "hasValue",
      when: "",
      hasValue: true,
      sourceFormId: firstFormId,
    };
    updateConditions([...conditions, placeholder]);
  }, [
    buildConditionForField,
    conditions,
    formList,
    peekFormFields,
    updateConditions,
  ]);

  const addDeviceCondition = useCallback(() => {
    const defaultCondition: DeviceCondition = {
      kind: "deviceType",
      deviceType: [...DEVICE_VISIBILITY_TARGETS],
    };
    const next = [...conditions, defaultCondition];
    updateConditions(next);
  }, [conditions, updateConditions]);

  const addUserHasCityCondition = useCallback(() => {
    const defaultCondition: UserHasCityCondition = {
      kind: "userHasCity",
      userHasCity: true,
    };
    updateConditions([...conditions, defaultCondition]);
  }, [conditions, updateConditions]);

  const handleUserHasCityChange = useCallback(
    (index: number, userHasCity: boolean) => {
      const next = [...conditions];
      const current = next[index];
      if (!isUserHasCityCondition(current)) return;
      next[index] = { ...current, userHasCity };
      updateConditions(next, true);
    },
    [conditions, updateConditions],
  );

  const addFirstContractSignedCondition = useCallback(() => {
    const defaultCondition: FirstContractSignedCondition = {
      kind: "firstContractSigned",
      comparison: "before",
      date: new Date().toISOString(),
    };
    updateConditions([...conditions, defaultCondition]);
  }, [conditions, updateConditions]);

  const handleFirstContractSignedChange = useCallback(
    (
      index: number,
      updates: Partial<
        Pick<FirstContractSignedCondition, "comparison" | "date">
      >,
    ) => {
      const next = [...conditions];
      const current = next[index];
      if (!isFirstContractSignedCondition(current)) return;
      next[index] = { ...current, ...updates };
      updateConditions(next, true);
    },
    [conditions, updateConditions],
  );

  const addCompletedActionCountCondition = useCallback(() => {
    const defaultCondition: CompletedActionCountCondition = {
      kind: "completedActionCount",
      atLeast: 1,
    };
    updateConditions([...conditions, defaultCondition]);
  }, [conditions, updateConditions]);

  const handleCompletedActionCountChange = useCallback(
    (index: number, atLeast: number) => {
      const next = [...conditions];
      const current = next[index];
      if (!isCompletedActionCountCondition(current)) return;
      next[index] = { ...current, atLeast };
      updateConditions(next, true);
    },
    [conditions, updateConditions],
  );

  const addOutputBlockVisibleCondition = useCallback(() => {
    if (!outputBlocks || outputBlocks.length === 0) return;
    const firstId = outputBlocks.find((b) => b.id !== field.id)?.id;
    if (!firstId) return;
    const defaultCondition: OutputBlockVisibleCondition = {
      kind: "outputBlockVisible",
      outputBlockVisible: firstId,
      isVisible: true,
    };
    updateConditions([...conditions, defaultCondition]);
  }, [conditions, outputBlocks, field.id, updateConditions]);

  const handleOutputBlockVisibleChange = useCallback(
    (
      index: number,
      updates: Partial<
        Pick<OutputBlockVisibleCondition, "outputBlockVisible" | "isVisible">
      >,
    ) => {
      const next = [...conditions];
      const current = next[index];
      if (!isOutputBlockVisibleCondition(current)) return;
      next[index] = { ...current, ...updates };
      updateConditions(next, true);
    },
    [conditions, updateConditions],
  );

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
        kind: "deviceType",
        deviceType: DEVICE_VISIBILITY_TARGETS.filter((type) =>
          currentSelection.has(type),
        ),
      };
      updateConditions(next, true);
    },
    [conditions, updateConditions],
  );

  const getConditionSourceFormId = (cond: Condition): number | undefined => {
    if (isFieldCondition(cond)) {
      return cond.sourceFormId;
    }
    return undefined;
  };

  const handleControllerChange = useCallback(
    (index: number, id: string) => {
      const existing = conditions[index];
      const sourceFormId = getConditionSourceFormId(existing);
      const pool = sourceFormId
        ? getExternalControllers(sourceFormId)
        : controllers;
      const nextField = pool.find((f) => f.id === id);
      if (!nextField) {
        return;
      }
      const nextCondition = buildConditionForField(nextField, sourceFormId);
      if (!nextCondition) {
        return;
      }
      const next = [...conditions];
      next[index] = nextCondition;
      updateConditions(next, true);
    },
    [
      buildConditionForField,
      conditions,
      controllers,
      getExternalControllers,
      updateConditions,
    ],
  );

  const handleNumberConditionModeChange = useCallback(
    (index: number, mode: "equals" | "has_value" | "empty") => {
      const next = [...conditions];
      const current = next[index];
      if (!isFieldCondition(current)) {
        return;
      }
      const sourceFormId = getConditionSourceFormId(current);
      const pool = sourceFormId
        ? getExternalControllers(sourceFormId)
        : controllers;
      const controller = pool.find((f) => f.id === current.when);
      if (!controller || controller.kind !== "number") {
        return;
      }
      const base = sourceFormId
        ? { when: controller.id, sourceFormId }
        : { when: controller.id };
      if (mode === "has_value") {
        next[index] = { kind: "hasValue", ...base, hasValue: true };
      } else if (mode === "empty") {
        next[index] = { kind: "hasValue", ...base, hasValue: false };
      } else {
        const existingNum =
          isEqualsCondition(current) && typeof current.equals === "number"
            ? current.equals
            : defaultNumberEqualsForVisibility(controller);
        next[index] = { kind: "equals", ...base, equals: existingNum };
      }
      updateConditions(next, true);
    },
    [conditions, controllers, getExternalControllers, updateConditions],
  );

  const handleNumberEqualsInputChange = useCallback(
    (index: number, raw: string) => {
      const next = [...conditions];
      const current = next[index];
      if (!isFieldCondition(current)) {
        return;
      }
      const sourceFormId = getConditionSourceFormId(current);
      const pool = sourceFormId
        ? getExternalControllers(sourceFormId)
        : controllers;
      const controller = pool.find((f) => f.id === current.when);
      if (!controller || controller.kind !== "number") {
        return;
      }
      const base = sourceFormId
        ? { when: controller.id, sourceFormId }
        : { when: controller.id };
      const prev =
        isEqualsCondition(current) && typeof current.equals === "number"
          ? current.equals
          : defaultNumberEqualsForVisibility(controller);
      const n = raw.trim() === "" ? NaN : parseFloat(raw);
      const equals = Number.isFinite(n) ? n : prev;
      next[index] = { kind: "equals", ...base, equals };
      updateConditions(next, true);
    },
    [conditions, controllers, getExternalControllers, updateConditions],
  );

  const handleConditionValueChange = useCallback(
    (index: number, value: string) => {
      const next = [...conditions];
      const current = next[index];
      if (!isFieldCondition(current)) {
        return;
      }
      const sourceFormId = getConditionSourceFormId(current);
      const pool = sourceFormId
        ? getExternalControllers(sourceFormId)
        : controllers;
      const controller = pool.find((f) => f.id === current.when);
      if (!controller) {
        return;
      }
      const base = sourceFormId
        ? { when: controller.id, sourceFormId }
        : { when: controller.id };
      if (isTextContentController(controller)) {
        next[index] = { kind: "hasValue", ...base, hasValue: value === "true" };
      } else if (controller.kind === "checkbox") {
        next[index] = { kind: "equals", ...base, equals: value === "true" };
      } else if (controller.kind === "contract") {
        next[index] = { kind: "equals", ...base, equals: value === "true" };
      } else if (controller.kind === "multiselect") {
        next[index] =
          value === ANY_SELECTED_VALUE
            ? { kind: "anySelected", ...base, anySelected: true }
            : { kind: "includesOption", ...base, includesOption: value };
      } else if (controller.kind === "range") {
        next[index] = { kind: "equals", ...base, equals: Number(value) };
      } else if (controller.kind === "number") {
        const n = parseFloat(value);
        next[index] = {
          kind: "equals",
          ...base,
          equals: Number.isFinite(n)
            ? n
            : defaultNumberEqualsForVisibility(controller),
        };
      } else {
        next[index] = { kind: "equals", ...base, equals: value };
      }
      updateConditions(next, true);
    },
    [conditions, controllers, getExternalControllers, updateConditions],
  );

  const handleValidatorSelection = useCallback(
    async (params: {
      index: number;
      validatorType: CustomValidatorType | undefined;
      idArgument: string | null;
      expression: string | null;
    }) => {
      const { index, validatorType, idArgument, expression } = params;
      if (!validatorType) {
        removeCondition(index);
        return;
      }
      console.log(
        "handleValidatorSelection",
        validatorType,
        idArgument,
        expression,
      );
      const next = [...conditions];
      const existing = next[index];
      const resultEquals = isValidatorCondition(existing)
        ? (existing.resultEquals ?? true)
        : true;
      const existingValidatorId = isValidatorCondition(existing)
        ? existing.validatorId
        : undefined;
      const draftId = isDraftValidatorId(existingValidatorId)
        ? existingValidatorId
        : createDraftId();
      setDraft(draftId, { type: validatorType, idArgument, expression });
      next[index] = {
        kind: "validator",
        validatorId: draftId,
        resultEquals,
      };
      updateConditions(next, true);
    },
    [conditions, createDraftId, removeCondition, setDraft, updateConditions],
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
    [conditions, updateConditions],
  );

  const renderFieldCondition = (condition: FieldCondition, index: number) => {
    const sourceFormId = condition.sourceFormId;
    const isCrossForm = sourceFormId != null;
    const externalStatus =
      sourceFormId != null ? externalFieldsStatus[sourceFormId] : undefined;
    const externalError = formFieldsErrorReason(externalStatus);
    const pool = isCrossForm
      ? getExternalControllers(sourceFormId)
      : controllers;
    const controller = pool.find((f) => f.id === condition.when);
    const hasContentValue = isHasValueCondition(condition)
      ? String(condition.hasValue ?? true)
      : "true";
    const multiSelectValue =
      controller?.kind === "multiselect"
        ? isAnySelectedCondition(condition)
          ? ANY_SELECTED_VALUE
          : isIncludesOptionCondition(condition)
            ? (condition.includesOption ?? "")
            : isEqualsCondition(condition) &&
                typeof condition.equals === "string"
              ? condition.equals
              : ""
        : "";
    const rangeValues =
      controller?.kind === "range" ? getRangeValues(controller) : [];
    return (
      <div className="space-y-2">
        {isCrossForm && (
          <div>
            <label className="block text-xs text-gray-700 mb-1">
              Source form (cross-form)
            </label>
            <select
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={sourceFormId ?? ""}
              onChange={(event) => {
                const nextId = Number(event.target.value);
                if (Number.isFinite(nextId)) {
                  handleSourceFormChange(index, nextId);
                }
              }}
            >
              {formListLoading && <option value="">Loading forms…</option>}
              {formList.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title} (#{f.id})
                </option>
              ))}
            </select>
            {formListFailed && (
              <FormPickerError
                reason={FormPickerErrorReason.FormList}
                className="text-[11px] mt-1"
              />
            )}
            {externalStatus === FormFieldsStatus.Pending && (
              <p className="text-[11px] text-gray-400 mt-1">Loading fields…</p>
            )}
            {externalError && (
              <FormPickerError
                reason={externalError}
                className="text-[11px] mt-1"
              />
            )}
          </div>
        )}
        <div>
          <label className="block text-xs text-gray-700 mb-1">
            Show when field
          </label>
          <select
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={controller ? controller.id : (pool[0]?.id ?? "")}
            onChange={(event) =>
              handleControllerChange(index, event.target.value)
            }
          >
            {pool.map((f) => (
              <option key={f.id} value={f.id}>
                {fieldPickerLabel(f)}
              </option>
            ))}
            {pool.length === 0 && (
              <option value="">
                {externalStatus === FormFieldsStatus.Pending
                  ? "Loading…"
                  : "No fields available"}
              </option>
            )}
          </select>
        </div>

        {controller ? (
          <div>
            <label className="block text-xs text-gray-700 mb-1">
              {isTextContentController(controller)
                ? "has content"
                : controller.kind === "multiselect"
                  ? "includes option"
                  : controller.kind === "number"
                    ? "when value"
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
                    : false,
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
                    : true,
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
                  isEqualsCondition(condition) ? (condition.equals ?? "") : "",
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
            ) : controller.kind === "number" ? (
              <div className="space-y-2">
                <select
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={
                    isHasValueCondition(condition)
                      ? condition.hasValue
                        ? "has_value"
                        : "empty"
                      : "equals"
                  }
                  onChange={(event) => {
                    const v = event.target.value;
                    handleNumberConditionModeChange(
                      index,
                      v === "has_value"
                        ? "has_value"
                        : v === "empty"
                          ? "empty"
                          : "equals",
                    );
                  }}
                >
                  <option value="equals">Equals</option>
                  <option value="has_value">Has any value</option>
                  <option value="empty">Is empty</option>
                </select>
                {!isHasValueCondition(condition) ? (
                  <input
                    type="number"
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    step={
                      controller.step !== undefined
                        ? String(controller.step)
                        : "any"
                    }
                    min={controller.min}
                    max={controller.max}
                    value={
                      isEqualsCondition(condition) &&
                      typeof condition.equals === "number"
                        ? condition.equals
                        : defaultNumberEqualsForVisibility(controller)
                    }
                    onChange={(event) =>
                      handleNumberEqualsInputChange(index, event.target.value)
                    }
                  />
                ) : null}
              </div>
            ) : (
              <select
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={String(
                  isEqualsCondition(condition) ? (condition.equals ?? "") : "",
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
    index: number,
  ) => {
    const config = isDraftValidatorId(condition.validatorId)
      ? drafts[condition.validatorId]
      : validatorConfigs[condition.validatorId];
    return (
      <div className="space-y-2">
        <CustomValidatorSelect
          type={config?.type}
          idArgument={config?.idArgument ?? null}
          expression={config?.expression ?? null}
          onChange={({ validatorType, idArgument, expression }) =>
            void handleValidatorSelection({
              index,
              validatorType,
              idArgument,
              expression,
            })
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

  const renderOutputBlockVisibleCondition = (
    condition: OutputBlockVisibleCondition,
    index: number,
  ) => {
    const allBlocks = outputBlocks ?? [];
    const candidates = allBlocks.filter((b) => b.id !== field.id);
    const isVisible = condition.isVisible ?? true;
    const referencedId = condition.outputBlockVisible;
    const isMissing =
      referencedId.length > 0 &&
      !candidates.some((b) => b.id === referencedId) &&
      referencedId !== field.id;
    return (
      <div className="space-y-2">
        <div>
          <label className="block text-xs text-gray-700 mb-1">
            Show when output block
          </label>
          <select
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={referencedId}
            onChange={(event) =>
              handleOutputBlockVisibleChange(index, {
                outputBlockVisible: event.target.value,
              })
            }
          >
            {candidates.length === 0 && !isMissing && (
              <option value={referencedId}>
                No other output blocks available
              </option>
            )}
            {isMissing && (
              <option value={referencedId}>
                Missing block ({referencedId})
              </option>
            )}
            {allBlocks.map((b) => {
              const isSelf = b.id === field.id;
              return (
                <option key={b.id} value={b.id} disabled={isSelf}>
                  ({b.id}) {b.label}
                  {isSelf ? " (current block)" : ""}
                </option>
              );
            })}
          </select>
          {isMissing && (
            <p className="mt-1 text-[11px] text-red-500">
              Referenced block was deleted. Pick another block or remove this
              rule.
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs text-gray-700 mb-1">is</label>
          <select
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={String(isVisible)}
            onChange={(event) =>
              handleOutputBlockVisibleChange(index, {
                isVisible: event.target.value === "true",
              })
            }
          >
            <option value="true">Visible in this output view</option>
            <option value="false">Hidden in this output view</option>
          </select>
        </div>
      </div>
    );
  };

  const renderUserHasCityCondition = (
    condition: UserHasCityCondition,
    index: number,
  ) => {
    return (
      <div className="space-y-2">
        <label className="block text-xs text-gray-700 mb-1">
          Show when the user&apos;s city
        </label>
        <select
          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={String(condition.userHasCity)}
          onChange={(event) =>
            handleUserHasCityChange(index, event.target.value === "true")
          }
        >
          <option value="true">is set</option>
          <option value="false">is not set</option>
        </select>
      </div>
    );
  };

  const renderFirstContractSignedCondition = (
    condition: FirstContractSignedCondition,
    index: number,
  ) => {
    const datetimeLocalValue = isoToDatetimeLocalValue(condition.date);
    return (
      <div className="space-y-2">
        <div>
          <label className="block text-xs text-gray-700 mb-1">
            Show when the user&apos;s first contract signing is
          </label>
          <select
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={condition.comparison}
            onChange={(event) =>
              handleFirstContractSignedChange(index, {
                comparison:
                  event.target.value === "onOrAfter" ? "onOrAfter" : "before",
              })
            }
          >
            <option value="before">before</option>
            <option value="onOrAfter">on or after</option>
          </select>
        </div>
        <div>
          <input
            type="datetime-local"
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={datetimeLocalValue}
            onChange={(event) => {
              const parsed = new Date(event.target.value);
              if (Number.isNaN(parsed.getTime())) return;
              handleFirstContractSignedChange(index, {
                date: parsed.toISOString(),
              });
            }}
          />
          <p className="mt-1 text-[11px] text-gray-400">
            Shown in your local timezone. Users who have never signed a contract
            match neither option.
          </p>
        </div>
      </div>
    );
  };

  const renderCompletedActionCountCondition = (
    condition: CompletedActionCountCondition,
    index: number,
  ) => (
    <div>
      <label className="block text-xs text-gray-700 mb-1">
        Show when the user has completed at least
      </label>
      <input
        type="number"
        min={0}
        step={1}
        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        value={condition.atLeast}
        onChange={(event) => {
          const parsed = Number.parseInt(event.target.value, 10);
          if (Number.isNaN(parsed) || parsed < 0) return;
          handleCompletedActionCountChange(index, parsed);
        }}
      />
      <p className="mt-1 text-[11px] text-gray-400">Actions</p>
    </div>
  );

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
                      event.target.checked,
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
                : "border-gray-300 focus:ring-blue-500",
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
                {isFieldCondition(condition) &&
                  getConditionSourceFormId(condition) != null && (
                    <span className="ml-1 text-[10px] text-blue-500 font-normal">
                      cross-form
                    </span>
                  )}
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
            ) : isOutputBlockVisibleCondition(condition) ? (
              renderOutputBlockVisibleCondition(condition, index)
            ) : isUserHasCityCondition(condition) ? (
              renderUserHasCityCondition(condition, index)
            ) : isFirstContractSignedCondition(condition) ? (
              renderFirstContractSignedCondition(condition, index)
            ) : isCompletedActionCountCondition(condition) ? (
              renderCompletedActionCountCondition(condition, index)
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
            onClick={addCrossFormCondition}
            disabled={formListLoading || formList.length === 0}
          >
            + Cross-form condition
          </button>
          <button
            type="button"
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-40"
            onClick={() =>
              void addValidatorCondition({
                type: undefined,
                idArgument: null,
                resultEquals: true,
                expression: null,
              })
            }
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
          {outputBlocks === undefined && (
            <>
              <button
                type="button"
                className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                onClick={addUserHasCityCondition}
              >
                + User has city condition
              </button>
              <button
                type="button"
                className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                onClick={addFirstContractSignedCondition}
              >
                + First contract signed condition
              </button>
              <button
                type="button"
                className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                onClick={addCompletedActionCountCondition}
              >
                + Completed actions condition
              </button>
            </>
          )}
          {outputBlocks !== undefined && (
            <button
              type="button"
              className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-40"
              onClick={addOutputBlockVisibleCondition}
              disabled={
                outputBlocks.filter((b) => b.id !== field.id).length === 0
              }
            >
              + Output block visible condition
            </button>
          )}
        </div>
        {!canUseFieldControllers && (
          <p className="text-[11px] text-gray-400">
            Add a checkbox, contract, select, radio, multiselect, range, number,
            or text field earlier on this page to use answer-based visibility.
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
  const response = await tasksCustomValidatorsAdmin();
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
    () => cachedValidators ?? [],
  );
  const [loading, setLoading] = useState<boolean>(
    () => !cachedValidators && !cachedValidatorsError,
  );
  const [error, setError] = useState<string | null>(
    () => cachedValidatorsError,
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
  const response = await userListAdmin();
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
    () => enabled && !cachedUsers && !cachedUsersError,
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

type CustomValidatorSelectProps = {
  type?: CustomValidatorType;
  idArgument: string | null;
  expression: string | null;
  onChange: (params: {
    validatorType: CustomValidatorType | undefined;
    idArgument: string | null;
    expression: string | null;
  }) => void;
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
  const { tags, isLoading: tagsLoading } = useTagsAdmin({
    enabled: isMemberTag,
  });
  const {
    users,
    loading: usersLoading,
    error: usersError,
  } = useUsers(isCustomExpression);
  const activeUsers = useMemo(
    () => users.filter((user) => user.hasActiveContract),
    [users],
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
      onChange({ validatorType: undefined, idArgument, expression });
      return;
    }
    onChange({
      validatorType: nextValue as CustomValidatorType,
      idArgument,
      expression,
    });
  };

  const hasValidators = availableValidators.length > 0;
  const sortedTags = useMemo(
    () => [...tags].sort((a, b) => a.name.localeCompare(b.name)),
    [tags],
  );
  const hasExpression = Boolean(expression?.trim());
  const sortedUsers = useMemo(
    () => [...activeUsers].sort((a, b) => a.name.localeCompare(b.name)),
    [activeUsers],
  );
  const selectedUser = useMemo(
    () => activeUsers.find((user) => user.id === selectedUserId),
    [selectedUserId, activeUsers],
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
      a.name.localeCompare(b.name),
    );
  }, [expressionTest?.passUsers]);
  const failUsers = useMemo(() => {
    if (!expressionTest?.failUsers) {
      return [];
    }
    return [...expressionTest.failUsers].sort((a, b) =>
      a.name.localeCompare(b.name),
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
      const response = await tasksTestCustomExpressionAdmin({
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
                onChange({
                  validatorType: type,
                  idArgument: e.target.value === "" ? null : e.target.value,
                  expression,
                })
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
                onChange({
                  validatorType: type,
                  idArgument: e.target.value === "" ? null : e.target.value,
                  expression,
                })
              }
              className="px-2 py-1 text-xs border border-gray-300 rounded bg-white w-24"
            />
          ))}
      </div>
      {type === "CustomExpression" && (
        <div className="space-y-2">
          <textarea
            value={expression ?? ""}
            onChange={(e) =>
              onChange({
                validatorType: type,
                idArgument,
                expression: e.target.value,
              })
            }
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
                    event.target.value ? Number(event.target.value) : null,
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
                    expressionTest.result ? "text-green-600" : "text-red-600",
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
