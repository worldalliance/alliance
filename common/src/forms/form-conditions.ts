import {
  isQuestionField,
  type AnyField,
  type FormSchema,
  type Page,
} from "./form-schema";
import {
  conditionFieldReference,
  type Condition,
  type VisibleIfFormula,
} from "./visible-if-formula";

export enum PlaceKind {
  Page = "page",
  Element = "element",
  SubField = "subField",
}

/** Where a page, top-level element, or list sub-field sits in the form. */
export type FormPlace =
  | { kind: PlaceKind.Page; pageIndex: number }
  | { kind: PlaceKind.Element; pageIndex: number; index: number }
  | {
      kind: PlaceKind.SubField;
      pageIndex: number;
      index: number;
      subIndex: number;
    };

/** Something on a form's input pages that can carry a condition. */
export type ConditionHolder = {
  place: FormPlace;
  formulas: {
    visibleIfFormula?: VisibleIfFormula;
    requiredIfFormula?: VisibleIfFormula;
  };
  /** The holder when it is a question, which conditions can read. */
  question: AnyField | null;
};

/** Each page, top-level element, and list sub-field, in form order. */
export function* conditionHolders(
  pages: readonly Page[],
): Generator<ConditionHolder> {
  for (const [pageIndex, page] of pages.entries()) {
    yield {
      place: { kind: PlaceKind.Page, pageIndex },
      formulas: page,
      question: null,
    };
    for (const [index, element] of (page.fields ?? []).entries()) {
      const question = isQuestionField(element) ? element : null;
      yield {
        place: { kind: PlaceKind.Element, pageIndex, index },
        formulas: element,
        question,
      };
      if (question?.kind !== "list") continue;
      for (const [subIndex, sub] of (question.fields ?? []).entries()) {
        yield {
          place: { kind: PlaceKind.SubField, pageIndex, index, subIndex },
          formulas: sub,
          question: sub,
        };
      }
    }
  }
}

/**
 * Every condition governing a form's input pages: the form's `skipIfFormula`,
 * and `visibleIfFormula` and `requiredIfFormula` conditions on each of
 * `conditionHolders`.
 *
 * Anything that reacts to which condition *kinds* a schema contains — which
 * values to fetch before evaluating, which source forms to load — should walk
 * with this instead of re-deriving the traversal.
 *
 * Output-view conditions are deliberately excluded: they're scoped to a view,
 * can't read answers or account state, and are validated separately in
 * `form-schema-validate.ts`.
 *
 * Return `true` from `visit` to stop the walk early; the return value says
 * whether it stopped — so passing a predicate that returns `true` on a match
 * doubles as `some`, short-circuiting on the first hit.
 */
export function forEachCondition(
  schema: FormSchema,
  visit: (condition: Condition) => boolean | void,
): boolean {
  for (const condition of Object.values(
    schema.skipIfFormula?.conditions ?? {},
  )) {
    if (visit(condition) === true) return true;
  }
  for (const { formulas } of conditionHolders(schema.pages ?? [])) {
    for (const formula of [
      formulas.visibleIfFormula,
      formulas.requiredIfFormula,
    ]) {
      for (const condition of Object.values(formula?.conditions ?? {})) {
        if (visit(condition) === true) return true;
      }
    }
  }
  return false;
}

/**
 * The conditions `forEachCondition` deliberately skips: those on output-view
 * blocks. Separate rather than a flag on the walk above, because the two
 * answer different questions — that one asks what governs the form being
 * filled out, this one what governs a rendered response.
 *
 * Same early-stop contract as `forEachCondition`.
 */
export function forEachOutputViewCondition(
  schema: FormSchema,
  visit: (condition: Condition) => boolean | void,
): boolean {
  for (const view of schema.outputViews ?? []) {
    for (const block of view.blocks ?? []) {
      for (const condition of Object.values(
        block.visibleIfFormula?.conditions ?? {},
      )) {
        if (visit(condition) === true) return true;
      }
    }
  }
  return false;
}

/** Every sourceFormId the conditions `forEachCondition` walks reference. */
export function collectSourceFormIds(schema: FormSchema): number[] {
  const ids = new Set<number>();
  forEachCondition(schema, (c) => {
    const sourceFormId = conditionFieldReference(c)?.sourceFormId;
    if (sourceFormId != null) ids.add(sourceFormId);
  });
  return Array.from(ids);
}
