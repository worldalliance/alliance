import {
  ARRAY_METHODS,
  KNOWN_METHODS,
  NUMBER_METHODS,
  STRING_METHODS,
  type ArrayMethodName,
} from "../forms/formula-allowlist";
import type { Value } from "./catalog";
import {
  Failure,
  combine,
  evalError,
  finite,
  runEvery,
  type EvalFailure,
} from "./failure";
import { LAMBDA_ONLY_AS_ARGUMENT } from "./tree";

export type Lambda = (args: readonly Value[]) => Value;

export const COMPARES_PRIMITIVES_ONLY =
  "Only text, numbers and yes/no values can be compared.";
export const SHOWS_PRIMITIVES_ONLY =
  "Only text, numbers and yes/no values can be shown in text.";
export const SORTS_PRIMITIVES_ONLY =
  "Only text, numbers and yes/no values can be sorted without a function.";

export const isPrimitive = (value: Value) =>
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean";

type Verdicts = readonly (boolean | null)[];

enum ListRule {
  Plain,
  Concat,
  Join,
  Lookup,
  Predicate,
  EachItem,
  Reduce,
  Sort,
}

type ListMethod =
  | { rule: ListRule.Predicate; decided: (verdicts: Verdicts) => boolean }
  | {
      rule: ListRule.Lookup;
      settle: (lookup: { found: unknown; missing: unknown }) => Value;
    }
  | { rule: Exclude<ListRule, ListRule.Predicate | ListRule.Lookup> };

const firstMatchDecides = (verdicts: Verdicts) =>
  verdicts.includes(true) && verdicts.indexOf(true) < verdicts.indexOf(null);
const lastMatchDecides = (verdicts: Verdicts) =>
  verdicts.lastIndexOf(true) > verdicts.lastIndexOf(null);

const LIST_METHODS: Record<ArrayMethodName, ListMethod> = {
  map: { rule: ListRule.EachItem },
  flatMap: { rule: ListRule.EachItem },
  filter: { rule: ListRule.Predicate, decided: () => false },
  find: { rule: ListRule.Predicate, decided: firstMatchDecides },
  findIndex: { rule: ListRule.Predicate, decided: firstMatchDecides },
  findLast: { rule: ListRule.Predicate, decided: lastMatchDecides },
  findLastIndex: { rule: ListRule.Predicate, decided: lastMatchDecides },
  some: {
    rule: ListRule.Predicate,
    decided: (verdicts) => verdicts.includes(true),
  },
  every: {
    rule: ListRule.Predicate,
    decided: (verdicts) => verdicts.includes(false),
  },
  reduce: { rule: ListRule.Reduce },
  sort: { rule: ListRule.Sort },
  reverse: { rule: ListRule.Plain },
  slice: { rule: ListRule.Plain },
  concat: { rule: ListRule.Concat },
  // Native lookups count a missing item as a non-match. A missing item that
  // could be the one sought, with no match found first, makes the result
  // unknown, as `===` with an unknown does. `missing` is the native lookup of
  // `null` with the same start.
  includes: {
    rule: ListRule.Lookup,
    settle: ({ found, missing }) =>
      found === true || (missing === true ? null : false),
  },
  indexOf: {
    rule: ListRule.Lookup,
    settle: ({ found, missing }) =>
      missing !== -1 && (found === -1 || Number(missing) < Number(found))
        ? null
        : toValue(found, "indexOf"),
  },
  lastIndexOf: {
    rule: ListRule.Lookup,
    settle: ({ found, missing }) =>
      Number(missing) > Number(found) ? null : toValue(found, "lastIndexOf"),
  },
  at: { rule: ListRule.Plain },
  join: { rule: ListRule.Join },
  flat: { rule: ListRule.Plain },
};

const PLAIN: ListMethod = { rule: ListRule.Plain };

const LIST_METHOD_BY_NAME: ReadonlyMap<string, ListMethod> = new Map(
  Object.entries(LIST_METHODS),
);

const listRule = (method: string) =>
  (LIST_METHOD_BY_NAME.get(method) ?? PLAIN).rule;

