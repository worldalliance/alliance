import type { ImagesBlock } from "@alliance/common/forms/display-blocks";
import { R, type Result } from "@alliance/common/result";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useState } from "react";

type Pending<T> = {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  signal?: AbortSignal;
};

let reads: Pending<Result<string, Error>>[] = [];
let uploads: Pending<Result<string, string>>[] = [];
let users: { id: number; name: string; hasActiveContract: boolean }[] = [];

jest.mock("@alliance/sharedweb/lib/readFileDataUri", () => ({
  readFileDataUri: (_file: File, signal?: AbortSignal) =>
    new Promise<Result<string, Error>>((resolve, reject) => {
      reads.push({ resolve, reject, signal });
    }),
}));

jest.mock("@alliance/shared/client", () => ({
  userListAdmin: async () => ({ data: users }),
}));

jest.mock("@alliance/shared/lib/uploadImageDataUri", () => ({
  uploadImageDataUri: (_dataUri: string, signal?: AbortSignal) =>
    new Promise<Result<string, string>>((resolve, reject) => {
      uploads.push({ resolve, reject, signal });
    }),
}));

import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { EditableImagesBlock } from "./EditableImagesBlock";

const emptyBlock: ImagesBlock = {
  type: "display",
  kind: "images",
  id: "block-1",
  images: [],
};

// The form builders all commit a block update by spreading the whole form they
// rendered with, so a handler held past its render puts that form back.
function Form() {
  const [form, setForm] = useState({ title: "", block: emptyBlock });
  return (
    <ToastProvider>
      <input
        aria-label="Form title"
        value={form.title}
        onChange={(event) =>
          setForm({ ...form, title: event.currentTarget.value })
        }
      />
      <EditableImagesBlock
        block={form.block}
        onUpdate={(updates) =>
          setForm({ ...form, block: { ...form.block, ...updates } })
        }
        onRemove={() => {}}
      />
      <span>images: {form.block.images.length}</span>
    </ToastProvider>
  );
}

const fileInput = () => {
  const input = document.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) throw new Error("no file input");
  return input;
};

const pick = async (names: string[]) => {
  const input = fileInput();
  await act(async () => {
    fireEvent.change(input, {
      target: {
        files: names.map(
          (name) => new File(["x"], name, { type: "image/png" }),
        ),
      },
    });
  });
};

const settle = async <T,>(pending: Pending<T>[], value: T) => {
  const [next] = pending.splice(0, 1);
  if (!next) throw new Error("nothing in flight");
  await act(async () => next.resolve(value));
};

const throwOn = async <T,>(pending: Pending<T>[], error: Error) => {
  const [next] = pending.splice(0, 1);
  if (!next) throw new Error("nothing in flight");
  await act(async () => next.reject(error));
};

// The default and the override start from different pictures, so a write that
// takes the on-screen target's list comes back as the wrong list, not just the
// wrong target.
const perUserBlock: ImagesBlock = {
  ...emptyBlock,
  images: [{ id: "default-1", src: "default.webp" }],
  manualPerUser: true,
  manualUserContent: {
    "1": { images: [{ id: "alice-1", src: "alice.webp" }] },
  },
};

const noOverrideBlock: ImagesBlock = { ...perUserBlock, manualUserContent: {} };

let written: ImagesBlock = perUserBlock;

function PerUserForm({ initial = perUserBlock }: { initial?: ImagesBlock }) {
  const [block, setBlock] = useState<ImagesBlock>(initial);
  written = block;
  return (
    <ToastProvider>
      <EditableImagesBlock
        block={block}
        onUpdate={(updates) => setBlock({ ...block, ...updates })}
        onRemove={() => {}}
      />
    </ToastProvider>
  );
}

const nextUser = async () => {
  const [pager] = screen.getAllByRole("button", { name: "Next" });
  if (!pager) throw new Error("no user pager");
  await act(async () => {
    fireEvent.click(pager);
  });
};

const editDefault = async () => {
  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", { name: "Display block options" }),
    );
  });
  await act(async () => {
    fireEvent.click(screen.getByText("Edit default"));
  });
};

const cancel = async () => {
  const button = screen.getByLabelText(
    "Cancel the upload and keep the images already added",
  );
  await act(async () => {
    fireEvent.click(button);
  });
};

afterEach(() => {
  reads = [];
  uploads = [];
  users = [];
  cleanup();
});

