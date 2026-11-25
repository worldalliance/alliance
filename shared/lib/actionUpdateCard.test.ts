import type { DisplayOnlySchema } from "@alliance/common/forms/display-only-schema";
import { expect, it } from "bun:test";
import {
  participatedLabel,
  updateCovers,
  updateExcerpt,
  updateMosaic,
} from "./actionUpdateCard";

const schema: DisplayOnlySchema = {
  blocks: [
    { type: "display", kind: "header", text: "Results" },
    { type: "display", kind: "text", text: "" },
    {
      type: "display",
      kind: "text",
      text: "We **planted** [400 trees](https://example.org)\nacross   the city.\n\nMost planted:\n- Oaks\n- Elms",
    },
    {
      type: "display",
      kind: "images",
      images: [{ src: "uploads/a.jpg", alt: "Volunteers" }, { src: "b.jpg" }],
    },
  ],
};

it("lists the card image, then the update's other images, else its project's image", () => {
  expect(
    updateCovers({ cardImage: "card.jpg", schema, actionImage: "project.jpg" }),
  ).toEqual([
    { src: "card.jpg", alt: "" },
    { src: "uploads/a.jpg", alt: "Volunteers" },
    { src: "b.jpg", alt: "" },
  ]);
  expect(
    updateCovers({ cardImage: null, schema, actionImage: "project.jpg" }),
  ).toEqual([
    { src: "uploads/a.jpg", alt: "Volunteers" },
    { src: "b.jpg", alt: "" },
  ]);
  expect(
    updateCovers({
      cardImage: null,
      schema: { blocks: [] },
      actionImage: "project.jpg",
    }),
  ).toEqual([{ src: "project.jpg", alt: "" }]);
  expect(
    updateCovers({ cardImage: null, schema: null, actionImage: null }),
  ).toEqual([]);
});

it("lists an image the update repeats once", () => {
  const repeated: DisplayOnlySchema = {
    blocks: [
      { type: "display", kind: "images", images: [{ src: "a.jpg" }] },
      { type: "display", kind: "images", images: [{ src: "a.jpg" }] },
    ],
  };
  expect(
    updateCovers({ cardImage: "a.jpg", schema: repeated, actionImage: null }),
  ).toEqual([{ src: "a.jpg", alt: "" }]);
  expect(
    updateCovers({ cardImage: null, schema: repeated, actionImage: null }),
  ).toEqual([{ src: "a.jpg", alt: "" }]);
});

it("doesn't repeat a body image chosen as the card image", () => {
  const withKey: DisplayOnlySchema = {
    blocks: [
      {
        type: "display",
        kind: "images",
        images: [{ src: "1700000000000.webp" }, { src: "c.jpg" }],
      },
    ],
  };
  expect(
    updateCovers({
      cardImage: "http://localhost:3005/images/1700000000000.webp",
      schema: withKey,
      actionImage: null,
    }).map((cover) => cover.src),
  ).toEqual(["http://localhost:3005/images/1700000000000.webp", "c.jpg"]);
});

it("shows three tiles and counts the rest", () => {
  const covers = ["a", "b", "c", "d", "e"].map((src) => ({ src, alt: "" }));
  expect(updateMosaic(covers)).toEqual({
    tiles: covers.slice(0, 3),
    hiddenCount: 2,
  });
  expect(updateMosaic(covers.slice(0, 2))).toEqual({
    tiles: covers.slice(0, 2),
    hiddenCount: 0,
  });
});

it("labels participation only when someone participated", () => {
  expect(participatedLabel(1)).toBe("1 member participated");
  expect(participatedLabel(1234)).toBe("1,234 members participated");
  expect(participatedLabel(0)).toBeNull();
  expect(participatedLabel(undefined)).toBeNull();
});

it("previews the first non-empty text block as plain text", () => {
  expect(updateExcerpt(schema)).toBe(
    "We planted 400 trees across the city. Most planted: Oaks Elms",
  );
  expect(updateExcerpt({ blocks: [] })).toBeNull();
});
