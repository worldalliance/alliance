import {
  conditionHolders,
  PlaceKind,
  type FormPlace,
} from "@alliance/common/forms/form-conditions";
import {
  collectFieldLookup,
  type FormSchema,
  type Page,
} from "@alliance/common/forms/form-schema";
import {
  ValidatedFormula,
  validateFormSchema,
  type FormSchemaValidationContext,
  type FormSchemaValidationError,
} from "@alliance/common/forms/form-schema-validate";
import { ROW_LIST_BLOCK_ID } from "@alliance/common/forms/row-list";
import {
  conditionFieldReference,
  type VisibleIfFormula,
} from "@alliance/common/forms/visible-if-formula";
import { undefinedConditionNames } from "@alliance/shared/forms/visibilityFormula";
import { checkExpression } from "../components/form-fields/conditions/conditionFormula";
import {
  expressionKeys,
  typedText,
  type ExpressionBuffer,
} from "../components/form-fields/conditions/expressionBuffers";
import type { VisibilityGroups } from "./visibilityGroups";

export enum IssueTargetKind {
  Place = "place",
  Group = "group",
  OutputView = "outputView",
  Variables = "variables",
  Rows = "rows",
  Form = "form",
}

/** Where the admin repairs an issue; `Form` for one no editor can point at. */
export type IssueTarget =
  | { kind: IssueTargetKind.Place; place: FormPlace }
  | { kind: IssueTargetKind.Group; pageIndex: number; key: string }
  | { kind: IssueTargetKind.OutputView; viewId: string }
  | { kind: IssueTargetKind.Variables }
  | { kind: IssueTargetKind.Rows }
  | { kind: IssueTargetKind.Form };

export type FormIssue = {
  target: IssueTarget;
  message: string;
  /** Whether the target's Conditions section is where it's repaired. */
  inConditions: boolean;
};

const ROLE_LABEL: Record<ValidatedFormula, string> = {
  [ValidatedFormula.Visibility]: "Visibility",
  [ValidatedFormula.RequiredIf]: "Required-if",
};

/** Where each page, element, list sub-field, and accordion part is, by id. */
function placesById(pages: readonly Page[]): Map<string, FormPlace> {
  const places = new Map<string, FormPlace>();
  const add = (id: string | undefined, place: FormPlace) => {
    if (id && !places.has(id)) places.set(id, place);
  };
  for (const { place, question } of conditionHolders(pages)) {
    const page = pages[place.pageIndex]!;
    if (place.kind === PlaceKind.Page) {
      add(page.id, place);
      continue;
    }
    if (place.kind === PlaceKind.SubField) {
      add(question?.id, place);
      continue;
    }
    const element = page.fields[place.index]!;
    add(element.id, place);
    if (element.kind !== "accordion") continue;
    for (const section of element.sections) {
      add(section.id, place);
      for (const block of section.blocks) add(block.id, place);
    }
  }
  return places;
}

function locate({
  error,
  places,
  groups,
}: {
  error: FormSchemaValidationError;
  places: ReadonlyMap<string, FormPlace>;
  groups: VisibilityGroups;
}): IssueTarget {
  if (error.viewId !== undefined) {
    return { kind: IssueTargetKind.OutputView, viewId: error.viewId };
  }
  if (error.variable !== undefined) {
    return { kind: IssueTargetKind.Variables };
  }
  if (error.blockId === ROW_LIST_BLOCK_ID) {
    return { kind: IssueTargetKind.Rows };
  }
  const place = places.get(error.blockId);
  if (!place) return { kind: IssueTargetKind.Form };
  const groupKey =
    place.kind === PlaceKind.Element &&
    error.formula === ValidatedFormula.Visibility
      ? groups.get(error.blockId)
      : undefined;
  return groupKey === undefined
    ? { kind: IssueTargetKind.Place, place }
    : {
        kind: IssueTargetKind.Group,
        pageIndex: place.pageIndex,
        key: groupKey,
      };
}

/**
 * What's wrong with how `formula` reads: the typed expression, while the
 * schema still holds the formula beside it, or else the saved formula's
 * names that no rule defines.
 */
