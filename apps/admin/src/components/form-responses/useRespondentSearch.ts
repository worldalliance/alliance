import type { FormResponseDto } from "@alliance/shared/client";
import { useCallback, useMemo, useState } from "react";

export type RespondentSearch = ReturnType<typeof useRespondentSearch>;

/** How many results the list shows. */
export const RESPONDENT_RESULT_LIMIT = 50;

export function useRespondentSearch(params: {
  responses: FormResponseDto[];
  getRespondentName: (response: FormResponseDto) => string;
  onSelect: (index: number) => void;
}) {
  const { responses, getRespondentName, onSelect } = params;
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const lowered = query.toLowerCase();
    const items = responses.map((response, idx) => ({
      response,
      idx,
      name: getRespondentName(response),
    }));
    if (!lowered) return items;
    const matched = items.filter(({ name }) =>
      name.toLowerCase().includes(lowered),
    );
    matched.sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(lowered) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(lowered) ? 0 : 1;
      return aStarts - bStarts;
    });
    return matched;
  }, [responses, query, getRespondentName]);

  const select = useCallback(
    (index: number) => {
      onSelect(index);
      setQuery("");
    },
    [onSelect],
  );

  return { query, setQuery, results, select };
}
