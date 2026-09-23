/* eslint-disable max-lines -- TODO: legacy file over the 500-line limit; split it up */
import { formatCityValue, parseCityValue } from "@alliance/common/forms/city";
import {
  displayBlockSchema,
  type DisplayBlock,
} from "@alliance/common/forms/display-blocks";
import {
  anyFieldSchema,
  fieldGroupSchema,
  fieldHasOptions,
  type AnyField,
  type FieldGroup,
} from "@alliance/common/forms/form-schema";
import type {
  ActionWithdrawalDto,
  FormResponseDto,
  ProfileDto,
} from "@alliance/shared/client";
import { z } from "zod";
import { respondentName } from "./respondent";

type ExportForm = {
  id: number;
  title: string;
  formSnapshotId: number;
  schema: unknown;
};

type ExportVariant = { formId: number; name: string };

export type BuildResponsesHtmlParams = {
  title: string;
  form: ExportForm;
  responses: FormResponseDto[];
  withdrawnUserMap: Map<number, ActionWithdrawalDto>;
  sidsToUserMap: Record<string, ProfileDto>;
  variantOptions?: ExportVariant[];
  exportedAt: string;
  csvFileName: string;
};

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

type Attr = readonly [string, string | number | undefined | null];

const attrs = (pairs: Attr[]): string =>
  pairs
    .filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    )
    .map(([name, value]) => ` ${name}="${escapeXml(String(value))}"`)
    .join("");

const tag = (name: string, pairs: Attr[], inner: string): string =>
  `<${name}${attrs(pairs)}>${inner}</${name}>`;

const stringify = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value) ?? "";
};

const isEmptyAnswer = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
};

const recordSchema = z.record(z.string(), z.unknown());

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
  | { type: "group"; group: FieldGroup }
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
  const group = fieldGroupSchema.safeParse(raw);
  if (group.success) return { type: "group", group: group.data };
  const display = displayBlockSchema.safeParse(raw);
  if (display.success) return { type: "display", block: display.data };
  return null;
};

const parseStoredSchema = (schema: unknown): ParsedPage[] => {
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

const questionFieldsOf = (pages: ParsedPage[]): AnyField[] => {
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
      if (element.type === "group") {
        for (const child of element.group.fields) {
          if (child.type === "input") push(child);
        }
      }
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
    case "group":
      return tag(
        "group",
        [
          ["id", element.group.id],
          ["label", element.group.label],
        ],
        element.group.fields
          .map((child) =>
            child.type === "input"
              ? renderQuestion(child)
              : renderDisplay(child),
          )
          .filter((rendered): rendered is string => rendered !== null)
          .join(""),
      );
    default:
      throw new Error(`unknown schema element: ${element satisfies never}`);
  }
};

const renderSchema = (pages: ParsedPage[]): string =>
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

const headingOf = (field: AnyField): string =>
  field.label?.trim() ? field.label.trim() : field.id;

const optionLabel = (field: AnyField, value: string): string => {
  if (!fieldHasOptions(field)) return value;
  return field.options.find((option) => option.value === value)?.label ?? value;
};

const selectionsOf = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(stringify);
  const single = stringify(value);
  return single === "" ? [] : [single];
};

