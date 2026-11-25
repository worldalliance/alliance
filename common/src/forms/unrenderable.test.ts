import { formUnrenderable, UnrenderableReason } from "./unrenderable";

describe("formUnrenderable", () => {
  it("blames this build for an unknown kind, even alongside a variable error", () => {
    expect(
      formUnrenderable({ unknownKind: "carousel", variablesError: "#{a}: x" }),
    ).toEqual({
      reason: UnrenderableReason.OutdatedClient,
      detail: "Unknown to this build: carousel",
    });
  });

  it("blames the content for a variable error alone", () => {
    expect(
      formUnrenderable({ unknownKind: null, variablesError: "#{a}: x" }),
    ).toEqual({
      reason: UnrenderableReason.ContentProblem,
      detail: "#{a}: x",
    });
  });

  it("returns null for a renderable form", () => {
    expect(
      formUnrenderable({ unknownKind: null, variablesError: null }),
    ).toBeNull();
  });
});
