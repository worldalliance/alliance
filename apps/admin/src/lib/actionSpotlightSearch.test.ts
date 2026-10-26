import type { ActionEventDto } from "@alliance/shared/client";
import { describe, expect, it } from "bun:test";
import {
  categoryCounts,
  matchingCategories,
  searchActions,
  SPOTLIGHT_RESULT_LIMIT,
  type SpotlightAction,
} from "./actionSpotlightSearch";

const launchedOn = (date: string): ActionEventDto[] => [
  {
    id: 1,
    title: "Launch",
    description: "",
    newStatus: "member_action",
    date,
    suiteManaged: false,
  },
];

const action = (
  overrides: Partial<SpotlightAction> & Pick<SpotlightAction, "id" | "name">,
): SpotlightAction => ({
  slug: `action-${overrides.id}`,
  category: [],
  project: null,
  events: [],
  ...overrides,
});

const names = (actions: SpotlightAction[]) => actions.map((a) => a.name);

describe("categoryCounts", () => {
  it("lists only used categories, in Environment-to-Meta order, with counts", () => {
    const counts = categoryCounts([
      action({ id: 1, name: "A", category: ["meta", "poverty"] }),
      action({ id: 2, name: "B", category: ["poverty"] }),
      action({ id: 3, name: "C", category: ["environment"] }),
    ]);
    expect(counts).toEqual([
      { category: "environment", count: 1 },
      { category: "poverty", count: 2 },
      { category: "meta", count: 1 },
    ]);
  });
});

describe("matchingCategories", () => {
  const counts = categoryCounts([
    action({
      id: 1,
      name: "A",
      category: ["environment", "democracy", "technology", "meta"],
    }),
  ]);

  it("returns every category for an empty query", () => {
    expect(matchingCategories(counts, "")).toEqual(counts);
  });

  it("fuzzy-matches category labels", () => {
    expect(
      matchingCategories(counts, "dmcr").map(({ category }) => category),
    ).toEqual(["democracy"]);
  });
});

describe("searchActions", () => {
  it("lists nothing for an empty unscoped query", () => {
    expect(
      searchActions({
        actions: [action({ id: 1, name: "Anything" })],
        query: "",
        category: null,
      }),
    ).toEqual([]);
  });

  it("ranks name matches above slug and project matches", () => {
    const results = searchActions({
      actions: [
        action({ id: 1, name: "Other", slug: "vote-drive" }),
        action({
          id: 2,
          name: "Phone bank",
          project: { id: 1, name: "Vote 2026", category: [] },
        }),
        action({ id: 3, name: "Register to vote" }),
      ],
      query: "vote",
      category: null,
    });
    expect(names(results)[0]).toBe("Register to vote");
    expect(names(results).sort()).toEqual(
      ["Other", "Phone bank", "Register to vote"].sort(),
    );
  });

  it("lists the action with an exactly matching ID first", () => {
    const results = searchActions({
      actions: [
        action({ id: 7, name: "Raise 183 signatures" }),
        action({ id: 183, name: "Phone bank" }),
        action({ id: 1830, name: "Other", slug: "other" }),
      ],
      query: "183",
      category: null,
    });
    expect(names(results)).toEqual(["Phone bank", "Raise 183 signatures"]);
  });

  it("keeps an ID match inside the scoped category", () => {
    expect(
      searchActions({
        actions: [
          action({ id: 183, name: "Phone bank", category: ["poverty"] }),
        ],
        query: "183",
        category: "democracy",
      }),
    ).toEqual([]);
  });

  it("does not match on category text", () => {
    expect(
      searchActions({
        actions: [
          action({ id: 1, name: "Plant trees", category: ["poverty"] }),
        ],
        query: "poverty",
        category: null,
      }),
    ).toEqual([]);
  });

  it("matches fuzzily", () => {
    expect(
      names(
        searchActions({
          actions: [action({ id: 1, name: "Call your senator" })],
          query: "clsen",
          category: null,
        }),
      ),
    ).toEqual(["Call your senator"]);
  });

  it("limits a scoped search to the category", () => {
    expect(
      names(
        searchActions({
          actions: [
            action({ id: 1, name: "Vote A", category: ["democracy"] }),
            action({ id: 2, name: "Vote B", category: ["poverty"] }),
          ],
          query: "vote",
          category: "democracy",
        }),
      ),
    ).toEqual(["Vote A"]);
  });

  it("lists a scoped category's first actions latest launch first", () => {
    const actions = Array.from({ length: SPOTLIGHT_RESULT_LIMIT + 2 }, (_, i) =>
      action({
        id: i,
        name: `Action ${i}`,
        category: ["democracy"],
        events: launchedOn(`2026-01-${String(i + 1).padStart(2, "0")}`),
      }),
    );
    const results = searchActions({
      actions,
      query: "",
      category: "democracy",
    });
    expect(results).toHaveLength(SPOTLIGHT_RESULT_LIMIT);
    expect(results[0].name).toBe(`Action ${SPOTLIGHT_RESULT_LIMIT + 1}`);
  });

  it("caps results", () => {
    const actions = Array.from({ length: 20 }, (_, i) =>
      action({ id: i, name: `Vote ${i}` }),
    );
    expect(
      searchActions({ actions, query: "vote", category: null }),
    ).toHaveLength(SPOTLIGHT_RESULT_LIMIT);
  });
});
