import z from "zod";
import { visibleIfFormulaSchema } from "./visible-if-formula";

const baseContentFields = {
  visibleIfFormula: visibleIfFormulaSchema.optional(),
  width: z
    .union([z.literal("full"), z.literal("1/2"), z.literal("1/3")])
    .optional(),
};

const headerContentSchema = z.strictObject({
  ...baseContentFields,
  text: z.string(),
  level: z
    .union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
      z.literal(6),
    ])
    .optional(),
});

const textContentSchema = z.strictObject({
  ...baseContentFields,
  text: z.string(),
});

const quoteContentSchema = z.strictObject({
  ...baseContentFields,
  text: z.string(),
});

const labelContentSchema = z.strictObject({
  ...baseContentFields,
  text: z.string(),
});

const dividerContentSchema = z.strictObject({
  ...baseContentFields,
  thickness: z.enum(["hairline", "thin", "medium", "thick"]).optional(),
});

const spacerContentSchema = z.strictObject({
  ...baseContentFields,
  size: z.enum(["xs", "sm", "md", "lg", "xl"]).optional(),
});

const htmlContentSchema = z.strictObject({
  ...baseContentFields,
  html: z.string(),
});

const imageContentSchema = z.strictObject({
  ...baseContentFields,
  alt: z.string(),
  src: z.string(),
  aspectRatio: z.number().optional(),
  caption: z.string().optional(),
});

const videoContentSchema = z.strictObject({
  ...baseContentFields,
  src: z.string(),
  videoId: z.number().optional(),
  caption: z.string().optional(),
});

const bigLinkIconSchema = z.enum([
  "messages-square",
  "file",
  "file-text",
  "file-check",
  "signature",
]);
export type BigLinkIcon = z.infer<typeof bigLinkIconSchema>;

const bigLinkContentSchema = z.strictObject({
  ...baseContentFields,
  text: z.string(),
  url: z.string(),
  icon: bigLinkIconSchema.optional(),
});

const copyTextContentSchema = z.strictObject({
  ...baseContentFields,
  text: z.string(),
  title: z.string().optional(),
});

const previousAnswerContentSchema = z.strictObject({
  ...baseContentFields,
  sourceFormId: z.number(),
  sourceFieldId: z.string(),
  title: z.string().optional(),
  visibleSubFieldIds: z.array(z.string()).optional(),
  emptyText: z.string().optional(),
  showLabel: z.boolean().default(true),
});

const userLocationContentSchema = z.strictObject({
  ...baseContentFields,
  title: z.string().optional(),
  emptyText: z.string().optional(),
});

const chatTranscriptMessageSchema = z.strictObject({
  side: z.enum(["left", "right"]),
  text: z.string(),
});
export type ChatTranscriptMessage = z.infer<typeof chatTranscriptMessageSchema>;

export type ChatTranscriptGroup = {
  side: ChatTranscriptMessage["side"];
  texts: string[];
};

/** Collapse a transcript into runs of consecutive same-side messages. */
export function groupChatTranscriptMessages(
  messages: ChatTranscriptMessage[],
): ChatTranscriptGroup[] {
  const groups: ChatTranscriptGroup[] = [];
  for (const message of messages) {
    const last = groups[groups.length - 1];
    if (last && last.side === message.side) {
      last.texts.push(message.text);
    } else {
      groups.push({ side: message.side, texts: [message.text] });
    }
  }
  return groups;
}

/** One unit of a chat transcript block's `size`, in pixels of card height. */
export const CHAT_TRANSCRIPT_SIZE_UNIT_PX = 100;

const chatTranscriptContentSchema = z.strictObject({
  ...baseContentFields,
  leftName: z.string().optional(),
  rightName: z.string().optional(),
  size: z.number().positive().optional(),
  messages: z.array(chatTranscriptMessageSchema),
});

const manualDisplayBlockContentSchema = z.union([
  headerContentSchema,
  textContentSchema,
  quoteContentSchema,
  labelContentSchema,
  dividerContentSchema,
  spacerContentSchema,
  htmlContentSchema,
  imageContentSchema,
  videoContentSchema,
  bigLinkContentSchema,
  copyTextContentSchema,
  previousAnswerContentSchema,
  userLocationContentSchema,
  chatTranscriptContentSchema,
]);
export type ManualDisplayBlockContent = z.infer<
  typeof manualDisplayBlockContentSchema
>;

const baseBlockFields = {
  type: z.literal("display"),
  id: z.string().optional(),
  manualPerUser: z.boolean().optional(),
  manualUserContent: z
    .record(z.string(), manualDisplayBlockContentSchema)
    .optional(),
};

const headerBlockSchema = z.strictObject({
  ...baseBlockFields,
  kind: z.literal("header"),
  ...headerContentSchema.shape,
});
export type HeaderBlock = z.infer<typeof headerBlockSchema>;

