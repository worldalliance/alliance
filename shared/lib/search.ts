import {
  searchAll,
  SearchItemDto,
  SearchItemType,
} from "@alliance/shared/client";
import { groupBy } from "es-toolkit";
import { useEffect, useState } from "react";

export const SEARCH_CATEGORIES: SearchItemType[] = [
  "recent",
  "user",
  "action",
  "post",
  "page",
  "other",
];

export const SEARCH_CATEGORY_NAMES: Record<SearchItemType, string> = {
  user: "Users",
  action: "Actions",
  post: "Posts",
  recent: "Recent Searches",
  page: "Pages",
  other: "Other",
};

export const createEmptySearchCategories = (): Record<
  SearchItemType,
  SearchItemDto[]
> => ({
  recent: [],
  user: [],
  action: [],
  post: [],
  page: [],
  other: [],
});

export const groupSearchItems = (items: SearchItemDto[]) => {
  const grouped = {
    ...createEmptySearchCategories(),
    ...groupBy(items, (item) => item.type),
  };

  const ordered = [
    ...grouped.recent,
    ...grouped.user,
    ...grouped.action,
    ...grouped.post,
    ...grouped.page,
    ...grouped.other,
  ];

  return { grouped, ordered };
};

export const getSearchCategoriesWithItems = (
  grouped: Record<SearchItemType, SearchItemDto[]>,
) => SEARCH_CATEGORIES.filter((category) => grouped[category]?.length > 0);

export const getSearchSecondaryText = (
  secondaryData?: SearchItemDto["secondaryData"],
) => {
  if (!secondaryData || secondaryData.length === 0) return "";
  const flattened = Array.isArray(secondaryData[0])
    ? (secondaryData as Array<Array<unknown>>).flat()
    : (secondaryData as Array<unknown>);
  return flattened
    .map((value) => {
      if (typeof value === "string") return value;
      if (typeof value === "number") return value.toString();
      if (typeof value === "boolean") return value ? "Yes" : "No";
      if (value === null || value === undefined) return "";
      return String(value);
    })
    .filter(Boolean)
    .join(", ");
};

type UseSearchResultsOptions = {
  debounceMs?: number;
  autoselectFirst?: boolean;
};

export const useSearchResults = (
  query: string,
  options?: UseSearchResultsOptions,
) => {
  const debounceMs = options?.debounceMs ?? 50;
  const autoselectFirst = options?.autoselectFirst ?? true;
  const [items, setItems] = useState<SearchItemDto[]>([]);
  const [itemsByCategory, setItemsByCategory] = useState(
    createEmptySearchCategories,
  );
  const [selectedItem, setSelectedItem] = useState<SearchItemDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    if (!query.length) {
      setItems([]);
      setItemsByCategory(createEmptySearchCategories());
      setSelectedItem(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const timeout = setTimeout(() => {
      setError(null);
      searchAll({ query: { query } })
        .then((response) => {
          if (cancelled) return;
          const { grouped, ordered } = groupSearchItems(response.data ?? []);

          setItems(ordered);
          setItemsByCategory(grouped);
          setSelectedItem(autoselectFirst ? (ordered[0] ?? null) : null);
        })
        .catch((err) => {
          if (cancelled) return;
          setItems([]);
          setItemsByCategory(createEmptySearchCategories());
          setSelectedItem(null);
          setError(err);
        })
        .finally(() => {
          if (cancelled) return;
          setLoading(false);
        });
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [autoselectFirst, debounceMs, query]);

  return {
    items,
    itemsByCategory,
    selectedItem,
    setSelectedItem,
    loading,
    error,
  };
};
