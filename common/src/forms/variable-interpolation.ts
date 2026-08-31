// Supported text paths stay centralized so renderers and validation cannot
// drift and leave an accepted reference visible as a raw token.

import type { DisplayBlock, DisplayKind } from "./display-blocks";
import type {
  AnyField,
  FieldKind,
  FormSchema,
  OutputFieldBlock,
} from "./form-schema";
import { isQuestionField } from "./form-schema";
import { collectVariableReferences, interpolateVariables } from "./variables";

// HTML is excluded because `dangerouslySetInnerHTML` would turn an interpolated
// answer into markup.
const INTERPOLATED_DISPLAY_FIELDS: Record<DisplayKind, readonly string[]> = {
  header: ["text"],
  text: ["text"],
  label: ["text"],
  quote: ["text", "userName"],
  copytext: ["text", "title"],
  biglink: ["text"],
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

// Preserve referential equality when interpolation changes nothing so renderers
// retain their memoized subtrees in the common no-variables case.
function interpolateStringProps<T extends object>(
  source: T,
  props: readonly string[],
  values: ReadonlyMap<string, string>,
): T {
  let result = source;
  for (const prop of props) {
    const current: unknown = Reflect.get(result, prop);
    if (typeof current !== "string") continue;
    const next = interpolateVariables(current, values);
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

export function interpolateDisplayBlock<T extends DisplayBlock>(
  block: T,
  values: ReadonlyMap<string, string>,
): T {
  if (values.size === 0) return block;
  const result = interpolateStringProps(
    block,
    INTERPOLATED_DISPLAY_FIELDS[block.kind] ?? [],
    values,
  );
  if (result.kind === "images") {
    const images = mapPreservingIdentity(result.images, (image) =>
      interpolateStringProps(image, IMAGES_ITEM_PROPS, values),
    );
    return images === result.images ? result : { ...result, images };
  }
  if (result.kind === "accordion") {
    const sections = mapPreservingIdentity(result.sections, (section) => {
      const titled = interpolateStringProps(section, ["title"], values);
      const blocks = mapPreservingIdentity(titled.blocks, (nested) =>
        interpolateDisplayBlock(nested, values),
      );
      return blocks === titled.blocks ? titled : { ...titled, blocks };
    });
    return sections === result.sections ? result : { ...result, sections };
  }
  if (result.kind !== "chatTranscript") return result;

  const messages = mapPreservingIdentity(result.messages, (message) =>
    interpolateStringProps(message, ["text"], values),
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
  if (values.size === 0 || !FIELD_KIND_SUPPORTS_INTERPOLATION[field.kind]) {
    return field;
  }
  const result = interpolateStringProps(
    field,
    INTERPOLATED_FIELD_PROPS,
    values,
  );

  if (hasOptionLabels(result)) {
    const options = mapPreservingIdentity(result.options, (option) =>
      interpolateStringProps(option, ["label"], values),
    );
    return options === result.options ? result : { ...result, options };
  }

  if (result.kind !== "list") return result;

  const fields = mapPreservingIdentity(result.fields, (sub) =>
    interpolateFieldText(sub, values),
  );
  return fields === result.fields ? result : { ...result, fields };
}

export function interpolateOutputFieldBlock<T extends OutputFieldBlock>(
  block: T,
  values: ReadonlyMap<string, string>,
): T {
  if (values.size === 0) return block;
  return interpolateStringProps(block, INTERPOLATED_OUTPUT_FIELD_PROPS, values);
}

export function forEachInterpolatableText(
  schema: FormSchema,
  visit: (text: string, location: string) => void,
): void {
  const visitProps = (
    source: object,
    props: readonly string[],
    location: string,
  ): void => {
    for (const prop of props) {
      const value: unknown = Reflect.get(source, prop);
      if (typeof value === "string") visit(value, `${location}.${prop}`);
    }
  };

  const visitElement = (element: AnyField | DisplayBlock): void => {
    const location = element.id ?? `<${element.kind}>`;
    if (isQuestionField(element)) {
      visitProps(element, INTERPOLATED_FIELD_PROPS, location);
      if (hasOptionLabels(element)) {
        element.options.forEach((option, index) =>
          visit(option.label, `${location}.options[${index}].label`),
        );
      }
      if (element.kind === "list") {
        for (const sub of element.fields ?? []) visitElement(sub);
      }
      return;
    }
    visitProps(
      element,
      INTERPOLATED_DISPLAY_FIELDS[element.kind] ?? [],
      location,
    );
    if (element.kind === "images") {
      element.images.forEach((image, index) =>
        visitProps(image, IMAGES_ITEM_PROPS, `${location}.images[${index}]`),
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
        for (const nested of section.blocks) visitElement(nested);
      });
    }
  };

  for (const page of schema.pages ?? []) {
    for (const element of page.fields ?? []) visitElement(element);
  }
  for (const view of schema.outputViews ?? []) {
    for (const block of view.blocks ?? []) {
      if ("fieldId" in block) {
        visitProps(
          block,
          INTERPOLATED_OUTPUT_FIELD_PROPS,
          block.id ?? "<output>",
        );
        continue;
      }
      visitElement(block);
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
