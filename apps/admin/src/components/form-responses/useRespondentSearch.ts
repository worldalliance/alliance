import type { FormResponseDto } from "@alliance/shared/client";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type RespondentSearch = ReturnType<typeof useRespondentSearch>;

export function useRespondentSearch(params: {
  responses: FormResponseDto[];
  getRespondentName: (response: FormResponseDto) => string;
  onSelect: (index: number) => void;
}) {
  const { responses, getRespondentName, onSelect } = params;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      setOpen(false);
    },
    [onSelect],
  );

  const handleKeyDown = useCallback(
    (e: Pick<React.KeyboardEvent, "key" | "preventDefault">) => {
      if (e.key === "Enter" && results.length > 0) {
        e.preventDefault();
        select(results[0].idx);
      }
    },
    [results, select],
  );

  return {
    query,
    setQuery,
    open,
    setOpen,
    containerRef,
    results,
    select,
    handleKeyDown,
  };
}
