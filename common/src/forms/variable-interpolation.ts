// Supported text paths stay centralized so renderers and validation cannot
// drift and leave an accepted reference visible as a raw token.

import type { DisplayBlock, DisplayKind } from "./display-blocks";
import {
  collectFieldLookup,
  isQuestionField,
  type AnyField,
  type FieldKind,
  type FormSchema,
  type OutputFieldBlock,
  type PageItem,
} from "./form-schema";
import {
  collectVariableReferences,
  interpolateVariables,
  readsSourceForm,
} from "./variables";

// HTML is excluded because `dangerouslySetInnerHTML` would turn an interpolated
// answer into markup.
const INTERPOLATED_DISPLAY_FIELDS: Record<DisplayKind, readonly string[]> = {
  header: ["text"],
  text: ["text"],
  label: ["text"],
  quote: ["text", "userName"],
  copytext: ["text", "title"],
  biglink: ["text", "body"],
  images: [],
  video: ["caption"],
  chatTranscript: ["leftName", "rightName"],
  previousAnswer: ["title", "emptyText"],
  userLocation: ["title", "emptyText"],
  divider: [],
  spacer: [],
  html: [],
  accordion: [],
};

const IMAGES_ITEM_PROPS = ["alt", "caption"] as const;

const INTERPOLATED_FIELD_PROPS = [
  "label",
  "description",
  "placeholder",
] as const;

const INTERPOLATED_OUTPUT_FIELD_PROPS = ["labelOverride"] as const;

type FieldWithOptions = Extract<AnyField, { options: unknown }>;

const FIELD_KIND_HAS_OPTION_LABELS: Record<FieldKind, boolean> = {
  radio: true,
  select: true,
  multiselect: true,
  ranking: true,
  text: false,
  textarea: false,
  email: false,
  phone: false,
  number: false,
  range: false,
  checkbox: false,
  date: false,
  time: false,
  timezone: false,
  city: false,
  file: false,
  contract: false,
  custom: false,
  list: false,
};

function hasOptionLabels(field: AnyField): field is FieldWithOptions {
  return FIELD_KIND_HAS_OPTION_LABELS[field.kind];
}

const FIELD_KIND_SUPPORTS_INTERPOLATION: Record<FieldKind, boolean> = {
  text: true,
  textarea: true,
  email: true,
  phone: true,
  number: true,
  range: true,
  checkbox: true,
  radio: true,
  select: true,
  multiselect: true,
  date: true,
  time: true,
  timezone: true,
  city: true,
  file: true,
  contract: true,
  custom: true,
  list: true,
  ranking: true,
};

export type TextRewrite = (text: string) => string;

export type InterpolatedPaths = {
  displayFields: Record<DisplayKind, readonly string[]>;
  fieldProps: readonly string[];
};

export const VARIABLE_TEXT_PATHS: InterpolatedPaths = {
  displayFields: INTERPOLATED_DISPLAY_FIELDS,
  fieldProps: INTERPOLATED_FIELD_PROPS,
};

// Preserve referential equality when interpolation changes nothing so renderers
// retain their memoized subtrees in the common no-variables case.
function interpolateStringProps<T extends object>(
  source: T,
  props: readonly string[],
  rewrite: TextRewrite,
): T {
  let result = source;
  for (const prop of props) {
    const current: unknown = Reflect.get(result, prop);
    if (typeof current !== "string") continue;
    const next = rewrite(current);
    if (next === current) continue;
    if (result === source) result = { ...source };
    Reflect.set(result, prop, next);
  }
  return result;
}

function mapPreservingIdentity<T>(items: T[], map: (item: T) => T): T[] {
  const next = items.map(map);
  return next.every((item, index) => item === items[index]) ? items : next;
}

const variableRewrite =
  (values: ReadonlyMap<string, string>): TextRewrite =>
  (text) =>
    interpolateVariables(text, values);

export function interpolateDisplayBlock<T extends DisplayBlock>(
  block: T,
  values: ReadonlyMap<string, string>,
): T {
  if (values.size === 0) return block;
  return rewriteDisplayBlock(
    block,
    variableRewrite(values),
    VARIABLE_TEXT_PATHS,
  );
}