const renderPretty = (field: AnyField, value: unknown): string => {
  switch (field.kind) {
    case "radio":
    case "select":
    case "checkbox":
      return escapeXml(optionLabel(field, stringify(value)));
    case "multiselect":
      return selectionsOf(value)
        .map((selection) =>
          tag("item", [], escapeXml(optionLabel(field, selection))),
        )
        .join("");
    case "ranking":
      return selectionsOf(value)
        .map((selection, index) =>
          tag(
            "item",
            [["rank", index + 1]],
            escapeXml(optionLabel(field, selection)),
          ),
        )
        .join("");
    case "city": {
      const city = parseCityValue(value);
      return escapeXml(city ? formatCityValue(city) : stringify(value));
    }
    case "list": {
      const rows = z.array(z.unknown()).safeParse(value);
      if (!rows.success) return escapeXml(stringify(value));
      const subById = new Map(field.fields.map((sub) => [sub.id, sub]));
      return rows.data
        .map((row, index) => {
          const record = recordSchema.safeParse(row);
          if (!record.success) {
            return tag(
              "item",
              [["index", index + 1]],
              escapeXml(stringify(row)),
            );
          }
          const cells = Object.entries(record.data).map(([key, cell]) => {
            const sub = subById.get(key);
            return tag(
              "sub",
              [
                ["field", key],
                ["label", sub ? headingOf(sub) : key],
              ],
              sub ? renderPretty(sub, cell) : escapeXml(stringify(cell)),
            );
          });
          return tag("item", [["index", index + 1]], cells.join(""));
        })
        .join("");
    }
    case "text":
    case "textarea":
    case "email":
    case "phone":
    case "number":
    case "range":
    case "date":
    case "time":
    case "timezone":
    case "contract":
    case "file":
    case "custom":
      return escapeXml(stringify(value));
    default:
      throw new Error(`unknown field kind: ${field satisfies never}`);
  }
};

const renderAnswer = (field: AnyField, value: unknown): string => {
  const heading = headingOf(field);
  const headings =
    tag("field-id", [], escapeXml(field.id)) +
    tag("field-label", [], escapeXml(heading));
  if (isEmptyAnswer(value)) {
    return tag(
      "answer",
      [
        ["field", field.id],
        ["kind", field.kind],
        ["label", heading],
        ["unanswered", "true"],
      ],
      headings,
    );
  }
  return tag(
    "answer",
    [
      ["field", field.id],
      ["kind", field.kind],
      ["label", heading],
    ],
    headings +
      tag("raw", [], escapeXml(stringify(value))) +
      tag("pretty", [], renderPretty(field, value)),
  );
};

const renderOrphanAnswer = (fieldId: string, value: unknown): string =>
  tag(
    "answer",
    [
      ["field", fieldId],
      ["label", fieldId],
      ["orphan", "true"],
    ],
    tag("field-id", [], escapeXml(fieldId)) +
      tag("field-label", [], escapeXml(fieldId)) +
      tag("raw", [], escapeXml(stringify(value))) +
      tag("pretty", [], escapeXml(stringify(value))),
  );

const withdrawalReason = (withdrawal: ActionWithdrawalDto): string =>
  [
    withdrawal.outOfTime ? "out of time" : null,
    withdrawal.isMoral ? "moral objection" : null,
    withdrawal.declineReason ?? null,
  ]
    .filter((part): part is string => Boolean(part))
    .join("; ");

const renderRespondent = (params: {
  response: FormResponseDto;
  withdrawnUserMap: Map<number, ActionWithdrawalDto>;
  sidsToUserMap: Record<string, ProfileDto>;
}): string => {
  const { response, withdrawnUserMap, sidsToUserMap } = params;
  const user = response.user;
  const name = user?.name?.trim();
  const text =
    user && name
      ? `${name} <${user.email}>`
      : respondentName({ response, sidsToUserMap });
  const withdrawal =
    user?.id != null ? withdrawnUserMap.get(user.id) : undefined;
  return tag(
    "respondent",
    [
      ["user-id", user?.id],
      ["sid", response.sid],
      ["withdrawn", withdrawal ? "true" : "false"],
      ["withdrawal-reason", withdrawal ? withdrawalReason(withdrawal) : null],
    ],
    escapeXml(text),
  );
};

const renderResponse = (params: {
  response: FormResponseDto;
  fields: AnyField[];
  withdrawnUserMap: Map<number, ActionWithdrawalDto>;
  sidsToUserMap: Record<string, ProfileDto>;
}): string => {
  const { response, fields, withdrawnUserMap, sidsToUserMap } = params;
  const answers = response.answers ?? {};
  const declared = new Set(fields.map((field) => field.id));
  const orphans = Object.entries(answers).filter(
    ([fieldId]) => !declared.has(fieldId),
  );
  return tag(
    "response",
    [
      ["id", response.id],
      ["submitted-at", response.createdAt],
      ["device", response.deviceType],
    ],
    renderRespondent({ response, withdrawnUserMap, sidsToUserMap }) +
      fields.map((field) => renderAnswer(field, answers[field.id])).join("") +
      orphans
        .map(([fieldId, value]) => renderOrphanAnswer(fieldId, value))
        .join(""),
  );
};

