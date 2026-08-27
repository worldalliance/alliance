import { CreateEditableContentDto } from "@alliance/shared/client";
import {
  uploadAttachments,
  withUploadedKeys,
} from "@alliance/shared/lib/uploadAttachments";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import EditableContentForm from "@alliance/sharedweb/ui/EditableContentForm";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import React, {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

interface ReplyFormProps {
  parentId: number | null;
  onCancel?: () => void;
  editableContent: CreateEditableContentDto;
  setEditableContent: Dispatch<SetStateAction<CreateEditableContentDto>>;
  onSubmit: (content: CreateEditableContentDto, onSuccess?: () => void) => void;
  isSubmitting: boolean;
  setReplyingTo: (id: number | null) => void;
  compact?: boolean;
  className?: string;
  startExpanded?: boolean;
  error?: string | null;
  onDismissError?: () => void;
}

const ReplyForm: React.FC<ReplyFormProps> = ({
  parentId,
  onCancel,
  editableContent,
  setEditableContent,
  onSubmit,
  isSubmitting,
  setReplyingTo,
  compact,
  className,
  startExpanded = false,
  error,
  onDismissError,
}: ReplyFormProps) => {
  const [expanded, setExpanded] = useState(startExpanded);
  const [clearDraftSignal, setClearDraftSignal] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const submit = useCallback(async () => {
    onDismissError?.();
    setUploadError(null);
    setIsUploading(true);
    const sources = editableContent.attachments;
    const uploaded = await uploadAttachments(sources);
    setIsUploading(false);
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
    onSubmit({ ...editableContent, attachments: uploaded.value }, () => {
      setClearDraftSignal((x) => x + 1);
      setExpanded(false);
    });
  }, [editableContent, onSubmit, onDismissError, setEditableContent]);

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
    if (!ok) return;
    onDismissError?.();
    setEditableContent({ body: "", attachments: [] });
    setExpanded(false);
    setReplyingTo(null);
    onCancel?.();
  }, [
    onCancel,
    confirm,
    onDismissError,
    setEditableContent,
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
          clearDraftSignal={clearDraftSignal}
          draftKey={`reply-${parentId}`}
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
                isSubmitting ||
                isUploading ||
                (!editableContent.body.trim() &&
                  editableContent.attachments.length === 0)
              }
              className="transition disabled:opacity-50 text-nowrap"
            >
              {isSubmitting || isUploading ? "Posting..." : "Post"}
            </Button>
            <Button
              type="button"
              color={ButtonColor.Grey}
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
