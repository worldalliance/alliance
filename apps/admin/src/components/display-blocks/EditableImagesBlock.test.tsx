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
};

let reads: Pending<Result<string, Error>>[] = [];
let uploads: Pending<Result<string, string>>[] = [];
let users: { id: number; name: string; hasActiveContract: boolean }[] = [];

jest.mock("@alliance/sharedweb/lib/readFileDataUri", () => ({
  readFileDataUri: () =>
    new Promise<Result<string, Error>>((resolve, reject) => {
      reads.push({ resolve, reject });
    }),
}));

jest.mock("@alliance/shared/client", () => ({
  userListAdmin: async () => ({ data: users }),
}));

jest.mock("@alliance/shared/lib/uploadImageDataUri", () => ({
  uploadImageDataUri: () =>
    new Promise<Result<string, string>>((resolve, reject) => {
      uploads.push({ resolve, reject });
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

  it("frees the block and says so when an upload throws", async () => {
    render(<Form />);
    await pick(["a.png"]);
    await settle(reads, R.success("data:image/png;base64,aaa"));

    await throwOn(uploads, new Error("boom"));

    expect(screen.queryByText("Uploading...")).toBeNull();
    expect(fileInput().disabled).toBe(false);
    expect(screen.getByText("Failed to upload image")).toBeTruthy();
  });
});