export function rewriteDisplayBlock<T extends DisplayBlock>(
  block: T,
  rewrite: TextRewrite,
  paths: InterpolatedPaths,
): T {
  const result = interpolateStringProps(
    block,
    paths.displayFields[block.kind] ?? [],
    rewrite,
  );
  if (result.kind === "images") {
    const images = mapPreservingIdentity(result.images, (image) =>
      interpolateStringProps(image, IMAGES_ITEM_PROPS, rewrite),
    );
    return images === result.images ? result : { ...result, images };
  }
  if (result.kind === "accordion") {
    const sections = mapPreservingIdentity(result.sections, (section) => {
      const titled = interpolateStringProps(section, ["title"], rewrite);
      const blocks = mapPreservingIdentity(titled.blocks, (nested) =>
        rewriteDisplayBlock(nested, rewrite, paths),
      );
      return blocks === titled.blocks ? titled : { ...titled, blocks };
    });
    return sections === result.sections ? result : { ...result, sections };
  }
  if (result.kind !== "chatTranscript") return result;

  const messages = mapPreservingIdentity(result.messages, (message) =>
    interpolateStringProps(message, ["text"], rewrite),
  );
  return messages === result.messages ? result : { ...result, messages };
}

/**
 * Rewrites a field's option labels and a list's sub-field text too: both are
 * rendered from arrays hanging off the field, so a shallow pass would leave
 * `#{name}` visible to the respondent. No kind has both.
 */
export function interpolateFieldText<T extends AnyField>(
  field: T,
  values: ReadonlyMap<string, string>,
): T {
  if (values.size === 0) return field;
  return rewriteFieldText(field, variableRewrite(values), VARIABLE_TEXT_PATHS);
}

export function rewriteFieldText<T extends AnyField>(
  field: T,
  rewrite: TextRewrite,
  paths: InterpolatedPaths,
): T {
  if (!FIELD_KIND_SUPPORTS_INTERPOLATION[field.kind]) return field;
  const result = interpolateStringProps(field, paths.fieldProps, rewrite);

  if (hasOptionLabels(result)) {
    const options = mapPreservingIdentity(result.options, (option) =>
      interpolateStringProps(option, ["label"], rewrite),
    );
    return options === result.options ? result : { ...result, options };
  }

  if (result.kind !== "list") return result;

  const fields = mapPreservingIdentity(result.fields, (sub) =>
    rewriteFieldText(sub, rewrite, paths),
  );
  return fields === result.fields ? result : { ...result, fields };
}

export function interpolateOutputFieldBlock<T extends OutputFieldBlock>(
  block: T,
  values: ReadonlyMap<string, string>,
): T {
  if (values.size === 0) return block;
  return rewriteOutputFieldBlock(block, variableRewrite(values));
}

export function rewriteOutputFieldBlock<T extends OutputFieldBlock>(
  block: T,
  rewrite: TextRewrite,
): T {
  return interpolateStringProps(
    block,
    INTERPOLATED_OUTPUT_FIELD_PROPS,
    rewrite,
  );
}

type TextVisitor = (text: string, location: string) => void;

function visitProps(
  source: object,
  props: readonly string[],
  location: string,
  visit: TextVisitor,
): void {
  for (const prop of props) {
    const value: unknown = Reflect.get(source, prop);
    if (typeof value === "string") visit(value, `${location}.${prop}`);
  }
}

