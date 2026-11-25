import { formatSize, replacementFilesError, videoHref } from "./mediaRules";

it.each([
  [0, "0 B"],
  [1023, "1023 B"],
  [2048, "2.0 KB"],
  [5 * 1024 * 1024, "5.0 MB"],
  [1.5 * 1024 * 1024 * 1024, "1.50 GB"],
])("shows %i bytes as %s", (bytes, shown) => {
  expect(formatSize(bytes)).toBe(shown);
});

it("links a video to its record", () => {
  expect(videoHref(7)).toBe("/content/media/videos/7");
});

const files = (names: string[]) => names.map((name) => new File(["x"], name));

it("asks for files when none are chosen", () => {
  expect(replacementFilesError([])).toBe(
    "Choose the playlist and its segment files",
  );
});

it("asks for a playlist when only segments are chosen", () => {
  expect(replacementFilesError(files(["segment_000.ts"]))).toBe(
    "At least one .m3u8 playlist file is required",
  );
});

it("accepts a playlist with its segments", () => {
  expect(
    replacementFilesError(files(["output.m3u8", "segment_000.ts"])),
  ).toBeNull();
});
