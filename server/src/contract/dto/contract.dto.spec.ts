import { describe, expect, it } from "bun:test";
import { type ParsedContract } from "../entities/contract.entity";
import { ContractAdminDto, ContractDto } from "./contract.dto";

const contract: ParsedContract = {
  id: 1,
  name: "Example",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  markdown: "Example terms",
  description: [
    { point: "First", subtext: "Detail", adminNotes: "Internal only" },
  ],
  startDate: null,
  endDate: null,
  deletedAt: null,
};

describe("contract description admin notes", () => {
  it("leaves admin notes out of the member-facing contract", () => {
    expect(JSON.parse(JSON.stringify(new ContractDto(contract)))).toEqual({
      id: 1,
      markdown: "Example terms",
      description: [{ point: "First", subtext: "Detail" }],
    });
  });

  it("keeps admin notes on the admin contract", () => {
    expect(new ContractAdminDto(contract).description).toEqual([
      { point: "First", subtext: "Detail", adminNotes: "Internal only" },
    ]);
  });
});
