import { readFileDataUri } from "./readFileDataUri";

const file = () => new File(["hello"], "a.png", { type: "image/png" });

describe("readFileDataUri", () => {
  it("reads the file as a data uri", async () => {
    const result = await readFileDataUri(file());
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.value.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("never starts a read the signal has already dropped", async () => {
    const result = await readFileDataUri(file(), AbortSignal.abort());
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error.message).toBe("Cancelled reading a.png");
  });

  it("stops a read in flight", async () => {
    const abort = jest.spyOn(FileReader.prototype, "abort");
    const controller = new AbortController();
    const reading = readFileDataUri(file(), controller.signal);
    controller.abort();

    const result = await reading;
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error.message).toBe("Cancelled reading a.png");
    expect(abort).toHaveBeenCalled();
    abort.mockRestore();
  });
});
