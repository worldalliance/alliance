import type { FormSchema } from "@alliance/common/forms/form-schema";
import type { CustomValidatorDraft } from "../components/form-fields/customValidatorDrafts";
import { customValidatorIds } from "./customValidatorIds";
import { resolveValidatorDrafts, startFormDraft } from "./useFormDraft";

const phone: CustomValidatorDraft = {
  type: "HasPhoneNumber",
  idArgument: null,
  expression: null,
};
const withValidator = (validatorId: number): FormSchema => ({
  pages: [
    {
      id: "p1",
      fields: [
        {
          id: "q",
          type: "input",
          kind: "text",
          label: "Q",
          customValidatorId: validatorId,
        },
      ],
    },
  ],
  outputViews: [],
});

describe("resolveValidatorDrafts", () => {
  it("points a draft at the validator created from it", () => {
    const draft = {
      ...startFormDraft(withValidator(-1)),
      validatorDrafts: { [-1]: phone },
    };
    const resolved = resolveValidatorDrafts(
      draft,
      new Map([[-1, { id: 42, draft: phone }]]),
    );
    expect([...customValidatorIds(resolved.schema)]).toEqual([42]);
    expect(resolved.validatorDrafts).toEqual({});
  });

  it("keeps a draft whose settings differ from the created one", () => {
    const edited = { ...phone, expression: "other" };
    const draft = {
      ...startFormDraft(withValidator(-1)),
      validatorDrafts: { [-1]: edited },
    };
    expect(
      resolveValidatorDrafts(draft, new Map([[-1, { id: 42, draft: phone }]])),
    ).toBe(draft);
  });
});
