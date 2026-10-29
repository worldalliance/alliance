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
  [SearchKind.Action]: "Action",
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

export type SearchPage = { label: string; folder: string | null; to: string };

const PER_KIND = 5;

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
    ...startsFirst(
      pages.filter((page) => page.label.toLowerCase().includes(lower)),
      (page) => page.label,
      query,
    ).map((page) => ({
      kind: SearchKind.Page,
      label: page.label,
      detail: page.folder,
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
        to: href("/actions/:actionId", { actionId: String(action.id) }),
      }),
    ),
    ...startsFirst(suites.filter(matches), (s) => s.name, query).map(
      (suite) => ({
        kind: SearchKind.Suite,
        label: suite.name,
        detail: null,
        to: href("/suites/:suiteId", { suiteId: String(suite.id) }),
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
      to: href("/member/:userId", { userId: String(member.id) }),
    })),
    ...startsFirst(
      forms.filter((form) => matches({ id: form.id, name: form.title })),
      (f) => f.title,
      query,
    ).map((form) => ({
      kind: SearchKind.Form,
      label: form.title,
      detail: form.usedInAction?.name ?? null,
      to: href("/forms/:formId", { formId: String(form.id) }),
    })),
    ...startsFirst(groups.filter(matches), (g) => g.name, query).map(
      (group) => ({
        kind: SearchKind.Group,
        label: group.name,
        detail: null,
        to: href("/groups/:id", { id: String(group.id) }),
      }),
    ),
  ];
};
