import {
  compactFilter,
  linkOptions,
  sameFilter,
  withFilterField,
} from "./waitlistFilter";

describe("withFilterField", () => {
  it("sets a value and drops blank ones", () => {
    const filter = withFilterField({
      filter: {},
      key: "organizationIds",
      value: [1],
    });
    expect(filter).toEqual({ organizationIds: [1] });
    expect(
      withFilterField({ filter, key: "organizationIds", value: [] }),
    ).toEqual({});
    expect(
      withFilterField({ filter: { search: "a" }, key: "search", value: "" }),
    ).toEqual({});
    expect(
      withFilterField({ filter: { search: "a" }, key: "search", value: null }),
    ).toEqual({});
    expect(
      withFilterField({
        filter: { mobilized: true },
        key: "mobilized",
        value: undefined,
      }),
    ).toEqual({});
  });

  it("keeps false", () => {
    const filter = withFilterField({
      filter: {},
      key: "mobilized",
      value: false,
    });
    expect(filter).toEqual({ mobilized: false });
  });
});

describe("sameFilter", () => {
  it("ignores key order, list order, and blank fields", () => {
    expect(
      sameFilter(
        { organizationIds: [2, 1], mobilized: false, search: null },
        { mobilized: false, organizationIds: [1, 2], tagIds: [] },
      ),
    ).toBe(true);
  });

  it("tells different filters apart", () => {
    expect(sameFilter({ mobilized: false }, { mobilized: true })).toBe(false);
    expect(sameFilter({ tagIds: [1] }, { tagIds: [1, 2] })).toBe(false);
    expect(sameFilter({ mobilized: false }, {})).toBe(false);
  });
});

it("compacts a filter's blank fields", () => {
  expect(
    compactFilter({
      search: null,
      tagIds: [],
      mobilized: false,
      hasReason: true,
    }),
  ).toEqual({ mobilized: false, hasReason: true });
});

describe("linkOptions", () => {
  const link = (id: number, channel: string, archived = false) => ({
    id,
    code: `code-${id}`,
    organizationId: 1,
    channel,
    publishedAt: null,
    archivedAt: archived ? "2026-09-02T00:00:00.000Z" : null,
    createdAt: "2026-09-01T00:00:00.000Z",
    entryCount: 0,
  });

  it("tells apart links sharing a channel, and marks archived ones", () => {
    const organizations = new Map([[1, "Acme"]]);
    expect(
      linkOptions(
        [link(1, "Newsletter", true), link(2, "Newsletter"), link(3, "Social")],
        organizations,
      ).map((option) => option.label),
    ).toEqual([
      "Acme · Newsletter · code-1 (archived)",
      "Acme · Newsletter · code-2",
      "Acme · Social",
    ]);
  });
});