const TAKES_FUNCTION: Record<ListRule, boolean> = {
  [ListRule.Plain]: false,
  [ListRule.Concat]: false,
  [ListRule.Join]: false,
  [ListRule.Lookup]: false,
  [ListRule.Predicate]: true,
  [ListRule.EachItem]: true,
  [ListRule.Reduce]: true,
  [ListRule.Sort]: true,
};

const IGNORES_ARGUMENTS_BESIDE_FUNCTION: Record<ListRule, boolean> = {
  [ListRule.Plain]: true,
  [ListRule.Concat]: true,
  [ListRule.Join]: true,
  [ListRule.Lookup]: true,
  [ListRule.Predicate]: true,
  [ListRule.EachItem]: true,
  [ListRule.Reduce]: false,
  [ListRule.Sort]: true,
};

export const ignoresArgumentsBesideFunction = (method: string) =>
  IGNORES_ARGUMENTS_BESIDE_FUNCTION[listRule(method)];

// Native `concat` keeps a list or record argument as it is, and `reduce` its
// starting value.
const TAKES_OBJECTS: Record<ListRule, boolean> = {
  [ListRule.Plain]: false,
  [ListRule.Concat]: true,
  [ListRule.Join]: false,
  [ListRule.Lookup]: false,
  [ListRule.Predicate]: false,
  [ListRule.EachItem]: false,
  [ListRule.Reduce]: true,
  [ListRule.Sort]: false,
};

// A list's `concat` keeps an unknown argument as an item, as `tsc` types it.
const KEEPS_UNKNOWN_AS_ITEM: Record<ListRule, boolean> = {
  [ListRule.Plain]: false,
  [ListRule.Concat]: true,
  [ListRule.Join]: false,
  [ListRule.Lookup]: false,
  [ListRule.Predicate]: false,
  [ListRule.EachItem]: false,
  [ListRule.Reduce]: false,
  [ListRule.Sort]: false,
};

const PRIMITIVE_ITEMS: Record<
  ListRule,
  (argCount: number) => string | undefined
> = {
  [ListRule.Plain]: () => undefined,
  [ListRule.Concat]: () => undefined,
  [ListRule.Join]: () => SHOWS_PRIMITIVES_ONLY,
  [ListRule.Lookup]: () => undefined,
  [ListRule.Predicate]: () => undefined,
  [ListRule.EachItem]: () => undefined,
  [ListRule.Reduce]: () => undefined,
  [ListRule.Sort]: (argCount) =>
    argCount === 0 ? SORTS_PRIMITIVES_ONLY : undefined,
};

const IS_PREDICATE: Record<ListRule, boolean> = {
  [ListRule.Plain]: false,
  [ListRule.Concat]: false,
  [ListRule.Join]: false,
  [ListRule.Lookup]: false,
  [ListRule.Predicate]: true,
  [ListRule.EachItem]: false,
  [ListRule.Reduce]: false,
  [ListRule.Sort]: false,
};

const IS_ITEM_LOOKUP: Record<ListRule, boolean> = {
  [ListRule.Plain]: false,
  [ListRule.Concat]: false,
  [ListRule.Join]: false,
  [ListRule.Lookup]: true,
  [ListRule.Predicate]: false,
  [ListRule.EachItem]: false,
  [ListRule.Reduce]: false,
  [ListRule.Sort]: false,
};

const COLLECTS_EACH_RESULT: Record<ListRule, boolean> = {
  [ListRule.Plain]: false,
  [ListRule.Concat]: false,
  [ListRule.Join]: false,
  [ListRule.Lookup]: false,
  [ListRule.Predicate]: false,
  [ListRule.EachItem]: true,
  [ListRule.Reduce]: false,
  [ListRule.Sort]: false,
};

const FEEDS_RESULT_BACK: Record<ListRule, boolean> = {
  [ListRule.Plain]: false,
  [ListRule.Concat]: false,
  [ListRule.Join]: false,
  [ListRule.Lookup]: false,
  [ListRule.Predicate]: false,
  [ListRule.EachItem]: false,
  [ListRule.Reduce]: true,
  [ListRule.Sort]: false,
};

// The position of the index among a function argument's parameters.
const INDEX_PARAM: Record<ListRule, number | undefined> = {
  [ListRule.Plain]: undefined,
  [ListRule.Concat]: undefined,
  [ListRule.Join]: undefined,
  [ListRule.Lookup]: undefined,
  [ListRule.Predicate]: 1,
  [ListRule.EachItem]: 1,
  [ListRule.Reduce]: 2,
  [ListRule.Sort]: undefined,
};

