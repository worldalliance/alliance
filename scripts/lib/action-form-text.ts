import { z } from "zod";
import type { DisplayKind } from "../../common/src/forms/display-blocks";
import { DISPLAY_KINDS } from "../../common/src/forms/element-descriptors";
import type { FieldKind } from "../../common/src/forms/form-schema";

const FIELD_TAG = {
  text: "custom",
  textarea: "textarea",
  email: "custom",
  phone: "custom",
  number: "number",
  range: "range",
  checkbox: "checkbox",
  radio: "radio",
  select: "select",
  multiselect: "multiselect",
  ranking: "custom",
  date: "custom",
  time: "custom",
  timezone: "custom",
  city: "custom",
  file: "file",
  contract: "contract",
  list: "list",
  custom: "custom",
} as const satisfies Record<FieldKind, string>;

const field = z.looseObject({
  type: z.literal("input"),
  kind: z.custom<FieldKind>(
    (kind) => typeof kind === "string" && Object.hasOwn(FIELD_TAG, kind),
  ),
  label: z.string().nullish(),
  required: z.boolean().optional(),
  options: z.array(z.looseObject({ label: z.string() })).optional(),
  startLabel: z.string().optional(),
  endLabel: z.string().optional(),
  get fields() {
    return z.array(field).optional();
  },
});
type Field = z.infer<typeof field>;

const display = z.looseObject({
  type: z.literal("display"),
  kind: z.enum(DISPLAY_KINDS),
  text: z.string().optional(),
  level: z.number().optional(),
  images: z
    .array(z.looseObject({ src: z.string(), caption: z.string().optional() }))
    .optional(),
});
type Display = z.infer<typeof display>;

const storedForm = z.looseObject({
  pages: z.array(
    z.looseObject({
      title: z.string().optional(),
      fields: z.array(z.discriminatedUnion("type", [field, display])),
    }),
  ),
  submit: z.looseObject({ label: z.string() }),
});

function fieldLines(element: Field): string[] {
  const tag = FIELD_TAG[element.kind];
  const lines = [
    `[${element.required ? `${tag}, required` : tag}] ${element.label ?? ""}`,
  ];
  for (const { label } of element.options ?? []) lines.push(`  - ${label}`);
  if (element.kind === "range") {
    lines.push(`  ${element.startLabel ?? ""} … ${element.endLabel ?? ""}`);
  }
  for (const sub of element.fields ?? []) {
    lines.push(...fieldLines(sub).map((line) => `  ${line}`));
  }
  return lines;
}

const DISPLAY_TEXT: Record<DisplayKind, (block: Display) => string> = {
  header: (block) => `${"#".repeat(block.level ?? 2)} ${block.text ?? ""}`,
  text: (block) => block.text ?? "",
  label: (block) => block.text ?? "",
  quote: (block) => block.text ?? "",
  biglink: (block) => block.text ?? "",
  copytext: (block) => block.text ?? "",
  images: (block) =>
    (block.images ?? [])
      .map((image) => `![${image.caption ?? ""}](${image.src})`)
      .join("\n\n"),
  previousAnswer: () => "",
  userLocation: () => "",
  video: () => "",
  divider: () => "",
  spacer: () => "",
  html: () => "",
  chatTranscript: () => "",
  accordion: () => "",
};

/** The `form` string of an action export; see action-export.schema.yml. */
export function renderActionForm(params: {
  formId: number;
  title: string;
  schema: unknown;
}): string {
  const form = storedForm.parse(params.schema);
  const blocks = [
    `=== task form — form #${params.formId}: ${params.title} ===`,
  ];
  form.pages.forEach((page, index) => {
    blocks.push(`--- Page ${index + 1}: ${page.title} ---`);
    for (const element of page.fields) {
      blocks.push(
        element.type === "input"
          ? fieldLines(element).join("\n")
          : DISPLAY_TEXT[element.kind](element),
      );
    }
  });
  blocks.push(`[submit] ${form.submit.label}`);
  return `${blocks.join("\n\n")}\n`;
}
