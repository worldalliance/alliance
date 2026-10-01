import { formSchemaToDisplayOnly } from "@alliance/common/forms/display-only-schema";
import {
  fieldGroupSchema,
  formSchema,
  isFieldGroup,
  isQuestionField,
  pageSchema,
  type FieldGroup,
  type FormSchema,
  type Page,
  type PageItem,
} from "@alliance/common/forms/form-schema";
import { R, type Result } from "@alliance/common/result";
import { describeSchemaIssues } from "@alliance/common/zod-issues";
import { isEqual } from "es-toolkit";
import type z from "zod";
import { isDraftValidatorId } from "../components/form-fields/customValidatorDrafts";
import { customValidatorIds } from "./customValidatorIds";

export enum JsonScopeKind {
  Element = "element",
  Page = "page",
  Form = "form",
}

export type JsonScope =
  | {
      kind: JsonScopeKind.Element;
      pageIndex: number;
      parentId: string | null;
      index: number;
    }
  | { kind: JsonScopeKind.Page; pageIndex: number }
  | { kind: JsonScopeKind.Form };

type ElementEntry = { id: string | undefined; kind: string };

function nestedEntries(element: PageItem): ElementEntry[] {
  if (isFieldGroup(element)) return elementEntries(element.fields);
  if (isQuestionField(element)) {
    return "fields" in element ? elementEntries(element.fields) : [];
  }
  if (element.kind === "accordion") {
    return element.sections.flatMap((section) => [
      { id: section.id, kind: "accordionSection" },
      ...elementEntries(section.blocks),
    ]);
  }
  return [];
}

function elementEntries(elements: PageItem[]): ElementEntry[] {
  return elements.flatMap((element) => [
    { id: element.id, kind: element.kind },
    ...nestedEntries(element),
  ]);
}

const entryIds = (entries: ElementEntry[]) =>
  entries.flatMap((entry) => (entry.id ? [entry.id] : []));

/** Every id in the form, once per occurrence. */
export function formSchemaIds(schema: FormSchema): string[] {
  return [
    ...schema.pages.flatMap((page) => [
      page.id,
      ...entryIds(elementEntries(page.fields)),
    ]),
    ...schema.outputViews.flatMap((view) => [
      view.id,
      ...view.blocks.flatMap((block) => (block.id ? [block.id] : [])),
    ]),
    ...(schema.aggregateViews ?? []).map((view) => view.id),
  ];
}

function pageAt(schema: FormSchema, pageIndex: number): Page {
  const page = schema.pages[pageIndex];
  if (!page) throw new Error(`no page at index ${pageIndex}`);
  return page;
}

function siblingsAt(page: Page, parentId: string | null): PageItem[] {
  if (parentId == null) return page.fields;
  const group = page.fields.find(
    (item): item is FieldGroup => isFieldGroup(item) && item.id === parentId,
  );
  if (!group) {
    throw new Error(`no group ${parentId} on page ${page.id}`);
  }
  return group.fields;
}

type ElementScope = Extract<JsonScope, { kind: JsonScopeKind.Element }>;

function elementAt(schema: FormSchema, scope: ElementScope): PageItem {
  const siblings = siblingsAt(pageAt(schema, scope.pageIndex), scope.parentId);
  const element = siblings[scope.index];
  if (!element) throw new Error(`no element at index ${scope.index}`);
  return element;
}

export function jsonScopeValue(
  schema: FormSchema,
  scope: JsonScope,
): PageItem | Page | FormSchema {
  switch (scope.kind) {
    case JsonScopeKind.Element:
      return elementAt(schema, scope);
    case JsonScopeKind.Page:
      return pageAt(schema, scope.pageIndex);
    case JsonScopeKind.Form:
      return schema;
    default:
      throw new Error(`unknown scope: ${scope satisfies never}`);
  }
}

const pageItemSchema = pageSchema.shape.fields.element;
const groupChildSchema = fieldGroupSchema.shape.fields.element;

const replaceAt = <T>({
  items,
  index,
  next,
}: {
  items: T[];
  index: number;
  next: T;
}) => items.map((item, i) => (i === index ? next : item));

function mapPageFields(params: {
  schema: FormSchema;
  pageIndex: number;
  map: (fields: PageItem[]) => PageItem[];
}): FormSchema {
  const { schema, pageIndex, map } = params;
  return {
    ...schema,
    pages: schema.pages.map((page, i) =>
      i === pageIndex ? { ...page, fields: map(page.fields) } : page,
    ),
  };
}

