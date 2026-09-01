import { R } from "@alliance/common/result";
import { CommentDto } from "@alliance/shared/client";
import { act, renderHook } from "@testing-library/react";

import {
  resetUploads,
  uploadImageDataUri,
  uploads,
} from "../testing/uploadImageDataUriMock";

jest.mock("@alliance/shared/lib/uploadImageDataUri", () => ({
  uploadImageDataUri,
}));

import { useCommentEditing } from "./useCommentEditing";

const reply: CommentDto = {
  id: 100,
  parentObjectType: "post",
  parentObjectId: 1,
  deleted: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  pinned: false,
  tagId: null,
  author: {
    id: 1,
    displayName: "Jane Smith",
    profilePicture: "",
    admin: false,
    staff: false,
    ambassador: false,
    profileDescription: null,
    hasActiveContract: true,
    isCommunityLeader: false,
    anonymous: false,
  },
  children: [],
  likes: [],
  likesCount: 0,
  editableContent: { body: "the original", attachments: [] },
};

const editWith = async (
  onUpdateReply: Parameters<typeof useCommentEditing>[1],
  attachments: string[] = [],
) => {
  const { result } = renderHook(() => useCommentEditing(reply, onUpdateReply));
  act(() => result.current.startEdit());
  act(() => result.current.setEditContent("the rewrite"));
  act(() => result.current.setEditAttachments(attachments));
  await act(() => result.current.saveEdit());
  return result;
};

describe("useCommentEditing", () => {
  it("keeps the rewrite in an open editor when the server rejects it", async () => {
    const result = await editWith(async () =>
      R.failure("You can only edit your own replies"),
    );

    expect(result.current.isEditing).toBe(true);
    expect(result.current.editContent).toBe("the rewrite");
    expect(result.current.editError).toBe("You can only edit your own replies");
  });

  it("retries a rejected edit with the keys, not the base64 it uploaded", async () => {
    resetUploads();
    const result = await editWith(
      async () => R.failure("Try again"),
      ["data:image/png;base64,AAAA"],
    );

    expect(result.current.editAttachments).toEqual(["key-0"]);

    await act(() => result.current.saveEdit());
    expect(uploads).toEqual(["data:image/png;base64,AAAA"]);
  });

  it("closes the editor once the save lands", async () => {
    const result = await editWith(async () => R.success(undefined));

    expect(result.current.isEditing).toBe(false);
    expect(result.current.editError).toBeNull();
  });
});
