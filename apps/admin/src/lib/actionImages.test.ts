import { changedActionImages } from "./actionImages";

describe("changedActionImages", () => {
  const rendered = "http://localhost:3505/images/1765925205045.webp";
  const uploadKey = "1788147300149-24b6c060.webp";

  it("sends neither column for an action the admin only saved", () => {
    expect(
      changedActionImages({
        form: { squareThumbnailImage: rendered },
        action: { squareThumbnailImage: rendered },
        imageKey: null,
      }),
    ).toEqual({ image: undefined, squareThumbnailImage: undefined });
  });

  it("sends the thumbnail url the admin typed", () => {
    expect(
      changedActionImages({
        form: { squareThumbnailImage: "https://example.com/promo.png" },
        action: { squareThumbnailImage: rendered },
        imageKey: null,
      }),
    ).toEqual({
      image: undefined,
      squareThumbnailImage: "https://example.com/promo.png",
    });
  });

  it("sends the key of a cover image the admin just uploaded", () => {
    expect(
      changedActionImages({
        form: { squareThumbnailImage: rendered },
        action: { squareThumbnailImage: rendered },
        imageKey: uploadKey,
      }),
    ).toEqual({ image: uploadKey, squareThumbnailImage: undefined });
  });

  it("sends both for a new action, which has nothing stored", () => {
    expect(
      changedActionImages({
        form: { squareThumbnailImage: "https://example.com/promo.png" },
        action: null,
        imageKey: uploadKey,
      }),
    ).toEqual({
      image: uploadKey,
      squareThumbnailImage: "https://example.com/promo.png",
    });
  });
});
