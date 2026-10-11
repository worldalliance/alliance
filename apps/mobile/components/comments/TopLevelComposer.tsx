import { CreateEditableContentDto, PostTagDto } from "@alliance/shared/client";
import { useState } from "react";
import { TouchableOpacity } from "react-native";
import Text from "../system/Text";
import { ReplyForm, type SubmitReply } from "./ReplyForm";

type TopLevelComposerProps = {
  replyingTo: number | null;
  isComposing: boolean;
  setIsComposing: (composing: boolean) => void;
  focusComposer: boolean;
  setFocusComposer: (focus: boolean) => void;
  objectId: number;
  error?: string | null;
  onDismissError?: () => void;
  tags: readonly PostTagDto[];
  selectedTagId?: number;
  setSelectedTagId: (id: number | undefined) => void;
  onSubmit: SubmitReply;
};

/**
 * The thread's own composer. The draft lives here rather than beside the
 * comment tree, so a keystroke re-renders the form and nothing else.
 */
export const TopLevelComposer = ({
  replyingTo,
  isComposing,
  setIsComposing,
  focusComposer,
  setFocusComposer,
  objectId,
  error,
  onDismissError,
  tags,
  selectedTagId,
  setSelectedTagId,
  onSubmit,
}: TopLevelComposerProps) => {
  const [content, setContent] = useState<CreateEditableContentDto>({
    body: "",
    attachments: [],
  });

  if (replyingTo) return null;

  if (!isComposing) {
    return (
      <TouchableOpacity
        onPress={() => {
          setIsComposing(true);
          setFocusComposer(true);
        }}
        activeOpacity={0.7}
        className="p-3 bg-zinc-100 rounded"
      >
        <Text className="text-zinc-500">Add a comment...</Text>
      </TouchableOpacity>
    );
  }

  return (
    <ReplyForm
      parentId={null}
      content={content}
      setContent={setContent}
      autofocus
      focusOnMount={focusComposer}
      onCancel={() => setIsComposing(false)}
      objectId={objectId}
      error={error}
      onDismissError={onDismissError}
      tags={tags}
      selectedTagId={selectedTagId}
      setSelectedTagId={setSelectedTagId}
      onSubmit={onSubmit}
    />
  );
};
