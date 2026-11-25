import {
  CopyTextFormat,
  type DisplayBlock,
  type DisplayKind,
  type NestedDisplayBlock,
} from "@alliance/common/forms/display-blocks";
import {
  type AnyField,
  type FormSchema,
  isDisplayBlock,
  type ListSubField,
  type OutputFieldBlock,
} from "@alliance/common/forms/form-schema";
import {
  rowPlaceholderPattern,
  rowValueText,
} from "@alliance/common/forms/row-list";
import { resolveDisplayBlockForUser } from "@alliance/shared/formrenderer";
import { linkDestinations, stringsIn } from "./useContentConfirm";

type LinkedFields = {
  [K in DisplayKind]: readonly (keyof Extract<DisplayBlock, { kind: K }>)[];
};
const LINKED_DISPLAY_FIELDS: LinkedFields = {
  header: [],
  text: ["text"],
  quote: ["text"],
  label: [],
  divider: [],
  spacer: [],
  html: [],
  images: [],
  video: [],
  // Its url is a whole link destination, checked apart.
  biglink: [],
  copytext: ["text"],
  previousAnswer: [],
  userLocation: [],
  chatTranscript: ["messages"],
  accordion: [],
};
const LINKED_COPY_TEXT: Record<CopyTextFormat, boolean> = {
  [CopyTextFormat.Plain]: false,
  [CopyTextFormat.Markdown]: true,
};
const blocksIn = (
  block: DisplayBlock | NestedDisplayBlock,
): (DisplayBlock | NestedDisplayBlock)[] =>
  block.kind === "accordion"
    ? block.sections.flatMap(({ blocks }) => blocks.flatMap(blocksIn))
    : [block];

const linkedDisplayText = (
  block: DisplayBlock | NestedDisplayBlock,
): unknown[] => {
  if (
    block.kind === "copytext" &&
    !LINKED_COPY_TEXT[block.format ?? CopyTextFormat.Plain]
  ) {
    return [];
  }
  const keys: readonly string[] = LINKED_DISPLAY_FIELDS[block.kind];
  return Object.entries(block).flatMap(([key, item]) =>
    keys.includes(key) ? [item] : [],
  );
};

const withMemberContent = (block: DisplayBlock): DisplayBlock[] => [
  block,
  ...Object.keys(block.manualUserContent ?? {}).map((member) =>
    resolveDisplayBlockForUser(block, member),
  ),
];

const linkedFieldText = (field: AnyField | ListSubField): unknown[] => {
  switch (field.kind) {
    case "text":
    case "textarea":
    case "email":
    case "phone":
    case "number":
    case "range":
    case "checkbox":
    case "select":
    case "date":
    case "time":
    case "timezone":
    case "city":
    case "file":
    case "image":
    case "toggle":
    case "timePicker":
    // Its options are checked apart, since the mobile app links a bare url in
    // them.
    case "ranking":
      return [field.label];
    case "radio":
    case "multiselect":
      return [field.label, field.options.map(({ label }) => label)];
    case "conversation":
      return [
        field.label,
        field.message,
        field.options.map(({ label, reply }) => [label, reply ?? ""]),
      ];
    case "list":
      return [field.label, field.fields.map(linkedFieldText)];
    // A contract field shows the contract, edited on the contracts page, in
    // place of its label; a custom component shows its label as plain text.
    case "contract":
    case "custom":
      return [];
    default:
      throw new Error(`unknown field kind: ${field satisfies never}`);
  }
};

// An output view field renders as its page field does, the override in place
// of its label.
const outputField = (
  { fieldId, showLabel, format = "field", labelOverride }: OutputFieldBlock,
  fields: AnyField[],
): AnyField[] => {
  const field = fields.find(({ id }) => id === fieldId);
  return field && format === "field"
    ? [{ ...field, label: showLabel ? (labelOverride ?? null) : null }]
    : [];
};

// A stand-in url in place of each row placeholder shows, once parsed, which
// columns start a link's destination; its closing slash keeps text after the
// placeholder out of the column name.
const ROW_URL = /^https:\/\/row\.invalid\/(\w+)\//;
const withRowUrls = (texts: string[]): string[] =>
  texts.map((text) =>
    text.replace(rowPlaceholderPattern(), "https://row.invalid/$1/"),
  );

/**
 * The strings of `schema` the member apps render as markdown, `siteLinksIn`
 * where the mobile app also links a bare url and `siteLinksInCommonMark` where
 * neither app does, and those they open as a link, a row list value included,
 * as a whole url, where its `#{row.<column>}` starts a link's destination.
 */
export const linkCheckedText = (
  schema: FormSchema,
): {
  siteLinksIn: string[];
  siteLinksInCommonMark: string[];
  siteUrlsIn: string[];
} => {
  const items = schema.pages.flatMap(({ fields }) => fields);
  const fields = items.flatMap((item) => (isDisplayBlock(item) ? [] : [item]));
  const outputItems = schema.outputViews.flatMap(({ blocks }) => blocks);
  const blocks = [
    ...items.filter(isDisplayBlock).flatMap(withMemberContent),
    ...outputItems.flatMap((block) => ("fieldId" in block ? [] : [block])),
  ].flatMap(blocksIn);
  const shownFields = [
    ...fields,
    ...outputItems.flatMap((block) =>
      "fieldId" in block ? outputField(block, fields) : [],
    ),
  ];
  // The mobile app renders copy text, labels and choice options other than a
  // ranking's with a parser that leaves a bare url as text.
  const siteLinksIn = stringsIn([
    blocks.filter((block) => block.kind !== "copytext").map(linkedDisplayText),
    shownFields.map((field) =>
      field.kind === "ranking" ? field.options.map(({ label }) => label) : [],
    ),
  ]);
  const siteLinksInCommonMark = stringsIn([
    blocks.filter((block) => block.kind === "copytext").map(linkedDisplayText),
    shownFields.map(linkedFieldText),
  ]);
  const urls = blocks.flatMap((block) =>
    block.kind === "biglink" ? [block.url] : [],
  );
  const columns = new Set(
    [
      ...withRowUrls(urls),
      ...linkDestinations(withRowUrls(siteLinksIn), { bareUrls: true }),
      ...linkDestinations(withRowUrls(siteLinksInCommonMark), {
        bareUrls: false,
      }),
    ].flatMap((url) => url.match(ROW_URL)?.[1] ?? []),
  );
  const rowUrls = (schema.rowList?.rows ?? []).flatMap((row) =>
    [...columns].map((column) => rowValueText(row[column])),
  );
  return {
    siteLinksIn,
    siteLinksInCommonMark,
    siteUrlsIn: [...urls, ...rowUrls],
  };
};
