import { CreateEditableContentDto, PostTagDto } from "@alliance/shared/client";
import { uploadDraftAttachments } from "@alliance/shared/lib/uploadAttachments";
import { useState, type Dispatch, type SetStateAction } from "react";
import { View } from "react-native";
import EditableContentForm from "../EditableContentForm";
import InlineError from "../system/InlineError";
import Text from "../system/Text";
import TagChips from "../TagChips";

export const NO_TAGS: readonly PostTagDto[] = [];

export type SubmitReplyInput = {
  content: CreateEditableContentDto;
  parentId: number | null;
  onSuccess: () => void;
};

export type SubmitReply = (input: SubmitReplyInput) => void | Promise<void>;

type ReplyFormProps = {
  parentId: number | null;
  content: CreateEditableContentDto;
  setContent: Dispatch<SetStateAction<CreateEditableContentDto>>;
  onCancel?: () => void;
  autofocus?: boolean;
  objectId: number;
  error?: string | null;
  onDismissError?: () => void;
  tags?: readonly PostTagDto[];
  selectedTagId?: number;
  setSelectedTagId?: (id: number | undefined) => void;
  onSubmit: SubmitReply;
  focusOnMount: boolean;
};

export const ReplyForm = ({
  parentId,
  content,
  setContent,
  onCancel,
  autofocus,
  focusOnMount,
  objectId,
  error,
  onDismissError,
  tags = NO_TAGS,
  selectedTagId,
  setSelectedTagId,
  onSubmit,
}: ReplyFormProps) => {
  const needsTag = parentId === null && tags.length > 0;
  const expanded = autofocus || parentId !== null;
  // Local, so posting one comment leaves every other composer live.
  const [isPosting, setIsPosting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const formError = uploadError ?? error;

  const post = async () => {
    onDismissError?.();
    setUploadError(null);
    setIsPosting(true);
    try {
      const uploaded = await uploadDraftAttachments({
        sources: content.attachments,
        setAttachments: (update) =>
          setContent((prev) => ({
            ...prev,
            attachments: update(prev.attachments),
          })),
      });
      if (!uploaded.ok) {
        setUploadError(uploaded.error);
        return;
      }
      await onSubmit({
        content: { ...content, attachments: uploaded.value },
        parentId,
        onSuccess: () => setContent({ body: "", attachments: [] }),
      });
    } finally {
      setIsPosting(false);
    }
  };

  // EditableContentForm hides its Cancel button when onCancel is undefined.
  const handleCancel = onCancel
    ? () => {
        onDismissError?.();
        onCancel();
      }
    : undefined;

  return (
    <View className="p-2 bg-zinc-100 rounded">
      {needsTag && (
        <View className="mb-3">
          <Text className="text-sm text-zinc-500 mb-1.5">
            Pick a tag for your comment
          </Text>
          <TagChips
            tags={tags}
            disabled={isPosting}
            selected={selectedTagId}
            onSelect={(value) => setSelectedTagId?.(value ?? undefined)}
          />
        </View>
      )}
      <EditableContentForm
        value={content}
        onChange={(next) => {
          onDismissError?.();
          setUploadError(null);
          setContent(next);
        }}
        placeholder="Add a comment..."
        expanded={expanded}
        autoFocus={focusOnMount}
        draftKey={`reply-${parentId ?? "root"}-${objectId}`}
        onSubmit={() => void post()}
        onCancel={handleCancel}
        submitLabel="Post"
        isSubmitting={isPosting}
        submitDisabled={needsTag && selectedTagId === undefined}
      />
      <InlineError message={formError} className="mt-2" />
    </View>
  );
};
