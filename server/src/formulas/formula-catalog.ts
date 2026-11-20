import type { Catalog } from "@alliance/common/expression/catalog";

/**
 * What formulas can read. Inputs arrive with the changes that add them
 * (previous answers, member lists, lookup tables); the deploy re-check runs
 * every stored formula against this before a release goes live.
 */
export const FORMULA_CATALOG: Catalog = { inputs: [], functions: [] };