// Rules for a list target; text methods of the same name follow none of them.
export const isPredicateMethod = (method: string) =>
  IS_PREDICATE[listRule(method)];

export const isItemLookup = (method: string) =>
  IS_ITEM_LOOKUP[listRule(method)];

export const needsEveryItem = (method: string, argCount: number) =>
  PRIMITIVE_ITEMS[listRule(method)](argCount) !== undefined;

export const keepsUnknownAsItem = (method: string) =>
  KEEPS_UNKNOWN_AS_ITEM[listRule(method)];

export const collectsEachResult = (method: string) =>
  COLLECTS_EACH_RESULT[listRule(method)];

export const feedsResultBack = (method: string) =>
  FEEDS_RESULT_BACK[listRule(method)];

export const indexParam = (method: string) => INDEX_PARAM[listRule(method)];

class UnknownResult extends Error {}

// Carries a bug thrown inside a function argument past the catch around a
// native method, which turns the method's own errors into expression errors.
class Escaped {
  constructor(readonly thrown: unknown) {}
}

/**
 * Calls an allowlisted native method on a copy of `target`: `null` when the
 * result is unknown, a thrown `Failure` for an error or pending.
 */
export function callMethod({
  target,
  method,
  args,
}: {
  target: Value;
  method: string;
  args: readonly (Value | Lambda)[];
}): Value {
  const listMethod = LIST_METHOD_BY_NAME.get(method) ?? PLAIN;
  // An unknown target could be a list, so it takes what a list takes.
  const listLike = target === null || Array.isArray(target);
  const list = Array.isArray(target) ? target : undefined;
  const isObject = (arg: Value | Lambda) =>
    typeof arg === "object" && arg !== null;
  const takesObjects = listLike && TAKES_OBJECTS[listMethod.rule];
  const lookUp =
    listLike && listMethod.rule === ListRule.Lookup
      ? listMethod.settle
      : undefined;
  const checkedFrom = lookUp === undefined ? 0 : 1;
  if (!takesObjects && args.slice(checkedFrom).some(isObject)) {
    throw evalError(
      `\`${method}\` takes only text, numbers and yes/no values.`,
    );
  }
  if (checkedFrom > 0 && isObject(args[0])) {
    throw evalError(COMPARES_PRIMITIVES_ONLY);
  }
  const isFunction = (arg: Value | Lambda) => typeof arg === "function";
  if (!TAKES_FUNCTION[listMethod.rule] && args.some(isFunction)) {
    throw evalError(`\`${method}\` doesn't take a function.`);
  }
  if (args.slice(1).some(isFunction)) throw evalError(LAMBDA_ONLY_AS_ARGUMENT);
  const cantCall = () =>
    evalError(`\`${method}\` can't be called on this value.`);
  if (target === null) {
    if (KNOWN_METHODS.has(method)) return null;
    throw cantCall();
  }
  const primitivesOnly = list && PRIMITIVE_ITEMS[listMethod.rule](args.length);
  const notShown = (item: Value) => item !== null && !isPrimitive(item);
  if (list && primitivesOnly && list.some(notShown)) {
    throw evalError(primitivesOnly);
  }
  const native = (
    list
      ? ARRAY_METHODS
      : typeof target === "string"
        ? STRING_METHODS
        : typeof target === "number"
          ? NUMBER_METHODS
          : undefined
  )?.get(method);
  if (native === undefined) throw cantCall();
  const keepsUnknown =
    list &&
    (TAKES_FUNCTION[listMethod.rule] || KEEPS_UNKNOWN_AS_ITEM[listMethod.rule]);
  if (!keepsUnknown && args.includes(null)) return null;
  if (list && primitivesOnly && list.includes(null)) return null;
  const self = list ? [...list] : target;
  const sortFailures: EvalFailure[] = [];
  let unknownComparison = false;
  let comparator: ((...values: unknown[]) => number) | undefined;
  const nativeArg = (given: Value | Lambda) => {
    if (typeof given !== "function") return given;
    if (list === undefined) {
      throw new Error(
        `\`${method}\` took a function on a value that isn't a list.`,
      );
    }
    const arg: Lambda = (values) => {
      try {
        return given(values);
      } catch (thrown) {
        throw thrown instanceof Failure ? thrown : new Escaped(thrown);
      }
    };
    const call = (values: unknown[]) =>
      arg(
        values.map((value) =>
          value === self ? target : toValue(value, method),
        ),
      );
    switch (listMethod.rule) {
      case ListRule.Predicate: {
        const verdicts = predicate({ method, lambda: arg, list });
        if (verdicts.includes(null) && !listMethod.decided(verdicts)) {
          throw new UnknownResult();
        }
        return (_: unknown, index: number) => verdicts[index];
      }
      case ListRule.EachItem: {
        const results = runEvery(list, (item, index) =>
          arg([item, index, list]),
        );
        return (_: unknown, index: number) => results[index];
      }
      case ListRule.Reduce:
        return (...values: unknown[]) => call(values);
      case ListRule.Sort:
        comparator = (...values: unknown[]) => {
          try {
            const order = call(values);
            if (order === null) unknownComparison = true;
            else if (typeof order !== "number") {
              throw evalError(
                "The function passed to `sort` has to give a number.",
              );
            }
            return order ?? 0;
          } catch (thrown) {
            if (!(thrown instanceof Failure)) throw thrown;
            sortFailures.push(thrown.failure);
            return 0;
          }
        };
        return comparator;
      case ListRule.Plain:
      case ListRule.Concat:
      case ListRule.Join:
      case ListRule.Lookup:
        throw new Error(`\`${method}\` took a function it doesn't take.`);
      default:
        throw new Error(`unknown list rule: ${listMethod satisfies never}`);
    }
  };
  const runNative = (nativeArgs: unknown[]) => {
    try {
      return native.apply(self, nativeArgs);
    } catch (thrown) {
      if (thrown instanceof Failure || thrown instanceof Escaped) throw thrown;
      // The engine's own message differs between V8, JavaScriptCore and Hermes.
      throw evalError(`\`${method}\` couldn't run with these values.`);
    }
  };
  try {
    const nativeArgs = args.map(nativeArg);
    const found =
      comparator !== undefined && Array.isArray(self)
        ? mergeSort(self, comparator)
        : runNative(nativeArgs);
    if (sortFailures.length > 0) throw new Failure(combine(sortFailures));
    if (unknownComparison) return null;
    if (lookUp !== undefined) {
      return lookUp({
        found,
        missing: runNative([null, ...nativeArgs.slice(1)]),
      });
    }
    return toValue(found, method);
  } catch (thrown) {
    if (thrown instanceof UnknownResult) return null;
    if (thrown instanceof Escaped) throw thrown.thrown;
    throw thrown;
  }
}