type SnapshotGroup = {
  snapshotId: number;
  schema: unknown;
  current: boolean;
  firstAt: number;
  responses: FormResponseDto[];
};

const submittedAt = (response: FormResponseDto): number =>
  new Date(response.createdAt).getTime();

const groupSnapshots = (params: {
  responses: FormResponseDto[];
  currentSchema: unknown;
  currentSnapshotId: number | null;
}): SnapshotGroup[] => {
  const { responses, currentSchema, currentSnapshotId } = params;
  const groups = new Map<number, SnapshotGroup>();
  for (const response of responses) {
    const existing = groups.get(response.formSnapshotId);
    if (existing) {
      existing.responses.push(response);
      continue;
    }
    groups.set(response.formSnapshotId, {
      snapshotId: response.formSnapshotId,
      schema: response.schemaSnapshot,
      current: response.formSnapshotId === currentSnapshotId,
      firstAt: submittedAt(response),
      responses: [response],
    });
  }
  const ordered = [...groups.values()];
  for (const group of ordered) {
    group.responses.sort((a, b) => submittedAt(a) - submittedAt(b));
    group.firstAt = Math.min(...group.responses.map(submittedAt));
  }
  ordered.sort((a, b) => a.firstAt - b.firstAt);
  if (currentSnapshotId !== null && !groups.has(currentSnapshotId)) {
    ordered.push({
      snapshotId: currentSnapshotId,
      schema: currentSchema,
      current: true,
      firstAt: Number.POSITIVE_INFINITY,
      responses: [],
    });
  }
  return ordered;
};

const renderSnapshot = (params: {
  group: SnapshotGroup;
  withdrawnUserMap: Map<number, ActionWithdrawalDto>;
  sidsToUserMap: Record<string, ProfileDto>;
}): string => {
  const { group, withdrawnUserMap, sidsToUserMap } = params;
  const pages = parseStoredSchema(group.schema);
  const fields = questionFieldsOf(pages);
  return tag(
    "snapshot",
    [
      ["id", group.snapshotId],
      ["current", group.current ? "true" : "false"],
      ["response-count", group.responses.length],
    ],
    renderSchema(pages) +
      tag(
        "responses",
        [],
        group.responses
          .map((response) =>
            renderResponse({
              response,
              fields,
              withdrawnUserMap,
              sidsToUserMap,
            }),
          )
          .join(""),
      ),
  );
};

