import type { DisplayBlock } from "./display-blocks";
import { isQuestionField, type AnyField, type FormSchema } from "./form-schema";
import type { Condition, VisibleIfFormula } from "./visible-if-formula";

/**
 * Every condition governing a form's input pages: `visibleIfFormula`
 * conditions on pages, elements and list sub-fields, plus `requiredIfFormula`
 * on question fields (only they carry one — see `baseFieldSchema`).
 *
 * Anything that reacts to which condition *kinds* a schema contains — which
 * values to fetch before evaluating, which source forms to load — should walk
 * with this instead of re-deriving the traversal, so a new place to hang a
 * condition only has to be taught about here.
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
  const visitFormula = (formula: VisibleIfFormula | undefined): boolean => {
    for (const condition of Object.values(formula?.conditions ?? {})) {
      if (visit(condition) === true) return true;
    }
    return false;
  };
  const visitElement = (element: AnyField | DisplayBlock): boolean => {
    if (visitFormula(element.visibleIfFormula)) return true;
    if (!isQuestionField(element)) return false;
    if (visitFormula(element.requiredIfFormula)) return true;
    if (element.kind === "list") {
      for (const sub of element.fields ?? []) {
        if (visitElement(sub)) return true;
      }
    }
    return false;
  };
  for (const page of schema.pages ?? []) {
    if (visitFormula(page.visibleIfFormula)) return true;
    for (const element of page.fields ?? []) {
      if (visitElement(element)) return true;
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

/** Scan a form schema for all sourceFormIds referenced in visibility conditions. */
export function collectSourceFormIds(schema: FormSchema): number[] {
  const ids = new Set<number>();
  forEachCondition(schema, (c) => {
    switch (c.kind) {
      case "equals":
      case "includesOption":
      case "anySelected":
      case "selectedCount":
      case "hasValue":
        if (typeof c.sourceFormId === "number") {
          ids.add(c.sourceFormId);
        }
        break;
      case "validator":
      case "deviceType":
      case "outputBlockVisible":
      case "userHasCity":
      case "userPropertyHasValue":
      case "firstContractSigned":
      case "completedActionCount":
        break;
      default:
        // A kind added in a newer build: it may reference a source form we
        // won't prefetch, but this runs during render, where throwing isn't an
        // option. The renderers block such a schema outright.
        c satisfies never;
        break;
    }
  });
  return Array.from(ids);
}