// Native `sort` leaves which pairs it compares to the engine, and a comparison
// can fail or be unknown for one pair alone.
function mergeSort(
  list: readonly Value[],
  compare: (a: Value, b: Value) => number,
): Value[] {
  if (list.length < 2) return [...list];
  const middle = Math.floor(list.length / 2);
  const left = mergeSort(list.slice(0, middle), compare);
  const right = mergeSort(list.slice(middle), compare);
  const merged: Value[] = [];
  let [l, r] = [0, 0];
  while (l < left.length && r < right.length) {
    if (compare(left[l], right[r]) > 0) merged.push(right[r++]);
    else merged.push(left[l++]);
  }
  return [...merged, ...left.slice(l), ...right.slice(r)];
}

function predicate({
  method,
  lambda,
  list,
}: {
  method: string;
  lambda: Lambda;
  list: readonly Value[];
}): (boolean | null)[] {
  return runEvery(list, (item, index) => {
    const verdict = lambda([item, index, list]);
    if (verdict !== null && typeof verdict !== "boolean") {
      throw evalError(
        `The function passed to \`${method}\` has to give yes or no.`,
      );
    }
    return verdict;
  });
}

function toValue(value: unknown, method: string): Value {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return finite(value, `\`${method}\``);
  if (Array.isArray(value)) return value.map((item) => toValue(item, method));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, toValue(item, method)]),
    );
  }
  throw evalError(`\`${method}\` gave a value expressions can't hold.`);
}
