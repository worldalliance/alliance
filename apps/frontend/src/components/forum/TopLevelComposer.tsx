import { CreateEditableContentDto, PostTagDto } from "@alliance/shared/client";
import { useState } from "react";
import ReplyForm from "./ReplyForm";

interface TopLevelComposerProps {
  replyingTo: number | null;
  setReplyingTo: (id: number | null) => void;
  onSubmit: (
    content: CreateEditableContentDto,
    onSuccess?: () => void,
  ) => void | Promise<void>;
  focusOnMount: boolean;
  compact?: boolean;
  startExpanded?: boolean;
  error?: string | null;
  onDismissError?: () => void;
  tags: readonly PostTagDto[];
  selectedTagId?: number;
  setSelectedTagId: (id: number | undefined) => void;
}

/**
 * The thread's own composer. The draft lives here rather than beside the
 * comment tree, so a keystroke re-renders the form and nothing else.
 */
const TopLevelComposer = ({
  replyingTo,
  setReplyingTo,
  onSubmit,
  focusOnMount,
  compact,
  startExpanded,
  error,
  onDismissError,
  tags,
  selectedTagId,
  setSelectedTagId,
}: TopLevelComposerProps) => {
  const [editableContent, setEditableContent] =
    useState<CreateEditableContentDto>({ body: "", attachments: [] });

  // Hidden, not unmounted, while the user replies further down the thread. The
  // draft has to still be here when they come back.
  if (replyingTo) return null;

  return (
    <ReplyForm
      parentId={null}
      editableContent={editableContent}
      setEditableContent={setEditableContent}
      onSubmit={onSubmit}
      setReplyingTo={setReplyingTo}
      focusOnMount={focusOnMount}
      compact={compact}
      startExpanded={startExpanded}
      error={error}
      onDismissError={onDismissError}
      tags={tags}
      selectedTagId={selectedTagId}
      setSelectedTagId={setSelectedTagId}
    />
  );
};

export default TopLevelComposer;
