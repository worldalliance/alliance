import { CreateEditableContentDto } from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import React, { useEffect, useMemo, useRef, useState } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { htmlToMarkdownFromDocs } from "../lib/htmlToMarkdown";
import { resolveImageSrc } from "../lib/imageSrc";

interface EditableContentFormProps {
  value: CreateEditableContentDto;
  onChange: (value: CreateEditableContentDto) => void;
  className?: string;
  placeholder?: string;
  expanded?: boolean;
  /** Defaults to `expanded`. Set it to open a form without taking focus. */
  autoFocus?: boolean;
  /** Freezes the draft, so a submit in flight cannot post a stale copy of it. */
  disabled?: boolean;

  /** Names this draft, from `draftStorageKey`. Without it nothing is saved or restored. */
  storageKey?: string;
  /** Debounce interval for autosave (ms) */
  autosaveMs?: number;
  /** Whether to restore a found draft on mount */
  restoreDraft?: boolean;
  /** Called after a draft is restored */
  onDraftRestored?: (restored: CreateEditableContentDto) => void;
  /**
   * Increment or change this after a successful server save to clear the local draft.
   * Example: setClearDraftSignal((x)=>x+1)
   */
  clearDraftSignal?: number;
}

const STORAGE_PREFIX = "editablecontent:draft:v1";

/**
 * Names a draft in session storage. The name carries the URL, so a form that
 * outlives a navigation has to hold the name it resolved. `useDraftStorageKey`
 * holds it.
 */
export function draftStorageKey(draftKey?: string) {
  if (typeof window === "undefined") return `${STORAGE_PREFIX}:ssr`;
  const urlPart =
    window.location.origin + window.location.pathname + window.location.search;
  return `${STORAGE_PREFIX}:${urlPart}${draftKey ? `:${draftKey}` : ""}`;
}

/** Holds the name from mount, so a navigation cannot rename a draft mid-life. */
export function useDraftStorageKey(draftKey?: string) {
  return useMemo(() => draftStorageKey(draftKey), [draftKey]);
}

/** Drops a saved draft without the form that wrote it having to still be mounted. */
export function clearDraft(storageKey: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(storageKey);
}

const EditableContentForm: React.FC<EditableContentFormProps> = ({
  value,
  onChange,
  className,
  placeholder,
  expanded,
  autoFocus,
  disabled = false,
  storageKey,
  autosaveMs = 1200,
  restoreDraft,
  onDraftRestored,
  clearDraftSignal,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const saveTimer = useRef<number | null>(null);
  const lastSavedHashRef = useRef<string>("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const shouldRestoreDraft = restoreDraft ?? storageKey !== undefined;

  useEffect(() => {
    if (!shouldRestoreDraft || !storageKey || typeof window === "undefined")
      return;

    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return;

    const parsed = JSON.parse(raw) as {
      dto: CreateEditableContentDto;
      savedAt: string;
    };

    const currentHash = JSON.stringify(value);
    const storedHash = JSON.stringify(parsed.dto);
    if (storedHash !== currentHash) {
      onChange(parsed.dto);
      onDraftRestored?.(parsed.dto);
    }
    lastSavedHashRef.current = storedHash;
  }, [shouldRestoreDraft]);

  useEffect(() => {
    if (typeof window === "undefined" || !storageKey) return;

    const doSave = () => {
      const hash = JSON.stringify(value);
      if (hash === lastSavedHashRef.current) return; // nothing changed since last save
      const payload = JSON.stringify({
        dto: value,
        savedAt: new Date().toISOString(),
      });
      sessionStorage.setItem(storageKey, payload);
      lastSavedHashRef.current = hash;
    };

    if (saveTimer.current) window.clearTimeout(saveTimer.current);

    if (clearDraftSignal !== undefined) {
      saveTimer.current = window.setTimeout(
        doSave,
        autosaveMs,
      ) as unknown as number;
    }

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [value, autosaveMs]);

  // Allow parent to clear the draft after a successful real save
  useEffect(() => {
    if (typeof window === "undefined" || !storageKey) return;
    if (!clearDraftSignal) return;
    try {
      sessionStorage.removeItem(storageKey);
      lastSavedHashRef.current = JSON.stringify(value);
    } catch {
      // ignore
    }
  }, [clearDraftSignal]);

  const readImagesFromFiles = async (files: File[]): Promise<string[]> => {
    const readers: Promise<string>[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      readers.push(
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        }),
      );
    }
    return Promise.all(readers);
  };

  const handleFilesSelected = async (e: {
    target?: { files: FileList | null };
    dataTransfer?: DataTransfer | null;
  }) => {
    const files = e.target?.files ?? e.dataTransfer?.files ?? null;
    if (disabled || !files || files.length === 0) return;

    try {
      const base64s = await readImagesFromFiles(Array.from(files));
      onChange({
        ...value,
        attachments: [...(value.attachments ?? []), ...base64s],
      });
    } catch (err) {
      console.error("Failed reading image file(s)", err);
    }
  };

  const onPaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (disabled) return;
    try {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageFiles: File[] = [];

      for (const item of items) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      // Fallback: some browsers may not populate items for images but will set files
      if (imageFiles.length === 0 && e.clipboardData?.files?.length) {
        for (let i = 0; i < e.clipboardData.files.length; i++) {
          const file = e.clipboardData.files[i];
          if (file && file.type.startsWith("image/")) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        // Prevent default paste of blob name/text into the textarea
        e.preventDefault();
        const base64s = await readImagesFromFiles(imageFiles);
        onChange({
          ...value,
          attachments: [...(value.attachments ?? []), ...base64s],
        });
        return;
      }

      // Convert HTML paste (bold, italic, links) to markdown
      const html = e.clipboardData.getData("text/html");
      if (html) {
        e.preventDefault();
        const md = htmlToMarkdownFromDocs(html);
        const ta = textareaRef.current;
        if (ta) {
          const before = value.body.slice(0, ta.selectionStart);
          const after = value.body.slice(ta.selectionEnd);
          onChange({ ...value, body: before + md + after });
        } else {
          onChange({ ...value, body: value.body + md });
        }
      }
    } catch (err) {
      console.error("Failed to process pasted content", err);
    }
  };

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    setIsDragging(true);
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) setIsDragging(false);
  };
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;
    await handleFilesSelected({ dataTransfer: e.dataTransfer });
  };

  return (
    <div
      className={cn("relative", className)}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <TextareaAutosize
        ref={textareaRef}
        className={cn(
          "w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-transparent border-none",
          !expanded && "resize-none",
          disabled && "opacity-50 cursor-not-allowed",
        )}
        minRows={expanded ? 2 : 1}
        value={value.body}
        readOnly={disabled}
        onChange={(e) => {
          if (disabled) return;
          onChange({ ...value, body: e.target.value });
        }}
        onPaste={onPaste}
        placeholder={placeholder}
        autoFocus={autoFocus ?? expanded}
        style={{ overflowAnchor: "none" }}
      />
      {isDragging && !disabled && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 rounded pointer-events-none">
          <div className="text-white font-medium">Drop images to attach</div>
        </div>
      )}
      {value.attachments && value.attachments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {value.attachments.map((img, idx) => (
            <div key={idx} className="relative inline-block">
              <img
                src={resolveImageSrc(img)}
                className="w-20 h-20 object-cover rounded"
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  onChange({
                    ...value,
                    attachments: value.attachments!.filter((_, i) => i !== idx),
                  })
                }
                className="absolute -top-2 -right-2 bg-black/70 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center pl-[0.5px] pb-[1px] disabled:opacity-50"
                aria-label="Remove image"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EditableContentForm;
