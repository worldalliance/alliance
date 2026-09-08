import { R, type Result } from "@alliance/common/result";
import { act, cleanup, renderHook } from "@testing-library/react";

type Pending<T> = {
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

let reads: Pending<Result<string, Error>>[] = [];
let uploads: (Pending<Result<string, string>> & { signal?: AbortSignal })[] =
  [];

jest.mock("@alliance/sharedweb/lib/readFileDataUri", () => ({
  readFileDataUri: () =>
    new Promise<Result<string, Error>>((resolve, reject) => {
      reads.push({ resolve, reject });
    }),
}));

jest.mock("@alliance/shared/lib/uploadImageDataUri", () => ({
  uploadImageDataUri: (_dataUri: string, signal?: AbortSignal) =>
    new Promise<Result<string, string>>((resolve, reject) => {
      uploads.push({ resolve, reject, signal });
    }),
}));

jest.mock("@alliance/sharedweb/lib/imageSrc", () => ({
  imageSrcFromKey: (key: string) => `https://uploads.test/${key}`,
}));

import { useCoverImage } from "./useCoverImage";

const file = (name: string) => new File(["x"], name, { type: "image/png" });

function mount(storedImage: string | null = "https://stored.test/old.webp") {
  const view = renderHook(() => useCoverImage());
  act(() => view.result.current.reset(storedImage));
  return {
    state: () => view.result.current,
    pick: (name: string) => {
      act(() => {
        void view.result.current.pick(file(name));
      });
    },
    cancel: () => act(() => view.result.current.cancel()),
    reset: (next: string | null) => act(() => view.result.current.reset(next)),
    read: async (index: number, result: Result<string, Error>) => {
      const [next] = reads.splice(index, 1);
      if (!next) throw new Error(`no read in flight at ${index}`);
      await act(async () => next.resolve(result));
    },
    upload: async (index: number, result: Result<string, string>) => {
      const [next] = uploads.splice(index, 1);
      if (!next) throw new Error(`no upload in flight at ${index}`);
      await act(async () => next.resolve(result));
    },
    signalOf: (index: number) => uploads[index]?.signal,
    throwOnRead: async (index: number) => {
      const [next] = reads.splice(index, 1);
      if (!next) throw new Error(`no read in flight at ${index}`);
      await act(async () => next.reject(new Error("boom")));
    },
  };
}

afterEach(() => {
  reads = [];
  uploads = [];
  cleanup();
});

describe("useCoverImage", () => {
  it("previews the picked file, then the key the upload landed on", async () => {
    const cover = mount();
    cover.pick("a.png");

    await cover.read(0, R.success("data:image/png;base64,aaa"));
    expect(cover.state().preview).toBe("data:image/png;base64,aaa");
    expect(cover.state().key).toBeNull();

    await cover.upload(0, R.success("abc.webp"));
    expect(cover.state().key).toBe("abc.webp");
    expect(cover.state().preview).toBe("https://uploads.test/abc.webp");
    expect(cover.state().error).toBeNull();
  });

  it("holds the gate from the pick until the upload settles", async () => {
    const cover = mount();
    expect(cover.state().uploading).toBe(false);

    cover.pick("a.png");
    expect(cover.state().uploading).toBe(true);

    await cover.read(0, R.success("data:image/png;base64,aaa"));
    expect(cover.state().uploading).toBe(true);

    await cover.upload(0, R.failure("That file is too large"));
    expect(cover.state().uploading).toBe(false);
  });

  it("frees the gate when a read fails", async () => {
    const cover = mount();
    cover.pick("a.png");

    await cover.read(0, R.failure(new Error("Could not read a.png")));

    expect(cover.state().uploading).toBe(false);
  });

  it("frees the gate when the pick throws", async () => {
    const cover = mount();
    cover.pick("a.png");

    await cover.throwOnRead(0);

    expect(cover.state().uploading).toBe(false);
  });

  it("frees the gate when the draft reseeds", async () => {
    const cover = mount();
    cover.pick("a.png");
    await cover.read(0, R.success("aaa"));

    cover.reset("https://stored.test/other.webp");

    expect(cover.state().uploading).toBe(false);
  });

  it("reports a failed read and puts the stored image back", async () => {
    const cover = mount();
    cover.pick("a.png");

    await cover.read(0, R.failure(new Error("Could not read a.png")));

    expect(cover.state().error).toBe("Could not read a.png");
    expect(cover.state().preview).toBe("https://stored.test/old.webp");
    expect(cover.state().key).toBeNull();
    expect(uploads).toHaveLength(0);
  });

  it("reports a failed upload and puts the stored image back", async () => {
    const cover = mount();
    cover.pick("a.png");

    await cover.read(0, R.success("data:image/png;base64,aaa"));
    await cover.upload(0, R.failure("That file is too large"));

    expect(cover.state().error).toBe("That file is too large");
    expect(cover.state().preview).toBe("https://stored.test/old.webp");
    expect(cover.state().key).toBeNull();
  });

  it("clears the message when a retry starts", async () => {
    const cover = mount();
    cover.pick("a.png");
    await cover.read(0, R.success("data:image/png;base64,aaa"));
    await cover.upload(0, R.failure("That file is too large"));

    cover.pick("a.png");

    expect(cover.state().error).toBeNull();
  });

  it("shows nothing when a pick fails and no image is stored", async () => {
    const cover = mount(null);
    cover.pick("a.png");

    await cover.read(0, R.success("data:image/png;base64,aaa"));
    await cover.upload(0, R.failure("That file is too large"));

    expect(cover.state().preview).toBeNull();
  });

  // Reverting to the stored image would leave the preview disagreeing with the
  // key a save would still send.
  it("falls back to an earlier upload rather than the stored image", async () => {
    const cover = mount();
    cover.pick("a.png");
    await cover.read(0, R.success("data:image/png;base64,aaa"));
    await cover.upload(0, R.success("abc.webp"));

    cover.pick("b.png");
    await cover.read(0, R.success("data:image/png;base64,bbb"));
    await cover.upload(0, R.failure("That file is too large"));

    expect(cover.state().key).toBe("abc.webp");
    expect(cover.state().preview).toBe("https://uploads.test/abc.webp");
    expect(cover.state().error).toBe("That file is too large");
  });

  it("reports a throw instead of rejecting", async () => {
    const cover = mount();
    cover.pick("a.png");

    await cover.throwOnRead(0);

    expect(cover.state().error).toBe("Failed to upload image");
    expect(cover.state().preview).toBe("https://stored.test/old.webp");
  });
});

describe("two uploads in flight", () => {
  const pickTwice = async () => {
    const cover = mount();
    cover.pick("a.png");
    await cover.read(0, R.success("aaa"));
    cover.pick("b.png");
    await cover.read(0, R.success("bbb"));
    expect(uploads).toHaveLength(2);
    return cover;
  };

  it("stays gated until both uploads settle", async () => {
    const cover = await pickTwice();
    expect(cover.state().uploading).toBe(true);

    await cover.upload(0, R.success("first.webp"));
    expect(cover.state().uploading).toBe(true);

    await cover.upload(0, R.success("second.webp"));
    expect(cover.state().uploading).toBe(false);
  });

  it("keeps the later pick when the earlier upload lands last", async () => {
    const cover = await pickTwice();

    await cover.upload(1, R.success("second.webp"));
    await cover.upload(0, R.success("first.webp"));

    expect(cover.state().key).toBe("second.webp");
    expect(cover.state().preview).toBe("https://uploads.test/second.webp");
  });

  it("drops a superseded upload's failure", async () => {
    const cover = await pickTwice();

    await cover.upload(1, R.success("second.webp"));
    await cover.upload(0, R.failure("That file is too large"));

    expect(cover.state().error).toBeNull();
    expect(cover.state().key).toBe("second.webp");
    expect(cover.state().preview).toBe("https://uploads.test/second.webp");
  });
});

describe("two reads in flight", () => {
  it("never uploads the file the admin moved off", async () => {
    const cover = mount();
    cover.pick("a.png");
    cover.pick("b.png");

    await cover.read(1, R.success("bbb"));
    await cover.upload(0, R.success("second.webp"));
    await cover.read(0, R.success("aaa"));

    expect(uploads).toHaveLength(0);
    expect(cover.state().key).toBe("second.webp");
    expect(cover.state().preview).toBe("https://uploads.test/second.webp");
  });

  it("drops a superseded read's failure", async () => {
    const cover = mount();
    cover.pick("a.png");
    cover.pick("b.png");

    await cover.read(1, R.success("bbb"));
    await cover.upload(0, R.success("second.webp"));
    await cover.read(0, R.failure(new Error("Could not read a.png")));

    expect(cover.state().error).toBeNull();
    expect(cover.state().key).toBe("second.webp");
  });
});

describe("reset", () => {
  it("seeds the preview and clears the key and the error", async () => {
    const cover = mount();
    cover.pick("a.png");
    await cover.read(0, R.success("aaa"));
    await cover.upload(0, R.failure("That file is too large"));

    cover.reset("https://stored.test/other.webp");

    expect(cover.state().key).toBeNull();
    expect(cover.state().error).toBeNull();
    expect(cover.state().preview).toBe("https://stored.test/other.webp");
  });

  // Reseeding the draft from another action must not let an upload started on
  // the one before it land.
  it("drops a pick still in flight", async () => {
    const cover = mount();
    cover.pick("a.png");
    await cover.read(0, R.success("aaa"));

    cover.reset("https://stored.test/other.webp");
    await cover.upload(0, R.success("abc.webp"));

    expect(cover.state().key).toBeNull();
    expect(cover.state().preview).toBe("https://stored.test/other.webp");
  });

  it("reverts to the image it seeded, not the one before it", async () => {
    const cover = mount();
    cover.reset("https://stored.test/other.webp");

    cover.pick("a.png");
    await cover.read(0, R.success("aaa"));
    await cover.upload(0, R.failure("That file is too large"));

    expect(cover.state().preview).toBe("https://stored.test/other.webp");
  });
});

describe("cancel", () => {
  it("frees the gate and puts the stored image back", async () => {
    const cover = mount();
    cover.pick("a.png");
    await cover.read(0, R.success("aaa"));

    cover.cancel();

    expect(cover.state().uploading).toBe(false);
    expect(cover.state().preview).toBe("https://stored.test/old.webp");
    expect(cover.state().key).toBeNull();
  });

  it("keeps an upload that already landed", async () => {
    const cover = mount();
    cover.pick("a.png");
    await cover.read(0, R.success("aaa"));
    await cover.upload(0, R.success("abc.webp"));

    cover.pick("b.png");
    await cover.read(0, R.success("bbb"));
    cover.cancel();

    expect(cover.state().key).toBe("abc.webp");
    expect(cover.state().preview).toBe("https://uploads.test/abc.webp");
  });

  it("drops the cancelled upload when it lands", async () => {
    const cover = mount();
    cover.pick("a.png");
    await cover.read(0, R.success("aaa"));

    cover.cancel();
    await cover.upload(0, R.success("abc.webp"));

    expect(cover.state().key).toBeNull();
    expect(cover.state().uploading).toBe(false);
    expect(cover.state().preview).toBe("https://stored.test/old.webp");
  });

  it("aborts the request the cancelled upload is still sending", async () => {
    const cover = mount();
    cover.pick("a.png");
    await cover.read(0, R.success("aaa"));
    expect(cover.signalOf(0)?.aborted).toBe(false);

    cover.cancel();

    expect(cover.signalOf(0)?.aborted).toBe(true);
  });
});
