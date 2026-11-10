import { findPhoneNumbersInText } from "libphonenumber-js";
import MarkdownIt from "markdown-it";

export const REDACTED = "[redacted]";

const linkify = new MarkdownIt().linkify;

/** Replaces email addresses and phone numbers in text a reviewer typed. */
export function redactContact(text: string): string {
  const spans = [
    ...(linkify.match(text) ?? [])
      .filter((m) => m.schema === "mailto:")
      .map((m) => ({ start: m.index, end: m.lastIndex })),
    // `extended` also catches numbers that aren't assigned, such as typos.
    ...findPhoneNumbersInText(text, {
      defaultCountry: "US",
      extended: true,
    }).map((p) => ({ start: p.startsAt, end: p.endsAt })),
  ].sort((a, b) => b.start - a.start);
  let out = text;
  for (const { start, end } of spans) {
    out = out.slice(0, start) + REDACTED + out.slice(end);
  }
  return out;
}

const fields = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null;

const redactString = (value: unknown) =>
  typeof value === "string" ? redactContact(value) : value;

/** Copies an export with contact details removed from its free-text answers. */
export function redactExport(
  root: Record<string, unknown>,
): Record<string, unknown> {
  const results = Array.isArray(root.results)
    ? root.results.map((r: unknown) => {
        const result = fields(r);
        if (!result) return r;
        return {
          ...result,
          ...("q3_text" in result
            ? { q3_text: redactString(result.q3_text) }
            : {}),
          ...(Array.isArray(result.annotations)
            ? {
                annotations: result.annotations.map((a: unknown) => {
                  const annotation = fields(a);
                  return annotation && "note" in annotation
                    ? { ...annotation, note: redactString(annotation.note) }
                    : a;
                }),
              }
            : {}),
        };
      })
    : root.results;
  const exitSurvey = fields(root.exitSurvey);
  return {
    ...root,
    results,
    ...(exitSurvey && "exit_q6" in exitSurvey
      ? {
          exitSurvey: {
            ...exitSurvey,
            exit_q6: redactString(exitSurvey.exit_q6),
          },
        }
      : {}),
  };
}