const STYLES = `
* { box-sizing: border-box; }
body {
  margin: 0;
  background: #f4f4f2;
  color: #1c1c1c;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 15px;
  line-height: 1.6;
}
toolbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  background: #ffffff;
  border-bottom: 1px solid #d7d7d3;
}
toolbar .name { font-weight: 600; margin-right: auto; }
toolbar button {
  font: inherit;
  font-size: 13px;
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid #c9c9c4;
  background: #ffffff;
  color: #1c1c1c;
  cursor: pointer;
}
toolbar button:hover { background: #f1f1ee; }
toolbar button.primary { background: #1c1c1c; color: #ffffff; border-color: #1c1c1c; }
toolbar button.primary:hover { background: #333333; }

form-export { display: block; max-width: 62rem; margin: 0 auto; padding: 24px; }

export-meta {
  display: block;
  margin-bottom: 24px;
  padding: 12px 16px;
  background: #ffffff;
  border: 1px solid #e2e2de;
  border-radius: 8px;
  font-size: 13px;
  color: #555555;
}
export-meta > * { display: block; }
exported-at::before { content: "exported at "; color: #999999; }
response-count::before { content: "responses "; color: #999999; }
snapshot-count::before { content: "snapshots "; color: #999999; }
first-response-at::before { content: "first response "; color: #999999; }
last-response-at::before { content: "last response "; color: #999999; }

variant { display: block; margin-bottom: 32px; }
variant::before {
  content: "variant " attr(name) " (form " attr(form-id) ")";
  display: block;
  padding: 6px 0;
  font-size: 18px;
  font-weight: 700;
}

snapshot {
  display: block;
  margin-bottom: 28px;
  background: #ffffff;
  border: 1px solid #d7d7d3;
  border-radius: 8px;
  overflow: hidden;
}
snapshot::before {
  content: "snapshot " attr(id) " (" attr(response-count) " responses)";
  display: block;
  padding: 8px 20px;
  background: #ecece8;
  border-bottom: 1px solid #d7d7d3;
  font-size: 13px;
  font-weight: 600;
}
snapshot[current="true"]::before {
  content: "snapshot " attr(id) " (" attr(response-count) " responses, current)";
  background: #e4efe0;
}

schema {
  display: block;
  padding: 14px 20px;
  background: #fbfbf9;
  border-bottom: 1px solid #e6e6e2;
}
schema::before {
  content: "what respondents saw";
  display: block;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #9a9a92;
}
page { display: block; margin-top: 14px; }
page::before {
  content: "page " attr(index) ": " attr(title);
  display: block;
  font-size: 15px;
  font-weight: 700;
}
page:not([title])::before { content: "page " attr(index); }

display { display: block; margin: 6px 0; color: #444444; }
display[kind="header"] { margin-top: 12px; font-size: 17px; font-weight: 700; color: #141414; }
display[kind="label"] { font-weight: 600; }
display[kind="quote"] { padding-left: 12px; border-left: 3px solid #cccccc; font-style: italic; }
display[kind="html"] { white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #77776f; }
display[kind="biglink"]::after { content: " (" attr(url) ")"; color: #8a8a84; font-size: 12px; }
display[kind="video"]::after { content: " (" attr(src) ")"; color: #8a8a84; font-size: 12px; }
display[kind="previousAnswer"]::before { content: "previous answer to " attr(source-field-id) " "; color: #8a8a84; }
display[kind="userLocation"]::before { content: "user location "; color: #8a8a84; }
display item { display: block; font-size: 13px; color: #77776f; }
display item::before { content: attr(alt); display: block; }
display item::after { content: attr(src); display: block; font-size: 11px; color: #9a9a92; word-break: break-all; }
section { display: block; margin: 4px 0 4px 14px; }
section::before { content: attr(title); display: block; font-weight: 600; }
message { display: block; }
message::before { content: attr(name) ": "; color: #8a8a84; }

group { display: block; margin: 10px 0; padding-left: 12px; border-left: 2px solid #deded8; }
group::before { content: attr(label); display: block; font-weight: 600; }

question {
  display: block;
  margin: 10px 0;
  padding: 8px 12px;
  background: #ffffff;
  border: 1px solid #e6e6e2;
  border-radius: 6px;
}
question::before {
  content: attr(id) " (" attr(kind) ")";
  display: block;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: #9a9a92;
}
question[required="true"]::after { content: "required"; display: block; font-size: 11px; color: #b4682a; }
question > label { display: block; font-weight: 600; color: #141414; }
question > description { display: block; font-size: 13px; color: #666660; }
question > option, question > sub-field {
  display: block;
  padding-left: 14px;
  font-size: 13px;
  color: #55554f;
  white-space: normal;
  overflow-wrap: break-word;
}
question > option::before { content: "- "; }
question > sub-field::before { content: attr(id) " (" attr(kind) ") "; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: #9a9a92; }

responses { display: block; padding: 4px 20px 16px; }
response { display: block; padding: 12px 14px; border-top: 1px solid #ecece6; }
response:nth-of-type(even) { background: #faf9f6; }
response::before {
  content: "#" attr(id) "  " attr(submitted-at);
  display: block;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: #9a9a92;
}
respondent { display: block; font-weight: 600; }
respondent[withdrawn="true"]::after { content: " withdrew"; color: #b4682a; font-weight: 400; }

answer { display: block; margin: 8px 0; }
answer field-id { display: block; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: #8a8a84; }
answer field-label { display: block; font-size: 13px; font-weight: 600; color: #333330; }
answer[unanswered="true"]::after { content: "no answer"; display: block; font-size: 12px; color: #a8a8a2; }
answer[orphan="true"] field-id::after { content: " (not in this snapshot)"; color: #b4682a; }

raw {
  display: block;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: #666660;
  white-space: pre-wrap;
  word-break: break-word;
}
pretty { display: block; white-space: pre-wrap; }
pretty item, pretty sub { display: block; font-size: inherit; vertical-align: baseline; }
pretty item[rank]::before { content: attr(rank) ". "; color: #8a8a84; }
pretty sub::before { content: attr(field) ": "; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: #8a8a84; }
body.mode-labels pretty sub::before { content: attr(label) ": "; font-family: inherit; font-size: 13px; font-weight: 600; }
pretty item[index] { margin-top: 6px; }
pretty item[index]::before { content: "item " attr(index); display: block; font-size: 11px; color: #8a8a84; }

body.mode-raw pretty, body.mode-raw answer field-label { display: none; }
body.mode-labels raw, body.mode-labels answer field-id { display: none; }
`;

