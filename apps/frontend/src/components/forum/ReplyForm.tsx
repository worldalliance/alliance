import { CreateEditableContentDto, PostTagDto } from "@alliance/shared/client";
import {
  uploadAttachments,
  withUploadedKeys,
} from "@alliance/shared/lib/uploadAttachments";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import EditableContentForm, {
  clearDraft,
  useDraftStorageKey,
} from "@alliance/sharedweb/ui/EditableContentForm";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import React, {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import TagChips from "./TagChips";

interface ReplyFormProps {
  parentId: number | null;
  onCancel?: () => void;
  editableContent: CreateEditableContentDto;
  setEditableContent: Dispatch<SetStateAction<CreateEditableContentDto>>;
  onSubmit: (
    content: CreateEditableContentDto,
    onSuccess?: () => void,
  ) => void | Promise<void>;
  setReplyingTo: (id: number | null) => void;
  compact?: boolean;
  className?: string;
  startExpanded?: boolean;
  error?: string | null;
  onDismissError?: () => void;
  tags?: readonly PostTagDto[];
  selectedTagId?: number;
  setSelectedTagId?: (id: number | undefined) => void;
}

const ReplyForm: React.FC<ReplyFormProps> = ({
  parentId,
  onCancel,
  editableContent,
  setEditableContent,
  onSubmit,
  setReplyingTo,
  compact,
  className,
  startExpanded = false,
  error,
  onDismissError,
  tags = [],
  selectedTagId,
  setSelectedTagId,
}: ReplyFormProps) => {
  const [expanded, setExpanded] = useState(startExpanded);
  const needsTag = parentId === null && tags.length > 0;
  const storageKey = useDraftStorageKey(`reply-${parentId}`);
  const [clearDraftSignal, setClearDraftSignal] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Local, so posting one comment leaves every other composer live.
  const [isPosting, setIsPosting] = useState(false);
  // The discard confirm resumes in a later render than the one it opened in, so
  // it reads the freeze from here rather than from a captured `isPosting`.
  const isPostingRef = useRef(false);

  const submit = useCallback(async () => {
    onDismissError?.();
    setUploadError(null);
    isPostingRef.current = true;
    setIsPosting(true);
    try {
      const sources = editableContent.attachments;
      const uploaded = await uploadAttachments(sources);
      if (!uploaded.ok) {
        setUploadError(uploaded.error);
        return;
      }
      setEditableContent((prev) => ({
        ...prev,
        attachments: withUploadedKeys({
          current: prev.attachments,
          sources,
          keys: uploaded.value,
        }),
      }));
      // Clear the draft only once the server accepts, so a rejected comment
      // keeps its text.
      await onSubmit(
        { ...editableContent, attachments: uploaded.value },
        () => {
          // Collapsing the thread or replying elsewhere unmounts this form
          // while the post is in flight, and the signal below dies with it.
          clearDraft(storageKey);
          setClearDraftSignal((x) => x + 1);
          setExpanded(false);
        },
      );
    } finally {
      isPostingRef.current = false;
      setIsPosting(false);
    }
  }, [
    editableContent,
    onSubmit,
    onDismissError,
    setEditableContent,
    storageKey,
  ]);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      void submit();
    },
    [submit],
  );

  const { confirm } = useToast();
  const cancelRef = useRef<HTMLDivElement>(null);

  const handleCancel = useCallback(async () => {
    const ok =
      editableContent.body.length < 10
        ? true
        : await confirm({
            title: "Discard draft?",
            confirmLabel: "Discard",
            cancelLabel: "Keep writing",
            anchorEl: cancelRef.current,
            placement: "topleft",
          });
    if (!ok || isPostingRef.current) return;
    onDismissError?.();
    setEditableContent({ body: "", attachments: [] });
    setSelectedTagId?.(undefined);
    setExpanded(false);
    setReplyingTo(null);
    onCancel?.();
  }, [
    onCancel,
    confirm,
    onDismissError,
    setEditableContent,
    setSelectedTagId,
    setReplyingTo,
    editableContent.body,
  ]);

  return (
    <div
      className={cn(
        "rounded-lg relative bg-grey-1",
        className,
        parentId ? "mt-0" : "mt-3",
        compact ? "p-1 md:p-2" : "p-2 md:p-3",
      )}
    >
      <form onSubmit={handleSubmit}>
        <EditableContentForm
          value={editableContent}
          expanded={expanded}
          disabled={isPosting}
          clearDraftSignal={clearDraftSignal}
          storageKey={storageKey}
          onChange={(val) => {
            onDismissError?.();
            setUploadError(null);
            setEditableContent(val);
            if ((val.body || val.attachments.length > 0) && !expanded)
              setExpanded(true);

            if (
              expanded &&
              val.body.trim() === "" &&
              val.attachments.length === 0
            )
              setExpanded(false);
          }}
          placeholder={"Add a comment..."}
        />
        {expanded && needsTag && (
          <div className="mt-3">
            <p className="text-sm text-zinc-500 mb-1.5">
              Pick a tag for your comment
            </p>
            <TagChips
              tags={tags}
              disabled={isPosting}
              selected={selectedTagId}
              onSelect={(value) => setSelectedTagId?.(value ?? undefined)}
            />
          </div>
        )}
        {(uploadError ?? error) && (
          <p role="alert" className="mt-2 text-sm text-red-500">
            {uploadError ?? error}
          </p>
        )}
        {expanded && (
          <div
            className="mt-3 flex justify-start gap-x-2 items-center flex-row-reverse"
            ref={cancelRef}
          >
            <Button
              type="submit"
              color={ButtonColor.Stone}
              disabled={
                isPosting ||
                (needsTag && selectedTagId === undefined) ||
                (!editableContent.body.trim() &&
                  editableContent.attachments.length === 0)
              }
              className="transition disabled:opacity-50 text-nowrap"
            >
              {isPosting ? "Posting..." : "Post"}
            </Button>
            <Button
              type="button"
              color={ButtonColor.Grey}
              disabled={isPosting}
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <p className="text-sm text-zinc-500 pr-2 hidden sm:block">
              Drag an image to attach - Add style with{" "}
              <a
                href="https://www.markdownguide.org/cheat-sheet/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                markdown
              </a>
            </p>
          </div>
        )}
      </form>
    </div>
  );
};

export default ReplyForm;
