import { z } from "zod";

export const HOSTED_DOC_MAX_BYTES = 50 * 1024 * 1024;

export const hostedDocSlugSchema = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9_-]{1,100}\.pdf$/,
    "Use up to 100 letters, numbers, hyphens, or underscores, followed by .pdf.",
  );

export const hostedDocNotesSchema = z.string().trim().max(2000);

export const hostedDocFieldsSchema = z.object({
  slug: hostedDocSlugSchema,
  notes: hostedDocNotesSchema,
});

export function hostedDocSlugFromFileName(fileName: string): string {
  const stem = fileName
    .replace(/\.pdf$/i, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return `${stem}.pdf`;
}
