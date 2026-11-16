import { exportSchema } from "@alliance/kora-review/schemas";
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

function maxLength(def: string, property: string): number {
  const limit = fields(
    fields(fields(fields(exportSchema.$defs)?.[def])?.properties)?.[property],
  )?.maxLength;
  if (typeof limit !== "number") {
    throw new Error(`exportSchema has no maxLength for ${def}.${property}`);
  }
  return limit;
}

const FREE_TEXT: Record<string, string[]> = {
  result: ["q3_text"],
  annotation: ["note"],
  profile: ["country", "gender"],
  exitSurvey: ["exit_q6"],
};

const LIMITS = new Map(
  Object.entries(FREE_TEXT).map(([def, properties]) => [
    def,
    properties.map((p) => ({ property: p, limit: maxLength(def, p) })),
  ]),
);

// A placeholder can be longer than what it replaced, so the result is cut back to the field's limit.
function redactFields(value: unknown, def: string): unknown {
  const object = fields(value);
  if (!object) return value;
  const out = { ...object };
  for (const { property, limit } of LIMITS.get(def) ?? []) {
    const text = out[property];
    if (typeof text === "string") {
      out[property] = redactContact(text).slice(0, limit);
    }
  }
  return out;
}

/** Copies an export with contact details removed from its free-text answers. */
export function redactExport(
  root: Record<string, unknown>,
): Record<string, unknown> {
  const results = Array.isArray(root.results)
    ? root.results.map((r: unknown) => {
        const result = redactFields(r, "result");
        const object = fields(result);
        return object && Array.isArray(object.annotations)
          ? {
              ...object,
              annotations: object.annotations.map((a: unknown) =>
                redactFields(a, "annotation"),
              ),
            }
          : result;
      })
    : root.results;
  return {
    ...root,
    results,
    ...("profile" in root
      ? { profile: redactFields(root.profile, "profile") }
      : {}),
    ...("exitSurvey" in root
      ? { exitSurvey: redactFields(root.exitSurvey, "exitSurvey") }
      : {}),
  };
}