const EXPORT_SCRIPT = `
(function () {
  var body = document.body;
  var toggle = document.getElementById("mode-toggle");
  var download = document.getElementById("download-csv");

  function showingLabels() {
    return body.className.indexOf("mode-labels") !== -1;
  }

  function setMode(labels) {
    body.className = labels ? "mode-labels" : "mode-raw";
    toggle.textContent = labels ? "Showing labels" : "Showing raw values";
  }

  function nodeText(node) {
    if (!node) return "";
    var children = node.children;
    if (!children.length) return (node.textContent || "").trim();
    var parts = [];
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      var text = nodeText(child);
      var prefix = showingLabels()
        ? child.getAttribute("label") || child.getAttribute("field")
        : child.getAttribute("field");
      if (prefix) text = prefix + ": " + text;
      if (text) parts.push(text);
    }
    return parts.join("; ");
  }

  function answerText(answer) {
    return nodeText(answer.querySelector(showingLabels() ? "pretty" : "raw"));
  }

  function csvCell(value) {
    var text = value == null ? "" : String(value);
    if (/[",\\r\\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
    return text;
  }

  function buildCsv() {
    var labels = showingLabels();
    var hasVariants = !!document.querySelector("variant");
    var headers = ["Response ID", "Submitted At", "Snapshot ID"];
    if (hasVariants) headers.push("Variant");
    headers = headers.concat(["Respondent", "User ID", "SID", "Withdrawn"]);

    var fieldIds = [];
    var headerByField = {};
    var allAnswers = document.querySelectorAll("answer");
    for (var i = 0; i < allAnswers.length; i++) {
      var field = allAnswers[i].getAttribute("field") || "";
      if (headerByField["f:" + field]) continue;
      fieldIds.push(field);
      headerByField["f:" + field] = labels
        ? allAnswers[i].getAttribute("label") || field
        : field;
    }

    var used = {};
    for (i = 0; i < headers.length; i++) used["h:" + headers[i]] = true;
    for (i = 0; i < fieldIds.length; i++) {
      var base = headerByField["f:" + fieldIds[i]];
      var name = base;
      var n = 2;
      while (used["h:" + name]) {
        name = base + " (" + n + ")";
        n++;
      }
      used["h:" + name] = true;
      headers.push(name);
    }

    var rows = [headers];
    var responses = document.querySelectorAll("response");
    for (i = 0; i < responses.length; i++) {
      var response = responses[i];
      var snapshot = response.closest("snapshot");
      var variant = response.closest("variant");
      var respondent = response.querySelector("respondent");
      var row = [
        response.getAttribute("id") || "",
        response.getAttribute("submitted-at") || "",
        snapshot ? snapshot.getAttribute("id") || "" : "",
      ];
      if (hasVariants) row.push(variant ? variant.getAttribute("name") || "" : "");
      row.push(respondent ? (respondent.textContent || "").trim() : "");
      row.push(respondent ? respondent.getAttribute("user-id") || "" : "");
      row.push(respondent ? respondent.getAttribute("sid") || "" : "");
      row.push(respondent ? respondent.getAttribute("withdrawn") || "" : "");

      var byField = {};
      var answers = response.querySelectorAll("answer");
      for (var j = 0; j < answers.length; j++) {
        byField["f:" + (answers[j].getAttribute("field") || "")] = answers[j];
      }
      for (j = 0; j < fieldIds.length; j++) {
        var answer = byField["f:" + fieldIds[j]];
        row.push(answer ? answerText(answer) : "");
      }
      rows.push(row);
    }

    var lines = [];
    for (i = 0; i < rows.length; i++) {
      var cells = [];
      for (j = 0; j < rows[i].length; j++) cells.push(csvCell(rows[i][j]));
      lines.push(cells.join(","));
    }
    return lines.join("\\r\\n");
  }

  toggle.addEventListener("click", function () {
    setMode(!showingLabels());
  });

  download.addEventListener("click", function () {
    var blob = new Blob(["\\ufeff" + buildCsv()], {
      type: "text/csv;charset=utf-8;",
    });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = CSV_FILE_NAME;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });

  setMode(false);
})();
`;

