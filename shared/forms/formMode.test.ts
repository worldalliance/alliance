import { FormMode, formMode } from "./formMode";

const mode = (
  renderFormAsCompleted: boolean,
  hasSubmit: boolean,
  previewMode: boolean,
) => formMode({ renderFormAsCompleted, hasSubmit, previewMode });

describe("formMode", () => {
  it("is live for a form with a submit that nobody is previewing", () => {
    expect(mode(false, true, false)).toBe(FormMode.Live);
  });

  it("previews whether or not the caller handed it a submit", () => {
    expect(mode(false, true, true)).toBe(FormMode.Preview);
    expect(mode(false, false, true)).toBe(FormMode.Preview);
  });

  it("reads a completed response ahead of previewing one", () => {
    expect(mode(true, true, true)).toBe(FormMode.Completed);
    expect(mode(true, false, true)).toBe(FormMode.Completed);
  });

  it("is completed when there is nothing to submit to and no preview", () => {
    expect(mode(false, false, false)).toBe(FormMode.Completed);
    expect(mode(true, true, false)).toBe(FormMode.Completed);
    expect(mode(true, false, false)).toBe(FormMode.Completed);
  });

  it("takes the two flags as optional, since the props are", () => {
    expect(formMode({ hasSubmit: true })).toBe(FormMode.Live);
    expect(formMode({ hasSubmit: false })).toBe(FormMode.Completed);
  });
});
