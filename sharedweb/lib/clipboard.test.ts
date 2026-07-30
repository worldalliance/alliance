import { copyToClipboard } from "./clipboard";

type Deferred = {
  promise: Promise<string>;
  resolve: (text: string) => void;
  reject: (error: Error) => void;
};

function deferred(): Deferred {
  let resolve!: (text: string) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

class FakeClipboardItem {
  constructor(readonly items: Record<string, Promise<Blob>>) {}
}

/** Text the clipboard ends up holding, once the item's promise settles. */
async function itemText(item: unknown): Promise<string> {
  const blob = await (item as FakeClipboardItem).items["text/plain"];
  return blob.text();
}

describe("copyToClipboard", () => {
  let write: ReturnType<typeof jest.fn>;
  let writeText: ReturnType<typeof jest.fn>;
  const originals = new Map<string, PropertyDescriptor | undefined>();

  const stub = (name: string, value: unknown) => {
    if (!originals.has(name)) {
      originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    }
    Object.defineProperty(globalThis, name, { value, configurable: true });
  };

  beforeEach(() => {
    write = jest.fn(() => Promise.resolve());
    writeText = jest.fn(() => Promise.resolve());
    stub("navigator", { clipboard: { write, writeText } });
    stub("ClipboardItem", FakeClipboardItem);
  });

  afterEach(() => {
    for (const [name, descriptor] of originals) {
      if (descriptor) {
        Object.defineProperty(globalThis, name, descriptor);
      } else {
        delete (globalThis as Record<string, unknown>)[name];
      }
    }
    originals.clear();
  });

  it("writes a plain string directly", async () => {
    expect(await copyToClipboard("https://example.com/a")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://example.com/a");
    expect(write).not.toHaveBeenCalled();
  });

  it("issues the write before the text arrives, so the gesture still counts", () => {
    const link = deferred();

    void copyToClipboard(link.promise);

    // No await above: if this ever fails, the write has moved outside the
    // click that triggered it and Safari will drop it.
    expect(write).toHaveBeenCalledTimes(1);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copies the text the promise eventually resolves to", async () => {
    const link = deferred();
    const copying = copyToClipboard(link.promise);
    link.resolve("https://example.com/b");

    expect(await copying).toBe(true);
    expect(await itemText(write.mock.calls[0][0][0])).toBe(
      "https://example.com/b",
    );
  });

  it("falls back to writeText where a pending item is rejected", async () => {
    write.mockImplementation(() => Promise.reject(new Error("not supported")));
    const link = deferred();
    const copying = copyToClipboard(link.promise);
    link.resolve("https://example.com/c");

    expect(await copying).toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://example.com/c");
  });

  it("reports failure when the text never arrives", async () => {
    write.mockImplementation(() => Promise.reject(new Error("not supported")));
    const link = deferred();
    const copying = copyToClipboard(link.promise);
    link.reject(new Error("request failed"));

    expect(await copying).toBe(false);
  });

  it("reports failure when the clipboard refuses", async () => {
    writeText.mockImplementation(() => Promise.reject(new Error("denied")));
    expect(await copyToClipboard("https://example.com/d")).toBe(false);
  });
});
