import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

const ALLIANCE_WORDS = new Set(["grantmaking", "grantmaker", "grantmakers"]);

// Rare or archaic words in the long list that are mostly typos in practice.
const LIST_TYPOS = new Set([
  "wich",
  "wether",
  "persue",
  "calender",
  "publically",
  "theres",
  "heres",
  "hight",
  "lense",
  "alledge",
  "belive",
  "heighth",
  "miniscule",
  "underate",
  "accidently",
  "cieling",
  "momento",
  "supercede",
]);

// Hunspell knows inflections; the long list knows newer and compound words.
export const knownWordChecker =
  (params: {
    wordList: ReadonlySet<string>;
    hunspellKnows: (word: string) => boolean;
  }) =>
  (word: string) =>
    ALLIANCE_WORDS.has(word) ||
    (params.wordList.has(word) && !LIST_TYPOS.has(word)) ||
    params.hunspellKnows(word);

export const spellcheckerQuery = queryOptions({
  queryKey: queryKeys.spellcheckerAdmin(),
  queryFn: async () => {
    const [
      { default: Typo },
      { default: aff },
      { default: dic },
      { default: words },
    ] = await Promise.all([
      import("typo-js"),
      import("typo-js/dictionaries/en_US/en_US.aff?raw"),
      import("typo-js/dictionaries/en_US/en_US.dic?raw"),
      import("an-array-of-english-words/index.json?raw"),
    ]);
    const dictionary = new Typo("en_US", aff, dic);
    return knownWordChecker({
      wordList: new Set(z.array(z.string()).parse(JSON.parse(words))),
      hunspellKnows: (word) => dictionary.check(word),
    });
  },
  staleTime: Infinity,
});
