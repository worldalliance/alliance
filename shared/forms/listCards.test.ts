import type {
  FormValue,
  ListFieldValue,
} from "@alliance/common/forms/form-schema";
import {
  CARD_ID_KEY,
  listCardWriters,
  newCardId,
  resolveCards,
  stripCardIds,
  withCardIds,
} from "./listCards";

describe("withCardIds", () => {
  it("stamps every card that lacks an id", () => {
    expect(withCardIds([{ name: "a" }, { name: "b" }])).toEqual([
      { name: "a", [CARD_ID_KEY]: "c0" },
      { name: "b", [CARD_ID_KEY]: "c1" },
    ]);
  });

  it("is stable across calls, so ids survive re-renders", () => {
    const cards = [{ name: "a" }, { name: "b" }];
    expect(withCardIds(cards)).toEqual(withCardIds(cards));
  });

  it("leaves existing ids alone and avoids colliding with them", () => {
    expect(withCardIds([{ [CARD_ID_KEY]: "c1" }, { name: "b" }])).toEqual([
      { [CARD_ID_KEY]: "c1" },
      { name: "b", [CARD_ID_KEY]: "c0" },
    ]);
  });

  it("returns the same array when every card is already stamped", () => {
    const cards = [{ [CARD_ID_KEY]: "c0" }];
    expect(withCardIds(cards)).toBe(cards);
  });
});

describe("newCardId", () => {
  it("never repeats an id", () => {
    const ids = [newCardId([]), newCardId([]), newCardId([])];
    expect(new Set(ids).size).toBe(3);
  });

  it("cannot collide with the ids stamping hands out", () => {
    const stamped = withCardIds([{}, {}, {}]).map((card) => card[CARD_ID_KEY]);
    expect(stamped).not.toContain(newCardId([]));
  });

  it("does not reuse an id freed by a delete", () => {
    // Two cards on screen; the user deletes the first, then adds a fresh one.
    // Reusing the deleted card's id would land an upload still in flight for
    // it on the replacement.
    const shown = resolveCards({ value: undefined, defaultCardCount: 2 });
    const deletedId = shown[0][CARD_ID_KEY];
    const remaining = shown.filter((card) => card[CARD_ID_KEY] !== deletedId);
    const added = [...remaining, { [CARD_ID_KEY]: newCardId(remaining) }];

    expect(added.map((card) => card[CARD_ID_KEY])).not.toContain(deletedId);
  });

  it("skips ids a previous session persisted, since a reload resets it", () => {
    // Plant the next counter value to simulate an id restored from an earlier
    // session.
    const collision = `n${Number(newCardId([]).slice(1)) + 1}`;
    const restored = [{ [CARD_ID_KEY]: collision }];

    expect(newCardId(restored)).not.toBe(collision);
  });
});

describe("resolveCards", () => {
  it("materializes the schema defaults while the answer is undefined", () => {
    expect(resolveCards({ value: undefined, defaultCardCount: 2 })).toEqual([
      { [CARD_ID_KEY]: "c0" },
      { [CARD_ID_KEY]: "c1" },
    ]);
  });

  it("falls back to no cards when the answer is not a list of cards", () => {
    expect(resolveCards({ value: "nope", defaultCardCount: 2 })).toEqual([]);
  });
});

describe("stripCardIds", () => {
  it("removes the client-only ids from list answers", () => {
    expect(
      stripCardIds({
        pets: [
          { [CARD_ID_KEY]: "c0", name: "a" },
          { [CARD_ID_KEY]: "c1", name: "b" },
        ],
        name: "Charles",
      }),
    ).toEqual({ pets: [{ name: "a" }, { name: "b" }], name: "Charles" });
  });

  it("leaves other answer shapes untouched", () => {
    const answers = { picks: ["a", "b"], count: 2, agreed: true };
    expect(stripCardIds(answers)).toEqual(answers);
  });
});

describe("listCardWriters", () => {
  const harness = (
    params: { defaultCardCount?: number; maxCards?: number } = {},
  ) => {
    let answer: FormValue | undefined;
    const writers = listCardWriters({
      onChange: (value) => {
        answer = typeof value === "function" ? value(answer) : value;
      },
      defaultCardCount: params.defaultCardCount ?? 0,
      maxCards: params.maxCards ?? Infinity,
    });
    return {
      ...writers,
      answer: () => answer,
      seed: (value: FormValue) => {
        answer = value;
      },
    };
  };

  const ids = (answer: FormValue | undefined) =>
    (answer as ListFieldValue).map((card) => card[CARD_ID_KEY]);

  it("materializes the defaulted cards before appending a new one", () => {
    const list = harness({ defaultCardCount: 2 });
    list.addCard();
    expect(ids(list.answer())).toHaveLength(3);
    expect(new Set(ids(list.answer())).size).toBe(3);
  });

  it("refuses to add past the max", () => {
    const list = harness({ defaultCardCount: 1, maxCards: 1 });
    list.addCard();
    expect(list.answer()).toHaveLength(1);
  });

  it("removes the card the user pointed at", () => {
    const list = harness();
    list.seed([
      { [CARD_ID_KEY]: "c0", name: "a" },
      { [CARD_ID_KEY]: "c1", name: "b" },
    ]);
    list.removeCard("c0");
    expect(list.answer()).toEqual([{ [CARD_ID_KEY]: "c1", name: "b" }]);
  });

  it("writes a sub-field into its own card", () => {
    const list = harness();
    list.seed([{ [CARD_ID_KEY]: "c0" }, { [CARD_ID_KEY]: "c1" }]);
    list.updateCard({ cardId: "c1", subFieldId: "name", value: "b" });
    expect(list.answer()).toEqual([
      { [CARD_ID_KEY]: "c0" },
      { [CARD_ID_KEY]: "c1", name: "b" },
    ]);
  });

  it("resolves a functional update against the card's current value", () => {
    const list = harness();
    list.seed([{ [CARD_ID_KEY]: "c0", name: "a" }]);
    list.updateCard({
      cardId: "c0",
      subFieldId: "name",
      value: (previous) => `${previous ?? ""}!`,
    });
    expect(list.answer()).toEqual([{ [CARD_ID_KEY]: "c0", name: "a!" }]);
  });

  it("drops a write aimed at a card that is already gone", () => {
    const list = harness();
    list.seed([{ [CARD_ID_KEY]: "c0" }]);
    list.updateCard({ cardId: "c1", subFieldId: "name", value: "b" });
    expect(list.answer()).toEqual([{ [CARD_ID_KEY]: "c0" }]);
  });
});