describe("EditableImagesBlock", () => {
  it("keeps the edits made while the upload was in flight", async () => {
    render(<Form />);
    await pick(["a.png"]);

    const title = screen.getByLabelText<HTMLInputElement>("Form title");
    fireEvent.change(title, { target: { value: "Signup" } });

    await settle(reads, R.success("data:image/png;base64,aaa"));
    await settle(uploads, R.success("uploads/a.webp"));

    expect(screen.getByLabelText<HTMLInputElement>("Form title").value).toBe(
      "Signup",
    );
    expect(screen.getByText("images: 1")).toBeTruthy();
  });

  it("lands the pictures on the user they were picked for", async () => {
    render(<PerUserForm />);
    await act(async () => {});
    await pick(["a.png"]);
    await editDefault();

    await settle(reads, R.success("data:image/png;base64,aaa"));
    await settle(uploads, R.success("uploads/a.webp"));

    expect(written.manualUserContent?.["1"]).toMatchObject({
      images: [{ src: "alice.webp" }, { src: "uploads/a.webp" }],
    });
    expect(written.images).toMatchObject([{ src: "default.webp" }]);
  });

  it("lands the pictures on the default they were picked for", async () => {
    users = [{ id: 1, name: "Alice", hasActiveContract: true }];
    render(<PerUserForm />);
    await act(async () => {});
    await editDefault();
    await pick(["a.png"]);
    await nextUser();

    await settle(reads, R.success("data:image/png;base64,aaa"));
    await settle(uploads, R.success("uploads/a.webp"));

    expect(written.images).toMatchObject([
      { src: "default.webp" },
      { src: "uploads/a.webp" },
    ]);
    expect(written.manualUserContent?.["1"]).toMatchObject({
      images: [{ src: "alice.webp" }],
    });
  });

  it("starts a user's first override from the default", async () => {
    users = [{ id: 1, name: "Alice", hasActiveContract: true }];
    render(<PerUserForm initial={noOverrideBlock} />);
    await act(async () => {});
    await pick(["a.png"]);
    await editDefault();

    await settle(reads, R.success("data:image/png;base64,aaa"));
    await settle(uploads, R.success("uploads/a.webp"));

    expect(written.manualUserContent?.["1"]).toMatchObject({
      images: [{ src: "default.webp" }, { src: "uploads/a.webp" }],
    });
    expect(written.images).toMatchObject([{ src: "default.webp" }]);
  });

  it("cancels the batch and keeps the pictures that landed", async () => {
    render(<Form />);
    await pick(["a.png", "b.png"]);

    await settle(reads, R.success("data:image/png;base64,aaa"));
    await settle(uploads, R.success("uploads/a.webp"));
    await settle(reads, R.success("data:image/png;base64,bbb"));

    const second = uploads[0];
    await cancel();
    expect(second?.signal?.aborted).toBe(true);

    await settle(uploads, R.failure("Failed to upload image."));

    expect(screen.queryByText("Uploading...")).toBeNull();
    expect(screen.getByText("images: 1")).toBeTruthy();
    expect(document.body.textContent).not.toContain("Failed to upload image.");
  });

  it("drops a picture that lands after the click", async () => {
    render(<Form />);
    await pick(["a.png"]);
    await settle(reads, R.success("data:image/png;base64,aaa"));

    await cancel();
    await settle(uploads, R.success("uploads/a.webp"));

    expect(screen.getByText("images: 0")).toBeTruthy();
  });

  it("counts a dropped batch against the files it tried", async () => {
    render(<Form />);
    await pick(["a.png", "b.png", "c.png"]);

    await settle(reads, R.success("data:image/png;base64,aaa"));
    await settle(uploads, R.success("uploads/a.webp"));
    await settle(reads, R.success("data:image/png;base64,bbb"));
    await settle(uploads, R.failure("network is down"));

    await cancel();
    await settle(reads, R.failure(new Error("Cancelled reading c.png")));

    expect(screen.getByText("Added 1. network is down")).toBeTruthy();
    expect(document.body.textContent).not.toContain("of 3");
    expect(screen.getByText("images: 1")).toBeTruthy();
  });

  it("clears what the dropped batch said when the admin picks again", async () => {
    render(<Form />);
    await pick(["a.png", "b.png"]);

    await settle(reads, R.success("data:image/png;base64,aaa"));
    await settle(uploads, R.failure("network is down"));

    await cancel();
    await settle(reads, R.failure(new Error("Cancelled reading b.png")));
    expect(document.body.textContent).toContain("network is down");

    await pick(["c.png"]);

    expect(document.body.textContent).not.toContain("network is down");
  });

  it("frees the block on the click, before the read it is waiting on", async () => {
    render(<Form />);
    await pick(["a.png"]);

    await cancel();

    expect(reads).toHaveLength(1);
    expect(screen.queryByText("Uploading...")).toBeNull();
    expect(fileInput().disabled).toBe(false);
  });

  it("drops a file the cancel beat, read and all", async () => {
    render(<Form />);
    await pick(["a.png", "b.png"]);

    await cancel();
    await settle(reads, R.failure(new Error("Could not read the file.")));

    expect(uploads).toHaveLength(0);
    expect(reads).toHaveLength(0);
    expect(screen.queryByText("Uploading...")).toBeNull();
    expect(document.body.textContent).not.toContain("Could not read the file.");
  });

  it("cuts the read the cancel could otherwise not reach", async () => {
    render(<Form />);
    await pick(["a.png"]);

    const read = reads[0];
    await cancel();

    expect(read?.signal?.aborted).toBe(true);
  });

  it("frees the block and says so when an upload throws", async () => {
    render(<Form />);
    await pick(["a.png"]);
    await settle(reads, R.success("data:image/png;base64,aaa"));

    await throwOn(uploads, new Error("boom"));

    expect(screen.queryByText("Uploading...")).toBeNull();
    expect(fileInput().disabled).toBe(false);
    expect(screen.getByText("Failed to upload image")).toBeTruthy();
  });

  it("leaves the batch picked after the cancel alone when the dropped one unwinds", async () => {
    render(<Form />);
    await pick(["a.png", "b.png"]);
    await cancel();

    await pick(["c.png"]);
    await settle(reads, R.success("data:image/png;base64,aaa"));

    expect(screen.getByText("Uploading...")).toBeTruthy();
    expect(fileInput().disabled).toBe(true);
  });
});
