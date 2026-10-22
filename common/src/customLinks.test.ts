import { customLinkFieldsSchema } from "./customLinks";

const fields = {
  label: "Flyer",
  slug: "100k",
  destination: "/projects/democratic-grantmaking-26?link=flyer#join",
};

test("accepts a readable path and preserves destination attribution", () => {
  expect(customLinkFieldsSchema.parse({ ...fields, slug: " /100k " })).toEqual(
    fields,
  );
});

test.each([
  "https://example.com/join?ref=flyer",
  "/",
  "/join?link=flyer",
  "https://thealliance.org/projects/democratic-grantmaking-26?link=flyer",
])("accepts destination %s", (destination) => {
  expect(
    customLinkFieldsSchema.safeParse({ ...fields, destination }).success,
  ).toBe(true);
});

test.each([
  "join",
  "projects",
  "api",
  "assets",
  "100K",
  "a/b",
  "",
  "x".repeat(65),
  "../a",
])("rejects invalid or reserved path %s", (slug) => {
  expect(customLinkFieldsSchema.safeParse({ ...fields, slug }).success).toBe(
    false,
  );
});

test.each([
  "/100k",
  "https://thealliance.org//100k",
  "/projects/\x00",
  "https://thealliance.org/100k",
  "https://www.worldalliance.org/100k",
  "//evil.test",
  "/\\evil.test",
  "/projects/../../100k",
  "javascript:alert(1)",
  "https://user:pass@example.com",
  "/join\nLocation: https://example.com",
  "",
  "join",
])("rejects unsafe or looping destination %s", (destination) => {
  expect(
    customLinkFieldsSchema.safeParse({ ...fields, destination }).success,
  ).toBe(false);
});

test.each(["", " ", null])("rejects invalid labels", (label) => {
  expect(customLinkFieldsSchema.safeParse({ ...fields, label }).success).toBe(
    false,
  );
});
