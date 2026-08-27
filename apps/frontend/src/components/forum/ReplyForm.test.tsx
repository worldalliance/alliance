import { CreateEditableContentDto } from "@alliance/shared/client";
import { withUploadedKeys } from "@alliance/shared/lib/uploadAttachments";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useState } from "react";

import {
  deferUpload,
  failUploads,
  resetUploads,
  uploadAttachments,
  uploads,
} from "../../testing/uploadAttachmentsMock";

jest.mock("@alliance/shared/lib/uploadAttachments", () => ({
  uploadAttachments,
  withUploadedKeys,
}));

import ReplyForm from "./ReplyForm";

afterEach(cleanup);

beforeEach(() => {
  resetUploads();
  sessionStorage.clear();
});

const draft: CreateEditableContentDto = {
  body: "a draft worth keeping",
  attachments: [],
};

const draftStorageKey = `editablecontent:draft:v1:${window.location.origin}${window.location.pathname}${window.location.search}:reply-null`;

const seedSavedDraft = () => {
  sessionStorage.setItem(
    draftStorageKey,
    JSON.stringify({ dto: draft, savedAt: new Date().toISOString() }),
  );
};

const Harness = ({
  onSubmit,
  error,
  initialContent = draft,
}: {
  onSubmit: (content: CreateEditableContentDto, onSuccess?: () => void) => void;
  error?: string | null;
  initialContent?: CreateEditableContentDto;
}) => {
  const [content, setContent] = useState(initialContent);
  return (
    <ToastProvider>
      <ReplyForm
        parentId={null}
        editableContent={content}
        setEditableContent={setContent}
        onSubmit={onSubmit}
        isSubmitting={false}
        setReplyingTo={() => {}}
        startExpanded
        error={error}
      />
    </ToastProvider>
  );
};

const post = () =>
  act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
  });

describe("ReplyForm", () => {
  it("keeps the text and the saved draft when the submit never succeeds", async () => {
    seedSavedDraft();
    render(<Harness onSubmit={() => {}} />);

    await post();

    expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe(
      draft.body,
    );
    expect(sessionStorage.getItem(draftStorageKey)).not.toBeNull();
  });

  it("drops the saved draft once the submit succeeds", async () => {
    seedSavedDraft();
    render(<Harness onSubmit={(_content, onSuccess) => onSuccess?.()} />);

    await post();

    expect(sessionStorage.getItem(draftStorageKey)).toBeNull();
  });

  it("retries a rejected reply with the keys, not the base64 it uploaded", async () => {
    const sent: CreateEditableContentDto[] = [];
    render(
      <Harness
        onSubmit={(content) => sent.push(content)}
        initialContent={{
          body: draft.body,
          attachments: ["data:image/png;base64,AAAA"],
        }}
      />,
    );

    await post();
    await post();

    expect(uploads).toEqual(["data:image/png;base64,AAAA", "key-0"]);
    expect(sent.map((content) => content.attachments)).toEqual([
      ["key-0"],
      ["key-0"],
    ]);
  });

  it("keeps text typed while an attachment uploads", async () => {
    const sent: CreateEditableContentDto[] = [];
    const finishUpload = deferUpload();
    render(
      <Harness
        onSubmit={(content) => sent.push(content)}
        initialContent={{
          body: draft.body,
          attachments: ["data:image/png;base64,AAAA"],
        }}
      />,
    );

    await post();
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "a second thought" },
    });
    await act(async () => finishUpload());

    expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe(
      "a second thought",
    );
    expect(sent).toEqual([{ body: draft.body, attachments: ["key-0"] }]);
  });

  it("shows the upload failure over the rejection before it", async () => {
    failUploads("Failed to upload image");
    render(
      <Harness
        onSubmit={() => {}}
        error="Reply cannot be empty"
        initialContent={{
          body: draft.body,
          attachments: ["data:image/png;base64,AAAA"],
        }}
      />,
    );

    await post();

    expect(screen.getByRole("alert").textContent).toBe(
      "Failed to upload image",
    );
  });

  it("shows the rejection next to the field it came from", () => {
    render(<Harness onSubmit={() => {}} error="Reply cannot be empty" />);

    expect(screen.getByRole("alert").textContent).toBe("Reply cannot be empty");
  });
});
