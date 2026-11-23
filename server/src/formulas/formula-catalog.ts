import type {
  Catalog,
  MemberListName,
} from "@alliance/common/expression/catalog";
import { currentLists } from "src/member-lists/member-list-store";
import type { EntityManager } from "typeorm";

/**
 * What formulas can read that engineers define. Inputs arrive with the
 * changes that add them (previous answers, lookup tables); the deploy re-check
 * runs every stored formula against this before a release goes live.
 */
const FORMULA_CATALOG: Omit<Catalog, "lists"> = { inputs: [], functions: [] };

export const catalogWith = (lists: readonly MemberListName[]): Catalog => ({
  ...FORMULA_CATALOG,
  lists: lists.map(({ id, name }) => ({ id, name })),
});

/** `FORMULA_CATALOG` with the member lists that exist now. */
export async function formulaCatalog(manager: EntityManager): Promise<Catalog> {
  return catalogWith(await currentLists(manager));
}
