import {
  displayBlockSchema,
  type DisplayBlock,
} from "@alliance/common/forms/display-blocks";
import {
  anyFieldSchema,
  fieldHasOptions,
  type AnyField,
} from "@alliance/common/forms/form-schema";
import { z } from "zod";
import { escapeXml, tag } from "./xml";

const storedSchemaShape = z.looseObject({
  pages: z
    .array(
      z.looseObject({
        title: z.string().optional(),
        description: z.string().optional(),
        fields: z.array(z.unknown()).optional(),
      }),
    )
    .optional(),
});

type SchemaElement =
  | { type: "question"; field: AnyField }
  | { type: "display"; block: DisplayBlock };

type ParsedPage = {
  title?: string;
  description?: string;
  elements: SchemaElement[];
};

// An element written before its kind was renamed costs one element rather than
// the whole snapshot, so a stale block can't blank out a page of context.
const parseElement = (raw: unknown): SchemaElement | null => {
  const field = anyFieldSchema.safeParse(raw);
  if (field.success) return { type: "question", field: field.data };
  const display = displayBlockSchema.safeParse(raw);
  if (display.success) return { type: "display", block: display.data };
  return null;
};

export const parseStoredSchema = (schema: unknown): ParsedPage[] => {
  const parsed = storedSchemaShape.safeParse(schema);
  if (!parsed.success) return [];
  return (parsed.data.pages ?? []).map((page) => ({
    title: page.title,
    description: page.description,
    elements: (page.fields ?? [])
      .map(parseElement)
      .filter((element): element is SchemaElement => element !== null),
  }));
};

export const questionFieldsOf = (pages: ParsedPage[]): AnyField[] => {
  const fields: AnyField[] = [];
  const seen = new Set<string>();
  const push = (field: AnyField) => {
    if (seen.has(field.id)) return;
    seen.add(field.id);
    fields.push(field);
  };
  for (const page of pages) {
    for (const element of page.elements) {
      if (element.type === "question") push(element.field);
    }
  }
  return fields;
};

const renderDisplay = (block: DisplayBlock): string | null => {
  switch (block.kind) {
    case "header":
      return tag(
        "display",
        [
          ["kind", "header"],
          ["level", block.level],
        ],
        escapeXml(block.text),
      );
    case "text":
    case "label":
      return tag("display", [["kind", block.kind]], escapeXml(block.text));
    case "quote":
      return tag(
        "display",
        [
          ["kind", "quote"],
          ["attribution", block.userName],
        ],
        escapeXml(block.text),
      );
    case "html":
      return tag("display", [["kind", "html"]], escapeXml(block.html));
    case "images":
      return tag(
        "display",
        [["kind", "images"]],
        block.images
          .map((image) =>
            tag(
              "item",
              [
                ["src", image.src],
                ["alt", image.alt],
              ],
              escapeXml(image.caption ?? ""),
            ),
          )
          .join(""),
      );
    case "video":
      return tag(
        "display",
        [
          ["kind", "video"],
          ["src", block.src],
        ],
        escapeXml(block.caption ?? ""),
      );
    case "biglink":
      return tag(
        "display",
        [
          ["kind", "biglink"],
          ["url", block.url],
        ],
        escapeXml(block.text),
      );
    case "copytext":
      return tag(
        "display",
        [
          ["kind", "copytext"],
          ["title", block.title],
          ["format", block.format],
        ],
        escapeXml(block.text),
      );
    case "accordion":
      return tag(
        "display",
        [["kind", "accordion"]],
        block.sections
          .map((section) =>
            tag(
              "section",
              [["title", section.title]],
              section.blocks
                .map((nested) => renderDisplay(nested))
                .filter((rendered): rendered is string => rendered !== null)
                .join(""),
            ),
          )
          .join(""),
      );
    case "chatTranscript":
      return tag(
        "display",
        [["kind", "chatTranscript"]],
        block.messages
          .map((message) =>
            tag(
              "message",
              [
                ["side", message.side],
                [
                  "name",
                  message.side === "left" ? block.leftName : block.rightName,
                ],
              ],
              escapeXml(message.text),
            ),
          )
          .join(""),
      );
    case "previousAnswer":
      return tag(
        "display",
        [
          ["kind", "previousAnswer"],
          ["source-form-id", block.sourceFormId],
          ["source-field-id", block.sourceFieldId],
        ],
        escapeXml(block.title ?? ""),
      );
    case "userLocation":
      return tag(
        "display",
        [["kind", "userLocation"]],
        escapeXml(block.title ?? ""),
      );
    case "divider":
    case "spacer":
      return null;
    default:
      throw new Error(`unknown display kind: ${block satisfies never}`);
  }
};

const renderQuestion = (field: AnyField): string => {
  const parts: string[] = [];
  if (field.label) parts.push(tag("label", [], escapeXml(field.label)));
  if (field.description) {
    parts.push(tag("description", [], escapeXml(field.description)));
  }
  if (fieldHasOptions(field)) {
    for (const option of field.options) {
      parts.push(
        tag("option", [["value", option.value]], escapeXml(option.label)),
      );
    }
  }
  if (field.kind === "list") {
    for (const sub of field.fields) {
      parts.push(
        tag(
          "sub-field",
          [
            ["id", sub.id],
            ["kind", sub.kind],
          ],
          escapeXml(sub.label ?? ""),
        ),
      );
    }
  }
  return tag(
    "question",
    [
      ["id", field.id],
      ["kind", field.kind],
      ["required", field.required ? "true" : undefined],
      ["visible-if", field.visibleIfFormula ? "true" : undefined],
    ],
    parts.join(""),
  );
};

const renderSchemaElement = (element: SchemaElement): string | null => {
  switch (element.type) {
    case "question":
      return renderQuestion(element.field);
    case "display":
      return renderDisplay(element.block);
    default:
      throw new Error(`unknown schema element: ${element satisfies never}`);
  }
};

export const renderSchema = (pages: ParsedPage[]): string =>
  tag(
    "schema",
    [],
    pages
      .map((page, index) =>
        tag(
          "page",
          [
            ["index", index + 1],
            ["title", page.title],
          ],
          (page.description
            ? tag("description", [], escapeXml(page.description))
            : "") +
            page.elements
              .map(renderSchemaElement)
              .filter((rendered): rendered is string => rendered !== null)
              .join(""),
        ),
      )
      .join(""),
  );
