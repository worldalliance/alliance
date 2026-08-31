import z from "zod";
import { R, type Result } from "../result";
import type { Assert, Equal } from "../types";
import {
  accordionBlockSchema,
  bigLinkBlockSchema,
  chatTranscriptBlockSchema,
  copyTextBlockSchema,
  dividerBlockSchema,
  headerBlockSchema,
  htmlBlockSchema,
  imagesBlockSchema,
  labelBlockSchema,
  quoteBlockSchema,
  spacerBlockSchema,
  textBlockSchema,
  videoBlockSchema,
  type DisplayKind,
} from "./display-blocks";
import type { FormSchema } from "./form-schema";

// Omitting only optional properties preserves assignability to DisplayBlock.
const PER_VIEWER_FIELDS = {
  visibleIfFormula: true,
  manualPerUser: true,
  manualUserContent: true,
} as const;

// null excludes kinds that require viewer state.
const DISPLAY_ONLY_SCHEMA_BY_KIND = {
  header: headerBlockSchema.omit(PER_VIEWER_FIELDS),
  text: textBlockSchema.omit(PER_VIEWER_FIELDS),
  quote: quoteBlockSchema.omit(PER_VIEWER_FIELDS),
  label: labelBlockSchema.omit(PER_VIEWER_FIELDS),
  divider: dividerBlockSchema.omit(PER_VIEWER_FIELDS),
  spacer: spacerBlockSchema.omit(PER_VIEWER_FIELDS),
  html: htmlBlockSchema.omit(PER_VIEWER_FIELDS),
  images: imagesBlockSchema.omit(PER_VIEWER_FIELDS),
  video: videoBlockSchema.omit(PER_VIEWER_FIELDS),
  biglink: bigLinkBlockSchema.omit(PER_VIEWER_FIELDS),
  copytext: copyTextBlockSchema.omit(PER_VIEWER_FIELDS),
  chatTranscript: chatTranscriptBlockSchema.omit(PER_VIEWER_FIELDS),
  accordion: accordionBlockSchema.omit(PER_VIEWER_FIELDS),
  previousAnswer: null,
  userLocation: null,
} satisfies Record<DisplayKind, z.ZodObject | null>;

export const displayOnlyBlockSchema = z.discriminatedUnion("kind", [
  DISPLAY_ONLY_SCHEMA_BY_KIND.header,
  DISPLAY_ONLY_SCHEMA_BY_KIND.text,
  DISPLAY_ONLY_SCHEMA_BY_KIND.quote,
  DISPLAY_ONLY_SCHEMA_BY_KIND.label,
  DISPLAY_ONLY_SCHEMA_BY_KIND.divider,
  DISPLAY_ONLY_SCHEMA_BY_KIND.spacer,
  DISPLAY_ONLY_SCHEMA_BY_KIND.html,
  DISPLAY_ONLY_SCHEMA_BY_KIND.images,
  DISPLAY_ONLY_SCHEMA_BY_KIND.video,
  DISPLAY_ONLY_SCHEMA_BY_KIND.biglink,
  DISPLAY_ONLY_SCHEMA_BY_KIND.copytext,
  DISPLAY_ONLY_SCHEMA_BY_KIND.chatTranscript,
  DISPLAY_ONLY_SCHEMA_BY_KIND.accordion,
]);
export type DisplayOnlyBlock = z.infer<typeof displayOnlyBlockSchema>;
export type DisplayOnlyBlockKind = DisplayOnlyBlock["kind"];

type OptedInDisplayOnlyKind = {
  [K in keyof typeof DISPLAY_ONLY_SCHEMA_BY_KIND]: (typeof DISPLAY_ONLY_SCHEMA_BY_KIND)[K] extends null
    ? never
    : K;
}[keyof typeof DISPLAY_ONLY_SCHEMA_BY_KIND];

type _typecheck = Assert<Equal<DisplayOnlyBlockKind, OptedInDisplayOnlyKind>>;

export const displayOnlySchema = z.strictObject({
  description: z.string().optional(),
  blocks: z.array(displayOnlyBlockSchema),
});
export type DisplayOnlySchema = z.infer<typeof displayOnlySchema>;

export const DISPLAY_ONLY_BLOCK_KINDS = displayOnlyBlockSchema.options.map(
  (option) => option.shape.kind.value,
);

const DISPLAY_ONLY_BLOCK_KIND_SET: ReadonlySet<string> = new Set(
  DISPLAY_ONLY_BLOCK_KINDS,
);

export function emptyDisplayOnlySchema(): DisplayOnlySchema {
  return { blocks: [] };
}

export const DISPLAY_ONLY_PAGE_ID = "page-1";

export function displayOnlyToFormSchema(schema: DisplayOnlySchema): FormSchema {
  return {
    ...(schema.description !== undefined && {
      description: schema.description,
    }),
    pages: [{ id: DISPLAY_ONLY_PAGE_ID, fields: schema.blocks }],
    outputViews: [],
  };
}

const unusableHere = (label: string) =>
  z.array(z.unknown()).max(0, `${label} are not display-only content`);

const displayOnlyPageSchema = z.strictObject({
  id: z.string(),
  fields: z.array(displayOnlyBlockSchema),
});

const displayOnlyFormSchema = z.strictObject({
  description: z.string().optional(),
  pages: z.array(displayOnlyPageSchema),
  outputViews: unusableHere("output views"),
  aggregateViews: unusableHere("aggregate views").optional(),
  variables: unusableHere("variables").optional(),
});

function describeSchemaIssues(error: z.ZodError): string[] {
  return error.issues.map(
    (issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`,
  );
}

export const DISPLAY_ONLY_SCHEMA_ERROR = "Invalid display-only schema";

const displayOnlySchemaErrorSchema = z.object({
  message: z.literal(DISPLAY_ONLY_SCHEMA_ERROR),
  errors: z.array(z.string()),
});

/** The body the server rejects a non-display-only schema with. */
export function displayOnlySchemaError(error: z.ZodError): {
  message: string;
  errors: string[];
} {
  return {
    message: DISPLAY_ONLY_SCHEMA_ERROR,
    errors: describeSchemaIssues(error),
  };
}

/** Recovers the per-issue detail out of a rejected response body. */
export function readDisplayOnlySchemaError(value: unknown): string[] | null {
  const parsed = displayOnlySchemaErrorSchema.safeParse(value);
  return parsed.success ? parsed.data.errors : null;
}

export function formSchemaToDisplayOnly(
  schema: FormSchema,
): Result<DisplayOnlySchema, string[]> {
  const parsed = displayOnlyFormSchema.safeParse(schema);
  if (!parsed.success) {
    return R.failure(describeSchemaIssues(parsed.error));
  }
  const { description, pages } = parsed.data;
  return R.success({
    ...(description !== undefined && { description }),
    blocks: pages.flatMap((page) => page.fields),
  });
}

export function isDisplayOnlyBlockKind(
  kind: string,
): kind is DisplayOnlyBlockKind {
  return DISPLAY_ONLY_BLOCK_KIND_SET.has(kind);
}

export function readDisplayOnlySchema(
  value: unknown,
): DisplayOnlySchema | null {
  const parsed = displayOnlySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
