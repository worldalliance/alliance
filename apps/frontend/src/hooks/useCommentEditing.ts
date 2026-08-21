import { CommentDto, CreateEditableContentDto } from "@alliance/shared/client";
import { useState } from "react";
import { uploadAttachments } from "../lib/uploadAttachments";

export interface CommentEditingResult {
  isEditing: boolean;
  editContent: string;
  editAttachments: string[];
  isUpdating: boolean;
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
  ) => Promise<void>,
): CommentEditingResult {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(reply.editableContent.body);
  const [editAttachments, setEditAttachments] = useState<string[]>(
    reply.editableContent.attachments,
  );
  const [isUpdating, setIsUpdating] = useState(false);

  const startEdit = () => {
    setEditContent(reply.editableContent?.body ?? "");
    setEditAttachments(reply.editableContent?.attachments ?? []);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setEditContent(reply.editableContent?.body ?? "");
    setEditAttachments(reply.editableContent?.attachments ?? []);
    setIsEditing(false);
  };

  const saveEdit = async () => {
    setIsUpdating(true);
    try {
      const attachmentKeys = await uploadAttachments(editAttachments);
      await onUpdateReply(reply.id, {
        body: editContent.trim(),
        attachments: attachmentKeys,
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update reply:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  return {
    isEditing,
    editContent,
    editAttachments,
    isUpdating,
    setEditContent,
    setEditAttachments,
    startEdit,
    saveEdit,
    cancelEdit,
  };
}
