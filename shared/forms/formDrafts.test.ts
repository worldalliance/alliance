import type { AnyField } from "@alliance/common/forms/form-schema";
import { applyDefaultValues, restorableAnswers } from "./formDrafts";

describe("restorableAnswers", () => {
  it("drops multiselect selections of options the field no longer has", () => {
    const places: AnyField = {
      id: "places",
      type: "input",
      kind: "multiselect",
      label: "Places",
      options: [{ label: "New York", value: "ny" }],
    };
    expect(
      restorableAnswers(
        { places: ["gone", "ny"] },
        new Map([["places", places]]),
      ),
    ).toEqual({ places: ["ny"] });
  });

  it("keeps a cleared multiselect from taking its default", () => {
    const places: AnyField = {
      id: "places",
      type: "input",
      kind: "multiselect",
      label: "Places",
      options: [{ label: "New York", value: "ny" }],
      defaultValue: ["ny"],
    };
    const restored = restorableAnswers(
      { places: [] },
      new Map([["places", places]]),
    );
    expect(applyDefaultValues(restored, new Map([["places", ["ny"]]]))).toEqual(
      { places: [] },
    );
  });
});
