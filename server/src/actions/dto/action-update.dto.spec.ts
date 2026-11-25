import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { UpdateActionUpdateDto } from "./action-update.dto";

const cardImageErrors = async (cardImage: unknown) =>
  (
    await validate(plainToInstance(UpdateActionUpdateDto, { cardImage }))
  ).filter((error) => error.property === "cardImage");

describe("UpdateActionUpdateDto cardImage", () => {
  it("takes an upload key, or null to clear it", async () => {
    expect(await cardImageErrors("1793834852888-photo.webp")).toEqual([]);
    expect(await cardImageErrors(null)).toEqual([]);
  });

  it("refuses a url, so only uploaded images become card images", async () => {
    expect(await cardImageErrors("https://example.org/photo.png")).toHaveLength(
      1,
    );
  });
});
