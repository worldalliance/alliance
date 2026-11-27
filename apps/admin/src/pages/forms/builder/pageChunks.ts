import type { Page } from "@alliance/common/forms/form-schema";

/**
 * The lazy parts `page` renders, loaded through the same imports the member
 * renderer uses, so awaiting them means the parts are ready to draw.
 */
export function pageChunks(page: Page): Promise<unknown>[] {
  const kinds = new Set(
    page.fields.flatMap((element) =>
      element.kind === "list"
        ? [element.kind, ...element.fields.map((sub) => sub.kind)]
        : [element.kind],
    ),
  );
  return [
    kinds.has("phone") &&
      import("@alliance/sharedweb/forms/PhoneNumberInputWithCountry"),
    kinds.has("ranking") &&
      import("@alliance/sharedweb/forms/RankingFieldInput"),
    kinds.has("video") && import("@alliance/sharedweb/forms/VideoPlayer"),
  ].filter((chunk) => chunk !== false);
}
