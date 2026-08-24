import {
  contractDescriptionSchema,
  type ContractDescription,
} from "./contract";

describe("contractDescriptionSchema", () => {
  it("accepts an empty list", () => {
    expect(contractDescriptionSchema.parse([])).toEqual([]);
  });

  it("accepts point/subtext pairs", () => {
    const description: ContractDescription = [
      { point: "Why a contract?", subtext: "So we can plan." },
      { point: "How do I leave?", subtext: "" },
    ];
    expect(contractDescriptionSchema.parse(description)).toEqual(description);
  });

  it("rejects items missing a field", () => {
    expect(() =>
      contractDescriptionSchema.parse([{ point: "Only a point" }]),
    ).toThrow();
  });
});
