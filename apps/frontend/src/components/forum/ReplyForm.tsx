import { CreateEditableContentDto } from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import React, { useCallback, useState } from "react";
import EditableContentForm from "@alliance/shared/ui/EditableContentForm";

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
    [editableContent, onSubmit]
  );

  return (
    <div
      className={`rounded relative border border-zinc-200 ${className ?? ""} ${
        parentId ? "mt-0" : "mt-3"
      } ${compact ? "p-1 md:p-2 bg-zinc-100" : "p-2 md:p-4 bg-white"}`}
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
          <div className="mt-3 flex justify-end space-x-2 items-center">
            <p className="text-sm text-zinc-500 pr-2 hidden sm:block">
              Drag an image to attach
            </p>
            {parentId && (
              <Button
                type="button"
                color={ButtonColor.Grey}
                onClick={() => {
                  setReplyingTo(null);
                  setEditableContent({ body: "", attachments: [] });
                  onCancel?.();
                }}
              >
                Cancel
              </Button>
            )}
            {!parentId && (
              <Button
                type="button"
                color={ButtonColor.Grey}
                onClick={() => {
                  setEditableContent({ body: "", attachments: [] });
                  setExpanded(false);
                  onCancel?.();
                }}
              >
                Cancel
              </Button>
            )}

            <Button
              type="submit"
              color={ButtonColor.Stone}
              disabled={
                isSubmitting ||
                (!editableContent.body.trim() &&
                  editableContent.attachments.length === 0)
              }
              className={`transition disabled:opacity-50 text-nowrap`}
            >
              {isSubmitting ? "Posting..." : "Post Comment"}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
};

export default ReplyForm;
