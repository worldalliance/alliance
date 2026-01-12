import { MessageDto } from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import { Plus, Send, X } from "lucide-react";
import {
  type ClipboardEvent,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Spinner from "@alliance/sharedweb/ui/Spinner";

interface MessageInputProps {
  message: string;
  setMessage: Dispatch<SetStateAction<string>>;
  attachments: string[];
  setAttachments: Dispatch<SetStateAction<string[]>>;
  onSend: () => Promise<void>;
  isSending?: boolean;
  replyingTo?: MessageDto;
  clearReplyingTo: () => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  compact?: boolean;
  existingConversation?: boolean;
}

const SPINNER_DELAY_MS = 150;

const MessageInput = ({
  message,
  setMessage,
  attachments,
  setAttachments,
  onSend,
  isSending,
  replyingTo,
  clearReplyingTo,
  inputRef,
  compact = false,
  existingConversation = true,
}: MessageInputProps) => {
  const [showSpinner, setShowSpinner] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canSend = message.trim().length > 0 || attachments.length > 0;

  // Only show spinner after a short delay to avoid flicker
  useEffect(() => {
    if (isSending) {
      const timer = setTimeout(() => setShowSpinner(true), SPINNER_DELAY_MS);
      return () => clearTimeout(timer);
    } else {
      setShowSpinner(false);
    }
  }, [isSending]);

  const readImagesFromFiles = useCallback(async (files: File[]) => {
    const readers: Promise<string>[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      readers.push(
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        })
      );
    }
    return Promise.all(readers);
  }, []);

  const handleFilesSelected = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files || files.length === 0) return;
      try {
        const base64s = await readImagesFromFiles(Array.from(files));
        if (base64s.length > 0) {
          setAttachments((prev) => [...prev, ...base64s]);
          inputRef.current?.focus();
        }
      } catch (err) {
        console.error("Failed reading image file(s)", err);
      }
    },
    [readImagesFromFiles, setAttachments, inputRef]
  );

  const handlePaste = useCallback(
    async (e: ClipboardEvent<HTMLTextAreaElement>) => {
      try {
        const items = Array.from(e.clipboardData?.items ?? []);
        const imageFiles: File[] = [];

        for (const item of items) {
          if (item.kind === "file" && item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) imageFiles.push(file);
          }
        }

        if (imageFiles.length === 0 && e.clipboardData?.files?.length) {
          for (let i = 0; i < e.clipboardData.files.length; i++) {
            const file = e.clipboardData.files[i];
            if (file && file.type.startsWith("image/")) imageFiles.push(file);
          }
        }

        if (imageFiles.length > 0) {
          e.preventDefault();
          await handleFilesSelected(imageFiles);
        }
      } catch (err) {
        console.error("Failed to paste image(s)", err);
      }
    },
    [handleFilesSelected]
  );

  const triggerSend = useCallback(() => {
    if (!isSending && canSend) {
      onSend();
    }
  }, [isSending, canSend, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      triggerSend();
    }
    if (e.key === "Escape") {
      clearReplyingTo();
    }
  };

  const triggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  useEffect(() => {
    if (inputRef.current && message !== null) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = inputRef.current.scrollHeight + "px";
    }
    if (inputRef.current && !message) {
      inputRef.current.style.height = "auto";
    }
  }, [message, inputRef]);

  return (
    <div
      className={`flex flex-col gap-y-3 bg-white relative ${
        compact ? "px-4 pb-2" : "px-8 pb-4"
      }`}
    >
      {replyingTo && (
        <Card className="p-3 flex flex-row items-center justify-between">
          <div className="flex flex-row gap-x-2 text-zinc-500 text-sm">
            <div>Replying to:</div>
            {replyingTo.body && (
              <div className="text-black">{replyingTo.body}</div>
            )}
            {!replyingTo.body && replyingTo.attachments.length && (
              <div className="text-black">image</div>
            )}
          </div>
          <Button
            color={ButtonColor.Transparent}
            onClick={clearReplyingTo}
            className="!p-2 -m-2"
          >
            <X size={18} />
          </Button>
        </Card>
      )}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((img, idx) => (
            <div
              key={`${idx}-${img.substring(0, 8)}`}
              className="relative inline-block"
            >
              <img
                src={img}
                className="w-20 h-20 object-cover rounded border border-zinc-200"
              />
              <button
                type="button"
                onClick={() =>
                  setAttachments((prev) => prev.filter((_, i) => i !== idx))
                }
                className="absolute -top-2 -right-2 bg-black/70 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center"
                aria-label="Remove image"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative border border-zinc-200 rounded-md bg-zinc-100 focus-within:ring-1 focus-within:ring-zinc-400">
        <textarea
          ref={inputRef}
          value={message}
          autoFocus={!compact && existingConversation}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Message"
          className="w-full border-none bg-transparent p-3 text-black resize-none focus:outline-none pr-9 text-[16px]"
          rows={1}
        />
        <div className="absolute right-2 top-0 bottom-0 flex items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void handleFilesSelected(e.target.files);
              if (e.target) {
                e.target.value = "";
              }
            }}
          />
          {showSpinner ? (
            <div className="pr-2">
              <Spinner size="small" />
            </div>
          ) : (
            <div className="flex flex-row gap-x-1 items-center">
              <Button
                onClick={triggerFilePicker}
                color={ButtonColor.Transparent}
                className="!px-2"
                hoverText="Add image"
              >
                <Plus size={18} />
              </Button>
              <Button
                onClick={triggerSend}
                color={ButtonColor.Transparent}
                hoverText="Send message"
                className="!px-2 h-full"
              >
                <Send size={17} />
              </Button>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 text-sm text-zinc-600 px-1"></div>
    </div>
  );
};

export default MessageInput;
