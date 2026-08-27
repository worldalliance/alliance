import { CreateEditableContentDto } from "@alliance/shared/client";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import ReplyForm from "./ReplyForm";

afterEach(cleanup);

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
}: {
  onSubmit: (content: CreateEditableContentDto, onSuccess?: () => void) => void;
  error?: string | null;
}) => {
  const [content, setContent] = useState(draft);
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
  fireEvent.click(screen.getByRole("button", { name: "Post" }));

describe("ReplyForm", () => {
  it("keeps the text and the saved draft when the submit never succeeds", () => {
    seedSavedDraft();
    render(<Harness onSubmit={() => {}} />);

    post();

    expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe(
      draft.body,
    );
    expect(sessionStorage.getItem(draftStorageKey)).not.toBeNull();
  });

  it("drops the saved draft once the submit succeeds", () => {
    seedSavedDraft();
    render(<Harness onSubmit={(_content, onSuccess) => onSuccess?.()} />);

    post();

    expect(sessionStorage.getItem(draftStorageKey)).toBeNull();
  });

  it("shows the rejection next to the field it came from", () => {
    render(<Harness onSubmit={() => {}} error="Reply cannot be empty" />);

    expect(screen.getByRole("alert").textContent).toBe("Reply cannot be empty");
  });
});
