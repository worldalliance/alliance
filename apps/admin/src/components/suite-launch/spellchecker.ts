import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryOptions } from "@tanstack/react-query";

export const spellcheckerQuery = queryOptions({
  queryKey: queryKeys.spellcheckerAdmin(),
  queryFn: async () => {
    const [{ default: Typo }, { default: aff }, { default: dic }] =
      await Promise.all([
        import("typo-js"),
        import("typo-js/dictionaries/en_US/en_US.aff?raw"),
        import("typo-js/dictionaries/en_US/en_US.dic?raw"),
      ]);
    const dictionary = new Typo("en_US", aff, dic);
    return (word: string) => dictionary.check(word);
  },
  staleTime: Infinity,
});
