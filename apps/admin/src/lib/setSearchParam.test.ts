import { expect, it } from "bun:test";
import { readSetParam, writeSetParam } from "./setSearchParam";

const values = ["a", "b", "c"] as const;

it("leaves the param out for an empty selection when nothing is the default", () => {
  expect(
    writeSetParam({ selected: new Set(), values, defaults: [] }),
  ).toBeNull();
  expect(readSetParam({ param: null, values, defaults: [] })).toEqual(
    new Set(),
  );
});

it("writes a selection in the order of the values", () => {
  const param = writeSetParam({
    selected: new Set(["c", "a"] as const),
    values,
    defaults: [],
  });
  expect(param).toBe("a,c");
  expect(readSetParam({ param, values, defaults: [] })).toEqual(
    new Set(["a", "c"]),
  );
});

it("writes a selection that isn't the defaults, even with defaults repeated", () => {
  expect(
    writeSetParam({
      selected: new Set(["a", "b"] as const),
      values,
      defaults: ["a", "a"],
    }),
  ).toBe("a,b");
  expect(
    writeSetParam({
      selected: new Set(["a"] as const),
      values,
      defaults: ["a", "a"],
    }),
  ).toBeNull();
});

it("leaves the param out for the defaults, listed in any order", () => {
  expect(
    writeSetParam({
      selected: new Set(["a", "c"] as const),
      values,
      defaults: ["c", "a"],
    }),
  ).toBeNull();
  expect(
    writeSetParam({
      selected: new Set(["a"] as const),
      values,
      defaults: ["c", "a"],
    }),
  ).toBe("a");
  expect(readSetParam({ param: null, values, defaults: ["c", "a"] })).toEqual(
    new Set(["a", "c"]),
  );
});

it("writes an empty selection as an empty param when something is the default", () => {
  const param = writeSetParam({ selected: new Set(), values, defaults: ["a"] });
  expect(param).toBe("");
  expect(readSetParam({ param, values, defaults: ["a"] })).toEqual(new Set());
});

it("drops names that aren't values", () => {
  expect(readSetParam({ param: "a,zzz", values, defaults: [] })).toEqual(
    new Set(["a"]),
  );
});
