import {
  contractDescriptionSchema,
  type ContractDescription,
} from "./contract";

describe("contractDescriptionSchema", () => {
  it("accepts an empty list", () => {
    expect(contractDescriptionSchema.parse([])).toEqual([]);
  });

  it("accepts points with admin notes", () => {
    const description: ContractDescription = [
      {
        point: "Why a contract?",
        subtext: "So we can plan.",
        adminNotes: "Kept short on purpose.",
      },
      { point: "How do I leave?", subtext: "", adminNotes: "" },
    ];
    expect(contractDescriptionSchema.parse(description)).toEqual(description);
  });

  it("gives points stored before admin notes empty notes", () => {
    expect(
      contractDescriptionSchema.parse([{ point: "Show up", subtext: "" }]),
    ).toEqual([{ point: "Show up", subtext: "", adminNotes: "" }]);
  });

  it("rejects items missing a field", () => {
    expect(() =>
      contractDescriptionSchema.parse([{ point: "Only a point" }]),
    ).toThrow();
  });
});
