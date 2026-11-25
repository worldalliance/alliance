import { useCallback } from "react";
import { useSearchParams } from "react-router";
import { RoleFilter } from "../../lib/memberRoleFilter";
import { CompletionFilter, ContractFilter } from "./progressRules";

export enum PeopleParam {
  Search = "q",
  Role = "role",
  Tag = "tag",
  Contract = "contract",
  Completion = "status",
  Shuffle = "shuffle",
  Page = "page",
}

/** Today's default: the list opens on signed members. */
export const DEFAULT_CONTRACT = ContractFilter.Signed;

const oneOf = <T extends string>(
  values: readonly T[],
  raw: string | null,
): T | undefined => values.find((value) => value === raw);

/** The All tab's search, filters, order and page, as the URL holds them. */
export function readPeopleFilters(params: URLSearchParams) {
  const roles = Object.values(RoleFilter);
  const page = Number(params.get(PeopleParam.Page));
  return {
    q: params.get(PeopleParam.Search) ?? "",
    roles: params
      .getAll(PeopleParam.Role)
      .flatMap((raw) => oneOf(roles, raw) ?? []),
    tagIds: params.getAll(PeopleParam.Tag),
    contract:
      oneOf(Object.values(ContractFilter), params.get(PeopleParam.Contract)) ??
      DEFAULT_CONTRACT,
    completion:
      oneOf(
        Object.values(CompletionFilter),
        params.get(PeopleParam.Completion),
      ) ?? CompletionFilter.Any,
    shuffleSeed: params.get(PeopleParam.Shuffle),
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

export type PeopleFilters = ReturnType<typeof readPeopleFilters>;

/** Writes one param from the current ones, dropping it at its default. */
const writeParam = (
  next: URLSearchParams,
  param: PeopleParam,
  value: string | readonly string[] | null,
  fallback?: string,
) => {
  next.delete(param);
  if (value === null || value === fallback) return;
  for (const one of typeof value === "string" ? [value] : value) {
    if (one) next.append(param, one);
  }
};

/**
 * The All tab's filters bound to the URL. Every change replaces the history
 * entry, and a change to what is listed clears the shuffle and the page.
 */
export function usePeopleFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readPeopleFilters(searchParams);
  const update = useCallback(
    (
      change: (next: URLSearchParams) => void,
      { keepOrder = false }: { keepOrder?: boolean } = {},
    ) =>
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          change(next);
          if (!keepOrder) next.delete(PeopleParam.Shuffle);
          next.delete(PeopleParam.Page);
          return next;
        },
        { replace: true },
      ),
    [setSearchParams],
  );
  return {
    filters,
    setQ: useCallback(
      (q: string) =>
        update((next) => writeParam(next, PeopleParam.Search, q, "")),
      [update],
    ),
    setRoles: (roles: RoleFilter[]) =>
      update((next) => writeParam(next, PeopleParam.Role, roles)),
    setTagIds: (tagIds: string[]) =>
      update((next) => writeParam(next, PeopleParam.Tag, tagIds)),
    setContract: (contract: ContractFilter) =>
      update((next) =>
        writeParam(next, PeopleParam.Contract, contract, DEFAULT_CONTRACT),
      ),
    setCompletion: (completion: CompletionFilter) =>
      update((next) =>
        writeParam(
          next,
          PeopleParam.Completion,
          completion,
          CompletionFilter.Any,
        ),
      ),
    shuffle: () =>
      update(
        (next) =>
          writeParam(
            next,
            PeopleParam.Shuffle,
            Math.random().toString(36).slice(2, 12),
          ),
        { keepOrder: true },
      ),
    setPage: (page: number) =>
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          writeParam(next, PeopleParam.Page, String(page), "1");
          return next;
        },
        { replace: true },
      ),
    clearFilters: () =>
      update((next) => {
        for (const param of [
          PeopleParam.Search,
          PeopleParam.Role,
          PeopleParam.Tag,
          PeopleParam.Contract,
          PeopleParam.Completion,
        ]) {
          next.delete(param);
        }
      }),
  };
}

/** Search, roles, tags, or a contract or status other than the default. */
export const hasActiveFilters = (filters: PeopleFilters) =>
  filters.q.trim() !== "" ||
  filters.roles.length > 0 ||
  filters.tagIds.length > 0 ||
  filters.contract !== DEFAULT_CONTRACT ||
  filters.completion !== CompletionFilter.Any;
