import { changedActionImages, duplicatedActionImages } from "./actionImages";

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

describe("duplicatedActionImages", () => {
  const coverKey = "1765925205045-cover.webp";
  const thumbnailKey = "1765925205045.webp";
  const rendered = `http://localhost:3505/images/${thumbnailKey}`;
  const uploadKey = "1788147300149-24b6c060.webp";

  const original = {
    squareThumbnailImage: rendered,
    storedImage: coverKey,
    storedSquareThumbnailImage: thumbnailKey,
  };

  it("copies both columns as the original stores them", () => {
    expect(
      duplicatedActionImages({
        form: { squareThumbnailImage: rendered },
        action: original,
        imageKey: null,
      }),
    ).toEqual({ image: coverKey, squareThumbnailImage: thumbnailKey });
  });

  it("copies a cover image the admin uploaded but has not saved", () => {
    expect(
      duplicatedActionImages({
        form: { squareThumbnailImage: rendered },
        action: original,
        imageKey: uploadKey,
      }),
    ).toEqual({ image: uploadKey, squareThumbnailImage: thumbnailKey });
  });

  it("copies a thumbnail url the admin typed but has not saved", () => {
    expect(
      duplicatedActionImages({
        form: { squareThumbnailImage: "https://example.com/promo.png" },
        action: original,
        imageKey: null,
      }),
    ).toEqual({
      image: coverKey,
      squareThumbnailImage: "https://example.com/promo.png",
    });
  });

  it("leaves the thumbnail off a copy whose field the admin cleared", () => {
    expect(
      duplicatedActionImages({
        form: { squareThumbnailImage: "" },
        action: original,
        imageKey: null,
      }),
    ).toEqual({ image: coverKey, squareThumbnailImage: "" });
  });

  it("has nothing to copy for a column the original leaves empty", () => {
    expect(
      duplicatedActionImages({
        form: {},
        action: { squareThumbnailImage: undefined },
        imageKey: null,
      }),
    ).toEqual({ image: undefined, squareThumbnailImage: undefined });
  });
});