function expressionIssue({
  formula,
  buffer,
  role,
}: {
  formula: VisibleIfFormula | undefined;
  buffer: ExpressionBuffer | undefined;
  role: ValidatedFormula;
}): string | null {
  const text = typedText(buffer, { visibleIfFormula: formula });
  if (text !== null) {
    const checked = checkExpression(text, formula?.conditions ?? {});
    return checked.ok
      ? null
      : `${ROLE_LABEL[role]} expression isn't saved: ${checked.error}`;
  }
  if (!formula) return null;
  const missing = undefinedConditionNames(formula);
  return missing.length === 0
    ? null
    : `${ROLE_LABEL[role]} expression ${usesUndefinedRules(missing)}`;
}

export const usesUndefinedRules = (missing: readonly string[]) =>
  `uses ${missing.join(", ")}, which no rule defines`;

function missingQuestionIssues({
  formula,
  role,
  questionIds,
}: {
  formula: VisibleIfFormula | undefined;
  role: ValidatedFormula;
  questionIds: ReadonlySet<string>;
}): string[] {
  const missing = new Set<string>();
  for (const condition of Object.values(formula?.conditions ?? {})) {
    const reference = conditionFieldReference(condition);
    if (
      reference?.sourceFormId === null &&
      !questionIds.has(reference.fieldId)
    ) {
      missing.add(reference.fieldId);
    }
  }
  return [...missing].map(
    (fieldId) =>
      `${ROLE_LABEL[role]} reads question "${fieldId}", which this form doesn't have`,
  );
}

/**
 * Everything that keeps the draft from saving: the schema's validation
 * errors, expression text that isn't saved, formulas naming rules they don't
 * define, and rules reading questions this form lacks.
 */
export function collectFormIssues({
  schema,
  groups,
  expressions,
  validation,
}: {
  schema: FormSchema;
  groups: VisibilityGroups;
  expressions: Readonly<Record<string, ExpressionBuffer>>;
  validation: FormSchemaValidationContext;
}): FormIssue[] {
  const pages = schema.pages ?? [];
  const places = placesById(pages);
  const issues: FormIssue[] = [];
  const reported = new Set<string>();
  for (const error of validateFormSchema(schema, validation)) {
    const target = locate({ error, places, groups });
    if (target.kind === IssueTargetKind.Group) {
      // Each member holds a copy of the shared formula, so validation reports
      // the same error once per member.
      const key = `${target.key}\n${error.message}`;
      if (reported.has(key)) continue;
      reported.add(key);
    }
    issues.push({
      target,
      message: error.message,
      inConditions: error.formula !== undefined,
    });
  }
  const questionIds = new Set(collectFieldLookup(pages).keys());
  const checkedGroups = new Set<string>();

  for (const { place, formulas } of conditionHolders(pages)) {
    const page = pages[place.pageIndex]!;
    const push = (target: IssueTarget, messages: (string | null)[]) => {
      for (const message of messages) {
        if (message !== null) {
          issues.push({ target, message, inConditions: true });
        }
      }
    };
    const own: IssueTarget = { kind: IssueTargetKind.Place, place };
    const visibility = formulas.visibleIfFormula;

    if (place.kind === PlaceKind.Page) {
      // Validation already reports a page reading any question but an
      // earlier page's, missing ones included.
      push(own, [
        expressionIssue({
          formula: visibility,
          buffer: expressions[expressionKeys.page(page.id)],
          role: ValidatedFormula.Visibility,
        }),
      ]);
      continue;
    }

    const element = page.fields[place.index]!;
    const elementScope =
      element.id &&
      expressionKeys.within(expressionKeys.pageElements(page.id), element.id);
    const sub =
      place.kind === PlaceKind.SubField && element.kind === "list"
        ? element.fields[place.subIndex]
        : undefined;
    const visibilityKey =
      place.kind === PlaceKind.Element
        ? elementScope
        : elementScope &&
          sub?.id &&
          expressionKeys.within(elementScope, sub.id);
    const groupKey =
      place.kind === PlaceKind.Element && element.id
        ? groups.get(element.id)
        : undefined;
    const visibilityIssues = (buffer: ExpressionBuffer | undefined) => [
      expressionIssue({
        formula: visibility,
        buffer,
        role: ValidatedFormula.Visibility,
      }),
      ...missingQuestionIssues({
        formula: visibility,
        role: ValidatedFormula.Visibility,
        questionIds,
      }),
    ];

    if (groupKey === undefined) {
      push(
        own,
        visibilityIssues(
          visibilityKey ? expressions[visibilityKey] : undefined,
        ),
      );
    } else if (!checkedGroups.has(groupKey)) {
      checkedGroups.add(groupKey);
      push(
        {
          kind: IssueTargetKind.Group,
          pageIndex: place.pageIndex,
          key: groupKey,
        },
        visibilityIssues(expressions[expressionKeys.group(groupKey)]),
      );
    }

    push(own, [
      expressionIssue({
        formula: formulas.requiredIfFormula,
        buffer: undefined,
        role: ValidatedFormula.RequiredIf,
      }),
      ...missingQuestionIssues({
        formula: formulas.requiredIfFormula,
        role: ValidatedFormula.RequiredIf,
        questionIds,
      }),
    ]);
  }

  for (const view of schema.outputViews ?? []) {
    for (const block of view.blocks) {
      const messages = [
        expressionIssue({
          formula: block.visibleIfFormula,
          buffer: block.id
            ? expressions[
                expressionKeys.within(
                  expressionKeys.outputView(view.id),
                  block.id,
                )
              ]
            : undefined,
          role: ValidatedFormula.Visibility,
        }),
        ...missingQuestionIssues({
          formula: block.visibleIfFormula,
          role: ValidatedFormula.Visibility,
          questionIds,
        }),
      ];
      for (const message of messages) {
        if (message === null) continue;
        issues.push({
          target: { kind: IssueTargetKind.OutputView, viewId: view.id },
          message,
          inConditions: true,
        });
      }
    }
  }

  return issues;
}

