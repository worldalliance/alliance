import { CreateEditableContentDto } from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import EditableContentForm from "@alliance/sharedweb/ui/EditableContentForm";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import React, { useCallback, useRef, useState } from "react";

interface ReplyFormProps {
  parentId: number | null;
  onCancel?: () => void;
  editableContent: CreateEditableContentDto;
  setEditableContent: (val: CreateEditableContentDto) => void;
  onSubmit: (content: CreateEditableContentDto, onSuccess?: () => void) => void;
  isSubmitting: boolean;
  setReplyingTo: (id: number | null) => void;
  compact?: boolean;
  className?: string;
  startExpanded?: boolean;
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
}: ReplyFormProps) => {
  const [expanded, setExpanded] = useState(startExpanded);
  const [clearDraftSignal, setClearDraftSignal] = useState(0);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setClearDraftSignal((x) => x + 1);
      onSubmit(editableContent, () => {
        setExpanded(false);
      });
    },
    [editableContent, onSubmit],
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
    setEditableContent({ body: "", attachments: [] });
    setExpanded(false);
    setReplyingTo(null);
    onCancel?.();
  }, [
    onCancel,
    confirm,
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
                (!editableContent.body.trim() &&
                  editableContent.attachments.length === 0)
              }
              className="transition disabled:opacity-50 text-nowrap"
            >
              {isSubmitting ? "Posting..." : "Post"}
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