export function buildResponsesHtml(params: BuildResponsesHtmlParams): string {
  const {
    title,
    form,
    responses,
    withdrawnUserMap,
    sidsToUserMap,
    variantOptions,
    exportedAt,
    csvFileName,
  } = params;

  const sorted = [...responses].sort((a, b) => submittedAt(a) - submittedAt(b));

  const renderGroups = (groups: SnapshotGroup[]): string =>
    groups
      .map((group) =>
        renderSnapshot({ group, withdrawnUserMap, sidsToUserMap }),
      )
      .join("");

  let snapshotCount = 0;
  let bodyContent: string;

  if (variantOptions && variantOptions.length > 0) {
    const byFormId = new Map<number, FormResponseDto[]>();
    for (const response of sorted) {
      const bucket = byFormId.get(response.formId);
      if (bucket) bucket.push(response);
      else byFormId.set(response.formId, [response]);
    }
    const named = new Map(
      variantOptions.map((option) => [option.formId, option.name]),
    );
    const formIds = [
      ...variantOptions.map((option) => option.formId),
      ...[...byFormId.keys()].filter((formId) => !named.has(formId)),
    ];
    bodyContent = formIds
      .map((formId) => {
        const groups = groupSnapshots({
          responses: byFormId.get(formId) ?? [],
          currentSchema: form.schema,
          currentSnapshotId: formId === form.id ? form.formSnapshotId : null,
        });
        snapshotCount += groups.length;
        return tag(
          "variant",
          [
            ["form-id", formId],
            ["name", named.get(formId) ?? `form ${formId}`],
          ],
          renderGroups(groups),
        );
      })
      .join("");
  } else {
    const groups = groupSnapshots({
      responses: sorted,
      currentSchema: form.schema,
      currentSnapshotId: form.formSnapshotId,
    });
    snapshotCount = groups.length;
    bodyContent = renderGroups(groups);
  }

  const meta = tag(
    "export-meta",
    [],
    tag("exported-at", [], escapeXml(exportedAt)) +
      tag("response-count", [], String(sorted.length)) +
      tag("snapshot-count", [], String(snapshotCount)) +
      tag("first-response-at", [], escapeXml(sorted[0]?.createdAt ?? "")) +
      tag(
        "last-response-at",
        [],
        escapeXml(sorted[sorted.length - 1]?.createdAt ?? ""),
      ),
  );

  const root = tag(
    "form-export",
    [
      ["form-id", form.id],
      ["title", title],
    ],
    meta + bodyContent,
  );

  const toolbar = tag(
    "toolbar",
    [],
    `<span class="name">${escapeXml(title)}</span>` +
      `<button type="button" id="mode-toggle">Showing raw values</button>` +
      `<button type="button" class="primary" id="download-csv">Download CSV</button>`,
  );

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeXml(title)}</title>`,
    `<style>${STYLES}</style>`,
    "</head>",
    '<body class="mode-raw">',
    toolbar,
    root,
    `<script>var CSV_FILE_NAME = ${JSON.stringify(csvFileName)};${EXPORT_SCRIPT}</script>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}
