import { CreateEditableContentDto, PostTagDto } from "@alliance/shared/client";
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

// happy-dom leaves `location` where it is on `history.pushState`.
declare const happyDOM: { setURL: (url: string) => void };
const setUrl = (url: string) => happyDOM.setURL(url);

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

const tags: PostTagDto[] = [
  { id: 1, name: "Question", sortOrder: 0 },
  { id: 2, name: "Idea", sortOrder: 1 },
];

const Harness = ({
  parentId = null,
  onSubmit,
  onCancel,
  error,
  initialContent = draft,
  withTags = false,
  startExpanded = true,
  focusOnMount = true,
}: {
  parentId?: number | null;
  onSubmit: (
    content: CreateEditableContentDto,
    onSuccess?: () => void,
  ) => void | Promise<void>;
  onCancel?: () => void;
  error?: string | null;
  initialContent?: CreateEditableContentDto;
  withTags?: boolean;
  startExpanded?: boolean;
  focusOnMount?: boolean;
}) => {
  const [content, setContent] = useState(initialContent);
  const [selectedTagId, setSelectedTagId] = useState<number | undefined>(
    withTags ? tags[0]!.id : undefined,
  );
  return (
    <ToastProvider>
      <ReplyForm
        parentId={parentId}
        editableContent={content}
        setEditableContent={setContent}
        onSubmit={onSubmit}
        onCancel={onCancel}
        setReplyingTo={() => {}}
        focusOnMount={focusOnMount}
        startExpanded={startExpanded}
        error={error}
        tags={withTags ? tags : []}
        selectedTagId={selectedTagId}
        setSelectedTagId={setSelectedTagId}
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

  it("drops the saved draft of a composer that closed before the post landed", async () => {
    seedSavedDraft();
    let succeed = () => {};
    const { unmount } = render(
      <Harness
        onSubmit={(_content, onSuccess) => {
          succeed = () => onSuccess?.();
        }}
      />,
    );

    await post();
    unmount();
    await act(async () => succeed());

    expect(sessionStorage.getItem(draftStorageKey)).toBeNull();
  });

  it("drops the draft it posted after the page moved on", async () => {
    seedSavedDraft();
    const url = window.location.href;
    let succeed = () => {};
    const { unmount } = render(
      <Harness
        onSubmit={(_content, onSuccess) => {
          succeed = () => onSuccess?.();
        }}
      />,
    );

    await post();
    unmount();
    setUrl("http://localhost/another-thread");
    try {
      await act(async () => succeed());
    } finally {
      setUrl(url);
    }

    expect(sessionStorage.getItem(draftStorageKey)).toBeNull();
  });

  it("keeps a draft it was handed over the older copy that draft saved", () => {
    seedSavedDraft();
    const typedSince = `${draft.body} and a few words more`;
    render(
      <Harness
        onSubmit={() => {}}
        initialContent={{ body: typedSince, attachments: [] }}
      />,
    );

    expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe(
      typedSince,
    );
  });

  it("restores a saved draft into a composer that mounts empty", () => {
    seedSavedDraft();
    render(
      <Harness
        onSubmit={() => {}}
        initialContent={{ body: "", attachments: [] }}
      />,
    );

    expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe(
      draft.body,
    );
  });

  it("retries a rejected reply with the keys, not the base64 it uploaded", async () => {
    const sent: CreateEditableContentDto[] = [];
    render(
      <Harness
        onSubmit={(content) => {
          sent.push(content);
        }}
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

  it("leaves a second composer live while this one posts", async () => {
    render(
      <>
        <Harness onSubmit={() => new Promise<void>(() => {})} />
        <Harness
          onSubmit={() => {}}
          initialContent={{ body: "", attachments: [] }}
        />
      </>,
    );

    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Post" })[0]!);
    });

    const [posting, other] =
      screen.getAllByRole<HTMLTextAreaElement>("textbox");
    expect(posting!.readOnly).toBe(true);
    expect(other!.readOnly).toBe(false);
    fireEvent.change(other!, { target: { value: "my own reply" } });
    expect(other!.value).toBe("my own reply");
  });

  it("freezes the draft while an attachment uploads, so the post is not stale", async () => {
    const sent: CreateEditableContentDto[] = [];
    const finishUpload = deferUpload();
    render(
      <Harness
        onSubmit={(content) => {
          sent.push(content);
        }}
        initialContent={{
          body: draft.body,
          attachments: ["data:image/png;base64,AAAA"],
        }}
      />,
    );

    await post();
    const textarea = screen.getByRole<HTMLTextAreaElement>("textbox");
    expect(textarea.readOnly).toBe(true);
    fireEvent.change(textarea, { target: { value: "a second thought" } });
    expect(textarea.value).toBe(draft.body);

    await act(async () => finishUpload());

    expect(sent).toEqual([{ body: draft.body, attachments: ["key-0"] }]);
    expect(textarea.readOnly).toBe(false);
  });

  it("stays frozen while the post is in flight", async () => {
    const sent: CreateEditableContentDto[] = [];
    let finishPost = () => {};
    const posted = new Promise<void>((resolve) => {
      finishPost = resolve;
    });
    render(
      <Harness
        onSubmit={(content, onSuccess) => {
          sent.push(content);
          return posted.then(() => onSuccess?.());
        }}
      />,
    );

    await post();
    const textarea = screen.getByRole<HTMLTextAreaElement>("textbox");
    expect(textarea.readOnly).toBe(true);
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Cancel" })
        .disabled,
    ).toBe(true);
    fireEvent.change(textarea, { target: { value: "a second thought" } });
    expect(textarea.value).toBe(draft.body);

    await act(async () => finishPost());

    expect(sent).toEqual([{ body: draft.body, attachments: [] }]);
    expect(textarea.readOnly).toBe(false);
  });

  it("freezes cancel too, so a discard cannot race the post it started", async () => {
    const finishUpload = deferUpload();
    render(
      <Harness
        onSubmit={() => {}}
        initialContent={{
          body: draft.body,
          attachments: ["data:image/png;base64,AAAA"],
        }}
      />,
    );

    await post();
    const cancel = screen.getByRole<HTMLButtonElement>("button", {
      name: "Cancel",
    });
    expect(cancel.disabled).toBe(true);

    await act(async () => finishUpload());

    expect(cancel.disabled).toBe(false);
  });

  it("ignores a discard confirmed after the post it could not stop", async () => {
    const finishUpload = deferUpload();
    let discarded = false;
    render(
      <Harness
        onSubmit={(_content, onSuccess) => onSuccess?.()}
        onCancel={() => {
          discarded = true;
        }}
        initialContent={{
          body: draft.body,
          attachments: ["data:image/png;base64,AAAA"],
        }}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    });
    await post();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    });
    await act(async () => finishUpload());

    expect(discarded).toBe(false);
  });

  it("opens on a draft it was handed, so the text has a Post button", () => {
    render(<Harness onSubmit={() => {}} startExpanded={false} />);

    expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe(
      draft.body,
    );
    expect(screen.getByRole("button", { name: "Post" })).toBeTruthy();
  });

  it("takes no focus when it comes back after a reply posted", () => {
    render(
      <Harness
        onSubmit={() => {}}
        focusOnMount={false}
        initialContent={{ body: "", attachments: [] }}
      />,
    );

    expect(document.activeElement).not.toBe(screen.getByRole("textbox"));
  });

  it("takes the caret over a draft it was handed", () => {
    render(<Harness onSubmit={() => {}} />);

    expect(document.activeElement).toBe(screen.getByRole("textbox"));
  });

  it("stays shut on an empty draft", () => {
    render(
      <Harness
        onSubmit={() => {}}
        initialContent={{ body: "", attachments: [] }}
        startExpanded={false}
      />,
    );

    expect(screen.queryByRole("button", { name: "Post" })).toBeNull();
  });

  it("stays shut on a space, which is not enough to post", () => {
    render(
      <Harness
        onSubmit={() => {}}
        initialContent={{ body: "", attachments: [] }}
        startExpanded={false}
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: " " } });

    expect(screen.queryByRole("button", { name: "Post" })).toBeNull();
  });

  it("opens on the first real character, so the text has a Post button", () => {
    render(
      <Harness
        onSubmit={() => {}}
        initialContent={{ body: "", attachments: [] }}
        startExpanded={false}
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "a" } });

    expect(screen.getByRole("button", { name: "Post" })).toBeTruthy();
  });

  it("shuts again once the text it opened on is gone", () => {
    render(
      <Harness
        onSubmit={() => {}}
        initialContent={{ body: "", attachments: [] }}
        startExpanded={false}
      />,
    );

    const textbox = screen.getByRole("textbox");
    fireEvent.change(textbox, { target: { value: "a" } });
    fireEvent.change(textbox, { target: { value: "" } });

    expect(screen.queryByRole("button", { name: "Post" })).toBeNull();
  });

  it("empties the draft it posted, so reopening the composer starts clean", async () => {
    render(<Harness onSubmit={(_content, onSuccess) => onSuccess?.()} />);

    await post();

    expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe("");
  });

  it("freezes the tag picker too, so the post carries the tag the composer shows", async () => {
    const finishUpload = deferUpload();
    render(
      <Harness
        onSubmit={() => {}}
        withTags
        initialContent={{
          body: draft.body,
          attachments: ["data:image/png;base64,AAAA"],
        }}
      />,
    );

    await post();
    const otherTag = screen.getByRole<HTMLButtonElement>("button", {
      name: "Idea",
    });
    expect(otherTag.disabled).toBe(true);

    await act(async () => finishUpload());

    expect(otherTag.disabled).toBe(false);
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
