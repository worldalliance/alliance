import {
  HOSTED_DOC_MAX_BYTES,
  hostedDocFieldsSchema,
  hostedDocSlugFromFileName,
} from "@alliance/common/hostedDocs";
import { R, type Result } from "@alliance/common/result";
import type { HostedDocDto } from "@alliance/shared/client";
import { getInviteBaseUrl } from "@alliance/sharedweb/lib/config";

export type HostedDocDraft = {
  file: File | null;
  slug: string;
  notes: string;
  /** The ID last filled in from a file name, which the next file may replace. */
  filledSlug: string | null;
};
export type HostedDocErrors = Partial<
  Record<"file" | "slug" | "notes", string>
>;

export const EMPTY_HOSTED_DOC: HostedDocDraft = {
  file: null,
  slug: "",
  notes: "",
  filledSlug: null,
};

export function pdfProblem(file: File): string | null {
  if (file.type !== "application/pdf") return "Choose a PDF file";
  if (file.size > HOSTED_DOC_MAX_BYTES) return "Choose a PDF of at most 50 MB";
  return null;
}

/** A newly chosen file fills the ID, unless staff typed one of their own. */
export function withFile(
  draft: HostedDocDraft,
  file: File | null,
): HostedDocDraft {
  if (!file || (draft.slug !== "" && draft.slug !== draft.filledSlug)) {
    return { ...draft, file };
  }
  const slug = hostedDocSlugFromFileName(file.name);
  return { ...draft, file, slug, filledSlug: slug };
}

export function validateHostedDoc(
  draft: HostedDocDraft,
): Result<{ file: File; slug: string; notes: string }, HostedDocErrors> {
  const errors: HostedDocErrors = {};
  const fileProblem = draft.file ? pdfProblem(draft.file) : "Choose a PDF file";
  if (fileProblem) errors.file = fileProblem;
  const parsed = hostedDocFieldsSchema.safeParse(draft);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] === "notes" ? "notes" : "slug";
      errors[field] ??=
        draft.slug.trim() === "" && field === "slug"
          ? "Enter an ID"
          : issue.message;
    }
  }
  if (!draft.file || !parsed.success || fileProblem) return R.failure(errors);
  return R.success({ file: draft.file, ...parsed.data });
}

export const hostedDocUrl = (slug: string) =>
  `${getInviteBaseUrl()}/docs/${slug}`;

export const matchesHostedDoc = (doc: HostedDocDto, q: string) => {
  const needle = q.trim().toLowerCase();
  return [doc.slug, doc.notes].some((text) =>
    text.toLowerCase().includes(needle),
  );
};
