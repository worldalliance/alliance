import { getUserListTitle } from "./userList";

const LIKE = "like";

describe("getUserListTitle", () => {
  it("uses the expected count while the first page loads", () => {
    const title = getUserListTitle({
      noun: LIKE,
      expectedCount: 7,
      loadedCount: 0,
      initialLoading: true,
      hasNextPage: false,
    });

    expect(title).toBe("7 likes");
  });

  it("floors a stale-low expected count at the loaded count while paging", () => {
    const title = getUserListTitle({
      noun: LIKE,
      expectedCount: 25,
      loadedCount: 30,
      initialLoading: false,
      hasNextPage: true,
    });

    expect(title).toBe("30 likes");
  });

  it("keeps the expected count while paging when it exceeds the loaded count", () => {
    const title = getUserListTitle({
      noun: LIKE,
      expectedCount: 50,
      loadedCount: 30,
      initialLoading: false,
      hasNextPage: true,
    });

    expect(title).toBe("50 likes");
  });

  it("trusts the loaded count once fully loaded, even against a stale-high total", () => {
    const title = getUserListTitle({
      noun: LIKE,
      expectedCount: 50,
      loadedCount: 28,
      initialLoading: false,
      hasNextPage: false,
    });

    expect(title).toBe("28 likes");
  });

  it("uses the singular noun for a count of one", () => {
    const title = getUserListTitle({
      noun: LIKE,
      expectedCount: 1,
      loadedCount: 1,
      initialLoading: false,
      hasNextPage: false,
    });

    expect(title).toBe("1 like");
  });
});
