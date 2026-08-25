import { forCount, pickForCount, withCount } from "./plural";

describe("forCount", () => {
  it("uses the singular at exactly 1", () => {
    expect(forCount(0, "like")).toBe("likes");
    expect(forCount(1, "like")).toBe("like");
    expect(forCount(2, "like")).toBe("likes");
  });

  it("handles irregular nouns without being told", () => {
    expect(forCount(0, "person")).toBe("people");
    expect(forCount(3, "person")).toBe("people");
    expect(forCount(3, "reply")).toBe("replies");
  });

  it("pluralizes a phrase, irregulars included", () => {
    expect(forCount(3, "unread Alliance forum notification")).toBe(
      "unread Alliance forum notifications",
    );
    expect(forCount(3, "more member")).toBe("more members");
    expect(forCount(3, "more person")).toBe("more people");
    expect(forCount(3, "decimal place")).toBe("decimal places");
    expect(forCount(3, "open seat")).toBe("open seats");
    expect(forCount(3, "successful recruit")).toBe("successful recruits");
  });

  it("treats a negative count as plural", () => {
    expect(forCount(-1, "day")).toBe("days");
  });

  it("keeps the capitalization it was given", () => {
    expect(forCount(3, "Lead")).toBe("Leads");
  });
});

describe("withCount", () => {
  it("prefixes the count", () => {
    expect(withCount(0, "day")).toBe("0 days");
    expect(withCount(1, "day")).toBe("1 day");
    expect(withCount(2, "day")).toBe("2 days");
  });

  it("prefixes the count on a phrase", () => {
    expect(withCount(2, "open seat")).toBe("2 open seats");
  });

  it("prefixes a zero count, irregulars included", () => {
    expect(withCount(0, "hour")).toBe("0 hours");
    expect(withCount(0, "person")).toBe("0 people");
    expect(withCount(0, "reply")).toBe("0 replies");
  });
});

describe("pickForCount", () => {
  it("selects between two given forms", () => {
    expect(pickForCount(1, "needs", "need")).toBe("needs");
    expect(pickForCount(2, "needs", "need")).toBe("need");
    expect(pickForCount(1, "that photo", "those photos")).toBe("that photo");
    expect(pickForCount(0, "it", "them")).toBe("them");
  });

  it("overrides a plural pluralize would derive differently", () => {
    expect(pickForCount(1, "person", "persons")).toBe("person");
    expect(pickForCount(3, "person", "persons")).toBe("persons");
  });
});
