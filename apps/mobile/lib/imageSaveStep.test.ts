import { ImageSaveKind } from "@alliance/common/image-src";
import { expect, it } from "bun:test";
import { ImageSaveRoute, imageSaveStep } from "./imageSaveStep";

const download = {
  kind: ImageSaveKind.Download,
  key: "123.webp",
  url: "https://api.test/images/123.webp/download?name=Poster.jpg",
  fileName: "Poster.jpg",
} as const;

it("shares a stored image's jpeg from iOS under its name", () => {
  expect(imageSaveStep({ os: "ios", target: download })).toEqual({
    route: ImageSaveRoute.ShareSheet,
    url: download.url,
    fileName: "Poster.jpg",
  });
});

it("opens a stored image's download in the browser on Android", () => {
  expect(imageSaveStep({ os: "android", target: download })).toEqual({
    route: ImageSaveRoute.Browser,
    url: download.url,
  });
});

it("opens a source that names no upload in the browser, even on iOS", () => {
  const url = "https://example.com/photo.png";

  expect(
    imageSaveStep({ os: "ios", target: { kind: ImageSaveKind.Open, url } }),
  ).toEqual({ route: ImageSaveRoute.Browser, url });
});