function applyElement(params: {
  schema: FormSchema;
  scope: ElementScope;
  value: unknown;
}): Result<FormSchema, string[]> {
  const { schema, scope, value } = params;
  const { pageIndex, parentId, index } = scope;
  if (parentId == null) {
    return R.map(parseInto(pageItemSchema, value), (element) =>
      mapPageFields({
        schema,
        pageIndex,
        map: (fields) => replaceAt({ items: fields, index, next: element }),
      }),
    );
  }
  return R.map(parseInto(groupChildSchema, value), (element) =>
    mapPageFields({
      schema,
      pageIndex,
      map: (fields) =>
        fields.map((item) =>
          isFieldGroup(item) && item.id === parentId
            ? {
                ...item,
                fields: replaceAt({ items: item.fields, index, next: element }),
              }
            : item,
        ),
    }),
  );
}

const isSameValue = <T>(parsed: T, value: unknown): value is T =>
  isEqual(parsed, value);

// zod rebuilds objects in schema key order, so the admin's own value is kept
// when it holds the same data: the JSON keeps its key order, and an unchanged
// Apply leaves the form clean.
function parseInto<T>(
  schema: z.ZodType<T>,
  value: unknown,
): Result<T, string[]> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) return R.failure(describeSchemaIssues(parsed.error));
  return R.success(isSameValue(parsed.data, value) ? value : parsed.data);
}

function applyValue(params: {
  schema: FormSchema;
  scope: JsonScope;
  value: unknown;
}): Result<FormSchema, string[]> {
  const { schema, scope, value } = params;
  switch (scope.kind) {
    case JsonScopeKind.Element:
      return applyElement({ schema, scope, value });
    case JsonScopeKind.Page:
      return R.map(parseInto(pageSchema, value), (page) => ({
        ...schema,
        pages: replaceAt({
          items: schema.pages,
          index: scope.pageIndex,
          next: page,
        }),
      }));
    case JsonScopeKind.Form:
      return R.flatMap(parseInto(formSchema, value), (form) =>
        form.pages.length === 0
          ? R.failure(["pages: A form needs at least one page"])
          : R.success(form),
      );
    default:
      throw new Error(`unknown scope: ${scope satisfies never}`);
  }
}

// Only collisions the paste adds, so a duplicate already in the form doesn't
// block unrelated edits.
function newIdCollisions(before: FormSchema, after: FormSchema): string[] {
  const countIds = (schema: FormSchema) => {
    const counts = new Map<string, number>();
    for (const id of formSchemaIds(schema)) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  };
  const countsBefore = countIds(before);
  return [...countIds(after)]
    .filter(([id, count]) => count > 1 && count > (countsBefore.get(id) ?? 0))
    .map(([id]) => `Id "${id}" is used more than once in the form`);
}

const quoteIds = (ids: string[]) => ids.map((id) => `"${id}"`).join(", ");

// Matching is by id, so a rename reads as one id going and another arriving.
// A plain removal or addition stays unwarned, like its manual counterpart.
function nestedChanges(
  before: ElementEntry[],
  after: ElementEntry[],
): string[] {
  const kindsById = (entries: ElementEntry[]) =>
    new Map(
      entries.flatMap(({ id, kind }) => (id ? [[id, kind] as const] : [])),
    );
  const kindsBefore = kindsById(before);
  const kindsAfter = kindsById(after);
  const kindChanges = [...kindsAfter].flatMap(([id, kind]) => {
    const previous = kindsBefore.get(id);
    return previous !== undefined && previous !== kind
      ? [`"${id}" changes kind from ${previous} to ${kind}`]
      : [];
  });
  const removed = [...kindsBefore.keys()].filter((id) => !kindsAfter.has(id));
  const added = [...kindsAfter.keys()].filter((id) => !kindsBefore.has(id));
  const renames =
    removed.length > 0 && added.length > 0
      ? [
          `Removed ${quoteIds(removed)} and added ${quoteIds(added)}, which may be a rename`,
        ]
      : [];
  return [...kindChanges, ...renames];
}

const describeId = (id: string | undefined) => (id ? `"${id}"` : "no id");

