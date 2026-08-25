import type {
  FormValue,
  ListFieldValue,
} from "@alliance/common/forms/form-schema";
import { resolveFormValue, type FormValueUpdater } from "./formValueUpdater";

/**
 * Client-only identity for a list card, so an async write (an image upload)
 * still targets the card the user picked for after other cards were added or
 * deleted. Stripped from the answers before they leave the client.
 */
export const CARD_ID_KEY = "__cardId";

export type IdentifiedCard = Record<string, FormValue> & {
  [CARD_ID_KEY]: string;
};

export function asCards(value: FormValue | undefined): ListFieldValue | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value.every(
    (item): item is Record<string, FormValue> =>
      item !== null && typeof item === "object" && !Array.isArray(item),
  )
    ? value
    : null;
}

export function cardIdOf(card: Record<string, FormValue>): string | undefined {
  const id = card[CARD_ID_KEY];
  return typeof id === "string" ? id : undefined;
}

function isIdentified(card: Record<string, FormValue>): card is IdentifiedCard {
  return typeof card[CARD_ID_KEY] === "string";
}

let cardsAdded = 0;

/**
 * An id for a card the user just added. The counter only moves forward, so an
 * upload still in flight for a deleted card cannot land on the card that took
 * its place, and `withCardIds` only ever hands out `c…`, so the two families
 * never collide. It skips past ids a previous session persisted, since a
 * reload puts the counter back to zero.
 */
export function newCardId(cards: ListFieldValue): string {
  const used = new Set(cards.map(cardIdOf));
  do {
    cardsAdded += 1;
  } while (used.has(`n${cardsAdded}`));
  return `n${cardsAdded}`;
}

/**
 * Stamps an id onto every card that lacks one. Deterministic, so cards keep
 * the same ids across renders until a write persists them.
 */
export function withCardIds(cards: ListFieldValue): IdentifiedCard[] {
  if (cards.every(isIdentified)) {
    return cards;
  }
  const used = new Set(
    cards.filter(isIdentified).map((card) => card[CARD_ID_KEY]),
  );
  return cards.map((card) => {
    if (isIdentified(card)) {
      return card;
    }
    for (let n = 0; ; n += 1) {
      const id = `c${n}`;
      if (!used.has(id)) {
        used.add(id);
        return { ...card, [CARD_ID_KEY]: id };
      }
    }
  });
}

/**
 * The cards a list field renders for an answer: the schema's defaults while
 * the answer is still undefined, each carrying an id.
 */
export function resolveCards(params: {
  value: FormValue | undefined;
  defaultCardCount: number;
}): IdentifiedCard[] {
  const { value, defaultCardCount } = params;
  if (value === undefined) {
    return withCardIds(
      Array.from({ length: Math.max(0, defaultCardCount) }, () => ({})),
    );
  }
  return withCardIds(asCards(value) ?? []);
}

export function stripCardIds(
  answers: Record<string, FormValue>,
): Record<string, FormValue> {
  const stripped: Record<string, FormValue> = {};
  for (const [fieldId, value] of Object.entries(answers)) {
    const cards = asCards(value);
    if (!cards) {
      stripped[fieldId] = value;
      continue;
    }
    stripped[fieldId] = cards.map((card) => {
      if (cardIdOf(card) === undefined) {
        return card;
      }
      const rest = { ...card };
      delete rest[CARD_ID_KEY];
      return rest;
    });
  }
  return stripped;
}

export type ListCardWriters = {
  addCard: () => void;
  removeCard: (cardId: string) => void;
  updateCard: (params: {
    cardId: string;
    subFieldId: string;
    value: FormValueUpdater;
  }) => void;
};

/**
 * The writes a list field makes to its own answer. Every one of them resolves
 * the cards from the answer as it stands rather than from the render that
 * built them, so an upload landing mid-edit isn't clobbered.
 */
export function listCardWriters(params: {
  onChange: ((value: FormValueUpdater) => void) | undefined;
  defaultCardCount: number;
  maxCards: number;
}): ListCardWriters {
  const { onChange, defaultCardCount, maxCards } = params;

  const write = (update: (previous: IdentifiedCard[]) => ListFieldValue) => {
    onChange?.((previous) =>
      update(resolveCards({ value: previous, defaultCardCount })),
    );
  };

  return {
    addCard: () =>
      write((previous) =>
        previous.length >= maxCards
          ? previous
          : [...previous, { [CARD_ID_KEY]: newCardId(previous) }],
      ),

    removeCard: (cardId) =>
      write((previous) =>
        previous.filter((card) => card[CARD_ID_KEY] !== cardId),
      ),

    updateCard: ({ cardId, subFieldId, value }) =>
      write((previous) => {
        const index = previous.findIndex(
          (card) => card[CARD_ID_KEY] === cardId,
        );
        if (index === -1) {
          return previous;
        }
        const next = [...previous];
        next[index] = {
          ...next[index],
          [subFieldId]: resolveFormValue(value, next[index][subFieldId]),
        };
        return next;
      }),
  };
}
