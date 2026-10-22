import * as readFileDataUriModule from "@alliance/sharedweb/lib/readFileDataUri";
import { attachImageFiles } from "./imageAttachments";

afterEach(() => {
  jest.restoreAllMocks();
});

function attachmentsState(initial: string[]) {
  let attachments = initial;
  return {
    get: () => attachments,
    set: jest.fn((update: string[] | ((prev: string[]) => string[])) => {
      attachments = typeof update === "function" ? update(attachments) : update;
    }),
  };
}

it("appends only the image files", async () => {
  const state = attachmentsState(["data:image/png;base64,eA=="]);

  const attached = await attachImageFiles(
    [
      new File(["a"], "a.png", { type: "image/png" }),
      new File(["b"], "b.txt", { type: "text/plain" }),
    ],
    state.set,
  );

  expect(attached).toBe(true);
  expect(state.get()).toEqual([
    "data:image/png;base64,eA==",
    "data:image/png;base64,YQ==",
  ]);
});

it("attaches nothing when there are no images", async () => {
  const state = attachmentsState([]);

  const attached = await attachImageFiles(
    [new File(["b"], "b.txt", { type: "text/plain" })],
    state.set,
  );

  expect(attached).toBe(false);
  expect(state.set).not.toHaveBeenCalled();
});

it("attaches nothing when any image can't be read", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest
    .spyOn(readFileDataUriModule, "readFileDataUri")
    .mockResolvedValueOnce({ ok: true, value: "data:image/png;base64,YQ==" })
    .mockResolvedValueOnce({
      ok: false,
      error: new Error("Could not read b.png"),
    });
  const state = attachmentsState([]);

  const attached = await attachImageFiles(
    [
      new File(["a"], "a.png", { type: "image/png" }),
      new File(["b"], "b.png", { type: "image/png" }),
    ],
    state.set,
  );

  expect(attached).toBe(false);
  expect(state.set).not.toHaveBeenCalled();
});