const idChange = (before: string | undefined, after: string | undefined) =>
  before === after
    ? []
    : [`Id changes from ${describeId(before)} to ${describeId(after)}`];

function identityChanges(params: {
  before: FormSchema;
  after: FormSchema;
  scope: JsonScope;
}): string[] {
  const { before, after, scope } = params;
  switch (scope.kind) {
    case JsonScopeKind.Element: {
      const previous = elementAt(before, scope);
      const next = elementAt(after, scope);
      const ownKind =
        previous.kind === next.kind
          ? []
          : [`Kind changes from ${previous.kind} to ${next.kind}`];
      return [
        ...idChange(previous.id, next.id),
        ...ownKind,
        ...nestedChanges(nestedEntries(previous), nestedEntries(next)),
      ];
    }
    case JsonScopeKind.Page: {
      const previous = pageAt(before, scope.pageIndex);
      const next = pageAt(after, scope.pageIndex);
      return [
        ...idChange(previous.id, next.id),
        ...nestedChanges(
          elementEntries(previous.fields),
          elementEntries(next.fields),
        ),
      ];
    }
    case JsonScopeKind.Form: {
      const formEntries = (schema: FormSchema): ElementEntry[] => [
        ...schema.pages.flatMap((page) => [
          { id: page.id, kind: "page" },
          ...elementEntries(page.fields),
        ]),
        ...schema.outputViews.flatMap((view) => [
          { id: view.id, kind: "outputView" },
          ...view.blocks.map((block) => ({
            id: block.id,
            kind: "kind" in block ? block.kind : "outputField",
          })),
        ]),
        ...(schema.aggregateViews ?? []).map((view) => ({
          id: view.id,
          kind: view.kind,
        })),
      ];
      return nestedChanges(formEntries(before), formEntries(after));
    }
    default:
      throw new Error(`unknown scope: ${scope satisfies never}`);
  }
}

async function customValidatorErrors(params: {
  before: FormSchema;
  after: FormSchema;
  draftIds: ReadonlySet<number>;
  validatorExists: (id: number) => Promise<boolean>;
}): Promise<string[]> {
  const { before, after, draftIds, validatorExists } = params;
  const known = customValidatorIds(before);
  const checks = [...customValidatorIds(after)].map(async (id) => {
    if (isDraftValidatorId(id)) {
      return draftIds.has(id)
        ? []
        : [`Custom validator ${id} is not an unsaved validator in this editor`];
    }
    if (known.has(id)) return [];
    const exists = await R.fromPromise(validatorExists(id));
    if (!exists.ok) {
      return [
        `Could not check custom validator ${id}: ${exists.error.message}`,
      ];
    }
    return exists.value ? [] : [`Custom validator ${id} could not be loaded`];
  });
  return (await Promise.all(checks)).flat();
}

export type PreparedJsonApply = {
  schema: FormSchema;
  /** Id and kind changes the admin confirms before the schema applies. */
  identityChanges: string[];
};

export async function prepareJsonApply(params: {
  schema: FormSchema;
  scope: JsonScope;
  text: string;
  displayOnly: boolean;
  draftValidatorIds: ReadonlySet<number>;
  validatorExists: (id: number) => Promise<boolean>;
}): Promise<Result<PreparedJsonApply, string[]>> {
  const { schema, scope, text, displayOnly } = params;
  const parsed = R.fromThrowable((): unknown => JSON.parse(text));
  if (!parsed.ok) return R.failure([`Invalid JSON: ${parsed.error.message}`]);

  const applied = applyValue({ schema, scope, value: parsed.value });
  if (!applied.ok) return applied;
  const next = applied.value;

  const collisions = newIdCollisions(schema, next);
  if (collisions.length > 0) return R.failure(collisions);

  if (displayOnly) {
    if (next.pages.length !== 1) {
      return R.failure(["pages: Display-only content has exactly one page"]);
    }
    const displayOnlyResult = formSchemaToDisplayOnly(next);
    if (!displayOnlyResult.ok) return displayOnlyResult;
  }

  const validatorErrors = await customValidatorErrors({
    before: schema,
    after: next,
    draftIds: params.draftValidatorIds,
    validatorExists: params.validatorExists,
  });
  if (validatorErrors.length > 0) return R.failure(validatorErrors);

  return R.success({
    schema: next,
    identityChanges: identityChanges({ before: schema, after: next, scope }),
  });
}
