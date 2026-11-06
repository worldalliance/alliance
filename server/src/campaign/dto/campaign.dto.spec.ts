import { INVITE_PAGE_DESCRIPTION_MAX_LENGTH } from "@alliance/common/invitePageDescription";
import { describe, expect, it } from "bun:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateCampaignDto, UpdateCampaignDto } from "./campaign.dto";

const errorsFor = (invitePageDescription: string | null) =>
  validate(
    plainToInstance(CreateCampaignDto, {
      name: "Spring",
      invitePageDescription,
    }),
  );

describe("CreateCampaignDto invitePageDescription", () => {
  it("accepts a description at the max length", async () => {
    expect(
      await errorsFor("a".repeat(INVITE_PAGE_DESCRIPTION_MAX_LENGTH)),
    ).toEqual([]);
  });

  it("rejects a description over the max length", async () => {
    const errors = await errorsFor(
      "a".repeat(INVITE_PAGE_DESCRIPTION_MAX_LENGTH + 1),
    );
    expect(errors.map((e) => e.property)).toEqual(["invitePageDescription"]);
  });

  it("stores blank as null", async () => {
    const dto = plainToInstance(CreateCampaignDto, {
      name: "Spring",
      invitePageDescription: "   ",
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto.invitePageDescription).toBeNull();
  });
});

describe("UpdateCampaignDto invitePageDescription", () => {
  it("leaves an omitted description unchanged", () => {
    const dto = plainToInstance(UpdateCampaignDto, { name: "Spring" });
    expect(dto.invitePageDescription).toBeUndefined();
  });

  it("clears a description with null", async () => {
    const dto = plainToInstance(UpdateCampaignDto, {
      invitePageDescription: null,
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto.invitePageDescription).toBeNull();
  });
});
