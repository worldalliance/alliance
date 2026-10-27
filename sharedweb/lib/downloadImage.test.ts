import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import * as blob from "./downloadBlob";
import { downloadImage } from "./downloadImage";

const KEY = "1762925939234-8f14e45f-ceea-467f-a0e6-4a1b2c3d4e5f.webp";
const SRC = `https://cdn.example.com/${KEY}`;

let status = 200;
const requestedKeys: string[] = [];

serveApi(
  routes({
    "GET /images/:key/download": ({ params }) => {
      requestedKeys.push(params.key);
      return new Response("jpeg", {
        status,
        headers: { "Content-Type": "image/jpeg" },
      });
    },
  }),
);

beforeEach(() => {
  status = 200;
  requestedKeys.length = 0;
});
afterEach(() => jest.restoreAllMocks());

const spyDownload = () =>
  jest.spyOn(blob, "downloadBlob").mockImplementation(() => {});

it("downloads a stored image by its key and saves it as image.jpg", async () => {
  const download = spyDownload();

  const result = await downloadImage({ src: SRC });

  expect(result.ok).toBe(true);
  expect(requestedKeys).toEqual([KEY]);
  expect(download).toHaveBeenCalledWith(expect.any(Blob), "image.jpg");
});

it("saves under the name the author gave", async () => {
  const download = spyDownload();

  await downloadImage({ src: SRC, name: "Rally poster" });

  expect(download).toHaveBeenCalledWith(expect.any(Blob), "Rally poster.jpg");
});

it("fails without saving when the api refuses", async () => {
  status = 500;
  const download = spyDownload();

  const result = await downloadImage({ src: SRC });

  expect(result.ok).toBe(false);
  expect(download).not.toHaveBeenCalled();
});

it("opens a source that names no upload in a new tab", async () => {
  const open = jest.spyOn(window, "open").mockImplementation(() => null);

  const result = await downloadImage({ src: "https://example.com/photo.png" });

  expect(result.ok).toBe(true);
  expect(open).toHaveBeenCalledWith(
    "https://example.com/photo.png",
    "_blank",
    "noopener",
  );
});

it("fails without opening a source with an unsafe scheme", async () => {
  const open = jest.spyOn(window, "open").mockImplementation(() => null);

  const result = await downloadImage({ src: "javascript:alert(1)" });

  expect(result.ok).toBe(false);
  expect(open).not.toHaveBeenCalled();
});
