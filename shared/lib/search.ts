import { SearchItemDto, SearchItemType } from "@alliance/shared/client";
import { groupBy } from "es-toolkit";

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
