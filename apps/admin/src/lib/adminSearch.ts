import type {
  AdminActionListItemDto,
  CommunityDto,
  FormSummaryDto,
  UserDto,
} from "@alliance/shared/client";
import { href } from "react-router";
import { memberSearchMatcher } from "./memberSearch";

export enum SearchKind {
  Page = "page",
  Action = "action",
  Suite = "suite",
  Member = "member",
  Form = "form",
  Group = "group",
}

export const SEARCH_KIND_LABELS: Record<SearchKind, string> = {
  [SearchKind.Page]: "Page",
  [SearchKind.Action]: "Task",
  [SearchKind.Suite]: "Suite",
  [SearchKind.Member]: "Member",
  [SearchKind.Form]: "Form",
  [SearchKind.Group]: "Group",
};

export type SearchResult = {
  kind: SearchKind;
  label: string;
  detail: string | null;
  to: string;
};

export type SearchPage = {
  label: string;
  folder: string | null;
  to: string;
  /** What staff called the page before; the result names the one that matched. */
  oldNames?: readonly string[];
  /** Other words it is found by, ranked as old names are and never shown. */
  keywords?: readonly string[];
};

const PER_KIND = 5;
const PAGES = 8;

/**
 * How well a page answers the query, lower first: its name or an old name
 * exactly, its name from the start, an old name from the start, either one
 * anywhere, its folder's name. A keyword counts as an old name, but isn't
 * reported as one. Null when it doesn't.
 */
const pageMatch = (
  page: SearchPage,
  lower: string,
): { rank: number; oldName: string | null } | null => {
  const label = page.label.toLowerCase();
  const others = [
    ...(page.oldNames ?? []).map((name) => ({ name, former: true })),
    ...(page.keywords ?? []).map((name) => ({ name, former: false })),
  ];
  const other = (rank: number, test: (name: string) => boolean) => {
    const found = others.find(({ name }) => test(name.toLowerCase()));
    return found && { rank, oldName: found.former ? found.name : null };
  };
  if (label === lower) return { rank: 0, oldName: null };
  const exact = other(0, (name) => name === lower);
  if (exact) return exact;
  if (label.startsWith(lower)) return { rank: 1, oldName: null };
  const start = other(2, (name) => name.startsWith(lower));
  if (start) return start;
  if (label.includes(lower)) return { rank: 3, oldName: null };
  const any = other(3, (name) => name.includes(lower));
  if (any) return any;
  return page.folder?.toLowerCase() === lower
    ? { rank: 4, oldName: null }
    : null;
};

/** Name matches, or the whole query is the id. */
const matcher = (rawQuery: string) => {
  const query = rawQuery.toLowerCase().trim();
  return (item: { id: number; name: string }) =>
    item.name.toLowerCase().includes(query) || String(item.id) === query;
};

const startsFirst = <T>(
  items: readonly T[],
  label: (item: T) => string,
  query: string,
) => {
  const lower = query.toLowerCase().trim();
  return [...items]
    .sort(
      (a, b) =>
        Number(!label(a).toLowerCase().startsWith(lower)) -
        Number(!label(b).toLowerCase().startsWith(lower)),
    )
    .slice(0, PER_KIND);
};

export const adminSearchResults = ({
  query,
  pages,
  actions,
  suites,
  members,
  forms,
  groups,
}: {
  query: string;
  pages: readonly SearchPage[];
  actions: readonly (Pick<
    AdminActionListItemDto,
    "id" | "name" | "archived"
  > & {
    suite?: { name: string };
  })[];
  suites: readonly { id: number; name: string }[];
  members: readonly Pick<UserDto, "id" | "name" | "email" | "phoneNumber">[];
  forms: readonly Pick<FormSummaryDto, "id" | "title" | "usedInAction">[];
  groups: readonly Pick<CommunityDto, "id" | "name">[];
}): SearchResult[] => {
  if (!query.trim()) return [];
  const matches = matcher(query);
  const isMember = memberSearchMatcher(query);
  const lower = query.toLowerCase().trim();
  return [
    ...pages
      .flatMap((page) => {
        const match = pageMatch(page, lower);
        return match ? [{ page, ...match }] : [];
      })
      .sort((a, b) => a.rank - b.rank)
      // A first tab or view has its place's URL; the best match stands for both.
      .filter(
        ({ page }, index, sorted) =>
          sorted.findIndex((other) => other.page.to === page.to) === index,
      )
      .slice(0, PAGES)
      .map(({ page, oldName }) => ({
        kind: SearchKind.Page,
        label: page.label,
        detail: oldName ? `Was ${oldName}` : page.folder,
        to: page.to,
      })),
    ...startsFirst(actions.filter(matches), (a) => a.name, query).map(
      (action) => ({
        kind: SearchKind.Action,
        label: action.name,
        detail:
          [action.suite?.name, action.archived && "Archived"]
            .filter(Boolean)
            .join(" · ") || null,
        to: href("/tasks/:actionId", { actionId: String(action.id) }),
      }),
    ),
    ...startsFirst(suites.filter(matches), (s) => s.name, query).map(
      (suite) => ({
        kind: SearchKind.Suite,
        label: suite.name,
        detail: null,
        to: href("/tasks/suites/:suiteId", { suiteId: String(suite.id) }),
      }),
    ),
    ...startsFirst(
      members.filter(
        (member) => isMember(member) || String(member.id) === lower,
      ),
      (m) => m.name,
      query,
    ).map((member) => ({
      kind: SearchKind.Member,
      label: member.name,
      detail: member.email,
      to: href("/members/:userId", { userId: String(member.id) }),
    })),
    ...startsFirst(
      forms.filter((form) => matches({ id: form.id, name: form.title })),
      (f) => f.title,
      query,
    ).map((form) => ({
      kind: SearchKind.Form,
      label: form.title,
      detail: form.usedInAction?.name ?? null,
      to: href("/tasks/forms/:formId", { formId: String(form.id) }),
    })),
    ...startsFirst(groups.filter(matches), (g) => g.name, query).map(
      (group) => ({
        kind: SearchKind.Group,
        label: group.name,
        detail: null,
        to: href("/members/groups/:id", { id: String(group.id) }),
      }),
    ),
  ];
};