function visitElementText(
  element: PageItem,
  visit: TextVisitor,
  paths: InterpolatedPaths,
): void {
  const location = element.id ?? `<${element.kind}>`;
  if (isQuestionField(element)) {
    visitProps(element, paths.fieldProps, location, visit);
    if (hasOptionLabels(element)) {
      element.options.forEach((option, index) =>
        visit(option.label, `${location}.options[${index}].label`),
      );
    }
    if (element.kind === "list") {
      for (const sub of element.fields ?? []) {
        visitElementText(sub, visit, paths);
      }
    }
    return;
  }
  visitProps(element, paths.displayFields[element.kind] ?? [], location, visit);
  if (element.kind === "images") {
    element.images.forEach((image, index) =>
      visitProps(
        image,
        IMAGES_ITEM_PROPS,
        `${location}.images[${index}]`,
        visit,
      ),
    );
  }
  if (element.kind === "chatTranscript") {
    element.messages.forEach((message, index) =>
      visit(message.text, `${location}.messages[${index}].text`),
    );
  }
  if (element.kind === "accordion") {
    element.sections.forEach((section, index) => {
      visit(section.title, `${location}.sections[${index}].title`);
      for (const nested of section.blocks) {
        visitElementText(nested, visit, paths);
      }
    });
  }
}

function visitOutputFieldBlock(block: OutputFieldBlock, visit: TextVisitor) {
  visitProps(
    block,
    INTERPOLATED_OUTPUT_FIELD_PROPS,
    block.id ?? "<output>",
    visit,
  );
}

export function forEachInterpolatableText(
  schema: FormSchema,
  visit: TextVisitor,
  paths: InterpolatedPaths = VARIABLE_TEXT_PATHS,
): void {
  for (const page of schema.pages ?? []) {
    for (const element of page.fields ?? []) {
      visitElementText(element, visit, paths);
    }
  }
  for (const view of schema.outputViews ?? []) {
    for (const block of view.blocks ?? []) {
      if ("fieldId" in block) visitOutputFieldBlock(block, visit);
      else visitElementText(block, visit, paths);
    }
  }
}

/**
 * Every text an output view renders, including the question text its field
 * blocks reuse.
 */
function forEachSharedOutputText(
  schema: FormSchema,
  visit: (text: string, location: string, viewId: string) => void,
): void {
  const fields = collectFieldLookup(schema.pages ?? []);
  for (const view of schema.outputViews ?? []) {
    const visitInView: TextVisitor = (text, location) =>
      visit(text, location, view.id);
    for (const block of view.blocks ?? []) {
      if (!("fieldId" in block)) {
        visitElementText(block, visitInView, VARIABLE_TEXT_PATHS);
        continue;
      }
      visitOutputFieldBlock(block, visitInView);
      const field = fields.get(block.fieldId);
      if (field) visitElementText(field, visitInView, VARIABLE_TEXT_PATHS);
    }
  }
}

export type UnresolvedVariableReference = {
  name: string;
  locations: string[];
};

/**
 * References matching no declared variable, which render as the literal
 * `#{name}`. Deliberately not a schema validation error: renaming a variable
 * dangles every reference to it at once, and refusing the save would trap the
 * admin mid-edit. The builder warns before saving instead.
 */
export function collectUnresolvedVariableReferences(
  schema: FormSchema,
): UnresolvedVariableReference[] {
  const declared = new Set((schema.variables ?? []).map(({ name }) => name));
  const found = new Map<string, string[]>();

  forEachInterpolatableText(schema, (text, location) => {
    for (const name of collectVariableReferences(text)) {
      if (declared.has(name)) continue;
      const locations = found.get(name);
      if (locations) locations.push(location);
      else found.set(name, [location]);
    }
  });

  return [...found].map(([name, locations]) => ({ name, locations }));
}

/**
 * References to variables that read submitted answers from text an output
 * view renders. Shared output never loads those answers, so each would show as
 * its raw `#{name}`.
 */
export function sourceVariablesInSharedOutput(
  schema: FormSchema,
): { name: string; location: string; viewId: string }[] {
  const readingSources = new Set(
    (schema.variables ?? []).filter(readsSourceForm).map(({ name }) => name),
  );
  const found: { name: string; location: string; viewId: string }[] = [];
  if (readingSources.size === 0) return found;
  forEachSharedOutputText(schema, (text, location, viewId) => {
    for (const name of collectVariableReferences(text)) {
      if (readingSources.has(name)) found.push({ name, location, viewId });
    }
  });
  return found;
}
