import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";

const ALLIANCE_WORDS = new Set(["grantmaking", "grantmaker", "grantmakers"]);

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
    // Hunspell knows inflections; the long list knows newer and compound words.
    const wordList = new Set(z.array(z.string()).parse(JSON.parse(words)));
    return (word: string) =>
      ALLIANCE_WORDS.has(word) || wordList.has(word) || dictionary.check(word);
  },
  staleTime: Infinity,
});
