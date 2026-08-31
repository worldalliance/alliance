import {
  formSchema,
  type FormSchema,
} from "@alliance/common/forms/form-schema";
import { validateFormSchema } from "@alliance/common/forms/form-schema-validate";
import { R, type Result } from "@alliance/common/result";
import jsonStableStringify from "json-stable-stringify";

/**
 * This is a *structural* three-way merge: it aligns objects by key and keyed
 * lists by item `id` at any depth, without knowing the specific FormSchema
 * field kinds. The precise type for the values it walks is therefore not the
 * FormSchema unions but `JsonValue` — the closed set of shapes parsed JSON can
 * take. At runtime every value here comes from `JSON.parse` / a network
 * response, so it is genuinely JSON. `JsonValue | undefined` shows up wherever
 * a value may be a missing object key or an absent map entry.
 */
type JsonPrimitive = string | number | boolean | null | undefined;
type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;
type JsonObject = { [key: string]: JsonValue };

/** Paths whose arrays merge by item id. */
const KEYED_LIST_PATHS = new Set<string>([
  "pages",
  "pages[].fields",
  "pages[].fields[].fields",
  "pages[].fields[].sections",
  "pages[].fields[].sections[].blocks",
  "outputViews",
  "outputViews[].blocks",
  "aggregateViews",
]);

const canon = (value: JsonValue | undefined): string =>
  jsonStableStringify(value ?? null) ?? "null";

const eq = (a: JsonValue | undefined, b: JsonValue | undefined): boolean =>
  canon(a) === canon(b);

const isPlainObject = (v: JsonValue | undefined): v is JsonObject =>
  typeof v === "object" && v !== null && !Array.isArray(v);

type Ctx = { conflicts: string[] };

const idOf = (item: JsonValue | undefined): string | null =>
  isPlainObject(item) && typeof item.id === "string" ? item.id : null;

function duplicateIds(items: JsonValue[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const item of items) {
    const id = idOf(item);
    if (id === null) continue;
    if (seen.has(id)) {
      duplicates.add(id);
    } else {
      seen.add(id);
    }
  }
  return [...duplicates];
}

function merge3(
  base: JsonValue | undefined,
  mine: JsonValue | undefined,
  theirs: JsonValue | undefined,
  path: string,
  ctx: Ctx,
): JsonValue | undefined {
  if (eq(mine, theirs)) return mine;
  if (eq(mine, base)) return theirs;
  if (eq(theirs, base)) return mine;

  if (
    KEYED_LIST_PATHS.has(path) &&
    Array.isArray(mine) &&
    Array.isArray(theirs)
  ) {
    return mergeKeyedList(
      Array.isArray(base) ? base : [],
      mine,
      theirs,
      path,
      ctx,
    );
  }

  if (isPlainObject(mine) && isPlainObject(theirs)) {
    const baseObj: JsonObject = isPlainObject(base) ? base : {};
    const out: JsonObject = {};
    const keys = new Set([
      ...Object.keys(baseObj),
      ...Object.keys(mine),
      ...Object.keys(theirs),
    ]);
    for (const key of keys) {
      const merged = merge3(
        baseObj[key],
        mine[key],
        theirs[key],
        path ? `${path}.${key}` : key,
        ctx,
      );
      if (merged !== undefined) out[key] = merged;
    }
    return out;
  }

  // Both sides changed a primitive, non-keyed array, or type.
  ctx.conflicts.push(path || "<root>");
  return mine;
}

