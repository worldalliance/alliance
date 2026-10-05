import type { AnyField, SelectField } from "@alliance/common/forms/form-schema";
import { cleanup, renderHook } from "@testing-library/react";
import { shuffleWithSeed } from "./randomutils";
import { useFieldOptionSections } from "./useFieldOptionSections";

afterEach(cleanup);

const options = Array.from({ length: 12 }, (_, i) => ({
  label: `Option ${i}`,
  value: `o${i}`,
}));
const values = (items: { value: string }[] | undefined) =>
  items?.map((option) => option.value);

const select = (overrides: Partial<SelectField> = {}): SelectField => ({
  id: "pick",
  type: "input",
  kind: "select",
  label: "Pick",
  options,
  randomizeOptions: true,
  ...overrides,
});

const render = (params: Parameters<typeof useFieldOptionSections>[0]) =>
  renderHook(() => useFieldOptionSections(params)).result.current;

describe("useFieldOptionSections", () => {
  it("seeds the shuffle with the randomization key and field id", () => {
    const { randomizedOptions } = render({
      field: select(),
      randomizationKey: "form:7:user:u9",
    });
    expect(values(randomizedOptions)).toEqual(
      values(shuffleWithSeed(options, "form:7:user:u9:pick")),
    );
    expect(values(randomizedOptions)).not.toEqual(values(options));
  });

  it("seeds with the field id alone without a randomization key", () => {
    for (const randomizationKey of [undefined, ""]) {
      expect(
        values(render({ field: select(), randomizationKey }).randomizedOptions),
      ).toEqual(values(shuffleWithSeed(options, "pick")));
    }
  });

  it("keeps authored order when randomization is off", () => {
    expect(
      values(
        render({
          field: select(),
          randomizationKey: "k",
          disableOptionRandomization: true,
        }).randomizedOptions,
      ),
    ).toEqual(values(options));
    expect(
      values(
        render({
          field: select({ randomizeOptions: false }),
          randomizationKey: "k",
        }).randomizedOptions,
      ),
    ).toEqual(values(options));
  });

  it("ignores categories on radio fields only", () => {
    const categorized = [
      { label: "B", value: "b", category: "c" },
      { label: "A", value: "a" },
    ];
    const categories = [{ id: "c", name: "C" }];
    expect(
      render({
        field: select({
          options: categorized,
          categories,
          randomizeOptions: false,
        }),
      }).sections?.map((section) => section.category?.id ?? null),
    ).toEqual([null, "c"]);
    expect(
      values(
        render({
          field: {
            id: "r",
            type: "input",
            kind: "radio",
            label: "R",
            options: categorized,
          },
        }).randomizedOptions,
      ),
    ).toEqual(["b", "a"]);
  });

  it("returns no sections for a field without options", () => {
    const field: AnyField = {
      id: "t",
      type: "input",
      kind: "text",
      label: "T",
    };
    expect(render({ field })).toEqual({
      sections: null,
      randomizedOptions: undefined,
    });
  });
});
