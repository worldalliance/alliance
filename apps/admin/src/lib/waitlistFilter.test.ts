import { isFilterEmpty, linkOptions, withFilterField } from "./waitlistFilter";

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
    expect(isFilterEmpty(filter)).toBe(false);
    expect(isFilterEmpty({})).toBe(true);
  });
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
