import { R, type Result } from "@alliance/common/result";
import { CommentDto, CreateEditableContentDto } from "@alliance/shared/client";
import { uploadAttachments } from "@alliance/shared/lib/uploadAttachments";
import { useState } from "react";

export interface CommentEditingResult {
  isEditing: boolean;
  editContent: string;
  editAttachments: string[];
  isUpdating: boolean;
  editError: string | null;
  setEditContent: (body: string) => void;
  setEditAttachments: (attachments: string[]) => void;
  startEdit: () => void;
  saveEdit: () => Promise<void>;
  cancelEdit: () => void;
}

export function useCommentEditing(
  reply: CommentDto,
  onUpdateReply: (
    id: number,
    content: CreateEditableContentDto,
  ) => Promise<Result<void, string>>,
): CommentEditingResult {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(reply.editableContent.body);
  const [editAttachments, setEditAttachments] = useState<string[]>(
    reply.editableContent.attachments,
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const startEdit = () => {
    setEditContent(reply.editableContent?.body ?? "");
    setEditAttachments(reply.editableContent?.attachments ?? []);
    setEditError(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setEditContent(reply.editableContent?.body ?? "");
    setEditAttachments(reply.editableContent?.attachments ?? []);
    setEditError(null);
    setIsEditing(false);
  };

  const saveEdit = async () => {
    setIsUpdating(true);
    setEditError(null);
    const saved = await R.fromPromiseFn(async () => {
      const uploaded = await uploadAttachments(editAttachments);
      if (!uploaded.ok) return R.failure(uploaded.error);
      return onUpdateReply(reply.id, {
        body: editContent.trim(),
        attachments: uploaded.value,
      });
    });
    setIsUpdating(false);

    if (!saved.ok) {
      console.error("Failed to update reply:", saved.error);
      setEditError("Failed to save your edit");
      return;
    }

    R.match(saved.value, {
      success: () => setIsEditing(false),
      failure: setEditError,
    });
  };

  return {
    isEditing,
    editContent,
    editAttachments,
    isUpdating,
    editError,
    setEditContent,
    setEditAttachments,
    startEdit,
    saveEdit,
    cancelEdit,
  };
}
