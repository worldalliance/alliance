import { hostedDocSlugFromFileName, hostedDocSlugSchema } from "./hostedDocs";

test.each([
  [
    "2026 Democratic Grant-Making Pilot.PDF",
    "2026-Democratic-Grant-Making-Pilot.pdf",
  ],
  ["report.v2 (final).pdf", "report-v2-final.pdf"],
  ["already_fine.pdf", "already_fine.pdf"],
])("prefills %s as %s", (fileName, slug) => {
  expect(hostedDocSlugFromFileName(fileName)).toBe(slug);
  expect(hostedDocSlugSchema.parse(slug)).toBe(slug);
});

test.each([
  "",
  ".pdf",
  "a.b.pdf",
  "a b.pdf",
  "dir/a.pdf",
  "a.PDF",
  "a",
  `${"a".repeat(101)}.pdf`,
])("rejects %j", (slug) => {
  expect(hostedDocSlugSchema.safeParse(slug).success).toBe(false);
});

test("keeps the casing the admin typed", () => {
  expect(hostedDocSlugSchema.parse(" 2026-Pilot.pdf ")).toBe("2026-Pilot.pdf");
});