const textBlockSchema = z.strictObject({
  ...baseBlockFields,
  kind: z.literal("text"),
  ...textContentSchema.shape,
});
export type TextBlock = z.infer<typeof textBlockSchema>;

const quoteBlockSchema = z.strictObject({
  ...baseBlockFields,
  kind: z.literal("quote"),
  ...quoteContentSchema.shape,
});
export type QuoteBlock = z.infer<typeof quoteBlockSchema>;

const labelBlockSchema = z.strictObject({
  ...baseBlockFields,
  kind: z.literal("label"),
  ...labelContentSchema.shape,
});
export type LabelBlock = z.infer<typeof labelBlockSchema>;

const dividerBlockSchema = z.strictObject({
  ...baseBlockFields,
  kind: z.literal("divider"),
  ...dividerContentSchema.shape,
});
export type DividerBlock = z.infer<typeof dividerBlockSchema>;

const spacerBlockSchema = z.strictObject({
  ...baseBlockFields,
  kind: z.literal("spacer"),
  ...spacerContentSchema.shape,
});
export type SpacerBlock = z.infer<typeof spacerBlockSchema>;

const htmlBlockSchema = z.strictObject({
  ...baseBlockFields,
  kind: z.literal("html"),
  ...htmlContentSchema.shape,
});
export type HtmlBlock = z.infer<typeof htmlBlockSchema>;

const imageBlockSchema = z.strictObject({
  ...baseBlockFields,
  kind: z.literal("image"),
  ...imageContentSchema.shape,
});
export type ImageBlock = z.infer<typeof imageBlockSchema>;

const videoBlockSchema = z.strictObject({
  ...baseBlockFields,
  kind: z.literal("video"),
  ...videoContentSchema.shape,
});
export type VideoBlock = z.infer<typeof videoBlockSchema>;

const bigLinkBlockSchema = z.strictObject({
  ...baseBlockFields,
  kind: z.literal("biglink"),
  ...bigLinkContentSchema.shape,
});
export type BigLinkBlock = z.infer<typeof bigLinkBlockSchema>;

const copyTextBlockSchema = z.strictObject({
  ...baseBlockFields,
  kind: z.literal("copytext"),
  ...copyTextContentSchema.shape,
});
export type CopyTextBlock = z.infer<typeof copyTextBlockSchema>;

const previousAnswerBlockSchema = z.strictObject({
  ...baseBlockFields,
  kind: z.literal("previousAnswer"),
  ...previousAnswerContentSchema.shape,
});
export type PreviousAnswerBlock = z.infer<typeof previousAnswerBlockSchema>;

const userLocationBlockSchema = z.strictObject({
  ...baseBlockFields,
  kind: z.literal("userLocation"),
  ...userLocationContentSchema.shape,
});
export type UserLocationBlock = z.infer<typeof userLocationBlockSchema>;

const chatTranscriptBlockSchema = z.strictObject({
  ...baseBlockFields,
  kind: z.literal("chatTranscript"),
  ...chatTranscriptContentSchema.shape,
});
export type ChatTranscriptBlock = z.infer<typeof chatTranscriptBlockSchema>;

export const displayBlockSchema = z.discriminatedUnion("kind", [
  headerBlockSchema,
  textBlockSchema,
  quoteBlockSchema,
  labelBlockSchema,
  dividerBlockSchema,
  spacerBlockSchema,
  htmlBlockSchema,
  imageBlockSchema,
  videoBlockSchema,
  bigLinkBlockSchema,
  copyTextBlockSchema,
  previousAnswerBlockSchema,
  userLocationBlockSchema,
  chatTranscriptBlockSchema,
]);
export type DisplayBlock = z.infer<typeof displayBlockSchema>;
export type DisplayKind = DisplayBlock["kind"];

export type ManualImportField = "text" | "html";

/**
 * For each display-block kind, the single string field that
 * "Import from clipboard" should write per-user content into.
 * `null` means the kind doesn't support clipboard import.
 */
export const MANUAL_IMPORT_FIELD_BY_KIND: Record<
  DisplayKind,
  ManualImportField | null
> = {
  header: "text",
  text: "text",
  label: "text",
  quote: "text",
  copytext: "text",
  html: "html",
  divider: null,
  spacer: null,
  image: null,
  video: null,
  biglink: null,
  previousAnswer: null,
  userLocation: null,
  chatTranscript: null,
};

export const manualImportClipboardSchema = z
  .record(z.string(), z.string())
  .refine((v) => !Array.isArray(v), "Expected a JSON object, not an array.");
export type ManualImportClipboardPayload = z.infer<
  typeof manualImportClipboardSchema
>;