function mergeKeyedList(
  base: JsonValue[],
  mine: JsonValue[],
  theirs: JsonValue[],
  path: string,
  ctx: Ctx,
): JsonValue[] {
  // Ids are required to align items.
  if ([...base, ...mine, ...theirs].some((item) => idOf(item) === null)) {
    ctx.conflicts.push(`${path} (list contains items without ids)`);
    return mine;
  }

  const duplicateEntries: Array<[string, string[]]> = [
    ["base", duplicateIds(base)],
    ["yours", duplicateIds(mine)],
    ["theirs", duplicateIds(theirs)],
  ];
  const duplicateMessages = duplicateEntries
    .filter(([, ids]) => ids.length > 0)
    .map(([side, ids]) => `${side}: ${ids.join(", ")}`);
  if (duplicateMessages.length > 0) {
    ctx.conflicts.push(
      `${path} (duplicate ids: ${duplicateMessages.join("; ")})`,
    );
    return mine;
  }

  const baseMap = new Map(base.map((i): [string, JsonValue] => [idOf(i)!, i]));
  const mineMap = new Map(mine.map((i): [string, JsonValue] => [idOf(i)!, i]));
  const theirsMap = new Map(
    theirs.map((i): [string, JsonValue] => [idOf(i)!, i]),
  );
  const baseIds = base.map((i) => idOf(i)!);
  const mineIds = mine.map((i) => idOf(i)!);
  const theirsIds = theirs.map((i) => idOf(i)!);

  // Structural changes affect list membership or order.
  const isStructural = (
    sideIds: string[],
    sideMap: Map<string, JsonValue>,
  ): boolean => {
    const removedBaseItem = baseIds.some((id) => !sideMap.has(id));
    if (removedBaseItem) return true;
    const addedNewItem = sideIds.some((id) => !baseMap.has(id));
    if (addedNewItem) return true;
    const baseSurviving = baseIds.filter((id) => sideMap.has(id));
    const sideBaseOrder = sideIds.filter((id) => baseMap.has(id));
    return canon(baseSurviving) !== canon(sideBaseOrder);
  };

  const mineStructural = isStructural(mineIds, mineMap);
  const theirsStructural = isStructural(theirsIds, theirsMap);

  // Skeleton carries final membership/order; items still merge.
  let skeleton: string[];
  if (canon(mineIds) === canon(theirsIds)) {
    // Same final order is safe even if both changed structure.
    skeleton = mineIds;
  } else if (mineStructural && theirsStructural) {
    ctx.conflicts.push(`${path} (both reordered/added/removed items)`);
    return mine;
  } else if (mineStructural) {
    skeleton = mineIds;
    for (const id of baseIds) {
      if (
        !mineMap.has(id) &&
        theirsMap.has(id) &&
        !eq(theirsMap.get(id), baseMap.get(id))
      ) {
        ctx.conflicts.push(
          `${path}#${id} (you removed an item the other person edited)`,
        );
      }
    }
  } else if (theirsStructural) {
    skeleton = theirsIds;
    for (const id of baseIds) {
      if (
        !theirsMap.has(id) &&
        mineMap.has(id) &&
        !eq(mineMap.get(id), baseMap.get(id))
      ) {
        ctx.conflicts.push(
          `${path}#${id} (the other person removed an item you edited)`,
        );
      }
    }
  } else {
    skeleton = baseIds;
  }

  const out: JsonValue[] = [];
  for (const id of skeleton) {
    const merged = merge3(
      baseMap.get(id),
      mineMap.get(id),
      theirsMap.get(id),
      `${path}[]`,
      ctx,
    );
    if (merged !== undefined) out.push(merged);
  }
  return out;
}

/** Three-way merge; overlapping edits return conflicts. */
export function mergeFormSchemas(
  base: FormSchema,
  mine: FormSchema,
  theirs: FormSchema,
): Result<FormSchema, string[]> {
  const ctx: Ctx = { conflicts: [] };
  const merged = merge3(base, mine, theirs, "", ctx);

  if (ctx.conflicts.length > 0) {
    return R.failure(Array.from(new Set(ctx.conflicts)));
  }

  // Reject invalid structural merges.
  const parsed = formSchema.safeParse(merged);
  if (!parsed.success) {
    return R.failure(["The merged result is not a valid form schema"]);
  }

  const refErrors = validateFormSchema(parsed.data);
  if (refErrors.length > 0) {
    return R.failure(refErrors.map((e) => `${e.blockId}: ${e.message}`));
  }

  return R.success(parsed.data);
}