const targetKey = (target: IssueTarget): string => {
  switch (target.kind) {
    case IssueTargetKind.Place: {
      const { place } = target;
      switch (place.kind) {
        case PlaceKind.Page:
          return `page:${place.pageIndex}`;
        case PlaceKind.Element:
          return `element:${place.pageIndex}/${place.index}`;
        case PlaceKind.SubField:
          return `subField:${place.pageIndex}/${place.index}/${place.subIndex}`;
        default:
          throw new Error(
            `unknown place: ${JSON.stringify(place satisfies never)}`,
          );
      }
    }
    case IssueTargetKind.Group:
      return `group:${target.key}`;
    case IssueTargetKind.OutputView:
      return `outputView:${target.viewId}`;
    case IssueTargetKind.Variables:
      return "variables";
    case IssueTargetKind.Rows:
      return "rows";
    case IssueTargetKind.Form:
      return "form";
    default:
      throw new Error(
        `unknown target: ${JSON.stringify(target satisfies never)}`,
      );
  }
};

/** A form's issues, by where the canvas, outline, and sidebar show them. */
export type IssueIndex = {
  /** The messages for exactly `target`. */
  at: (target: IssueTarget) => string[];
  /** How many sit at the element or inside it. */
  inElement: (pageIndex: number, index: number) => number;
  /** How many sit on the page, anywhere. */
  onPage: (pageIndex: number) => number;
};

export function indexIssues(issues: readonly FormIssue[]): IssueIndex {
  const byTarget = new Map<string, string[]>();
  const byElement = new Map<string, number>();
  const byPage = new Map<number, number>();
  const increment = <K>(counts: Map<K, number>, key: K) =>
    counts.set(key, (counts.get(key) ?? 0) + 1);
  for (const { target, message } of issues) {
    const key = targetKey(target);
    byTarget.set(key, [...(byTarget.get(key) ?? []), message]);
    if (target.kind === IssueTargetKind.Group) {
      increment(byPage, target.pageIndex);
    } else if (target.kind === IssueTargetKind.Place) {
      const { place } = target;
      increment(byPage, place.pageIndex);
      if (place.kind !== PlaceKind.Page) {
        increment(byElement, `${place.pageIndex}/${place.index}`);
      }
    }
  }
  return {
    at: (target) => byTarget.get(targetKey(target)) ?? [],
    inElement: (pageIndex, index) =>
      byElement.get(`${pageIndex}/${index}`) ?? 0,
    onPage: (pageIndex) => byPage.get(pageIndex) ?? 0,
  };
}
