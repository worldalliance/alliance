import { CreateEditableContentDto } from "@alliance/shared/client";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

interface EditableContentFormProps {
  value: CreateEditableContentDto;
  onChange: (value: CreateEditableContentDto) => void;
  className?: string;
  placeholder?: string;
  expanded?: boolean;

  /** Optional namespace to distinguish drafts across pages/users/entities */
  draftKey?: string;
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

function getStorageKey(draftKey?: string) {
  if (typeof window === "undefined") return `${STORAGE_PREFIX}:ssr`;
  const urlPart =
    window.location.origin + window.location.pathname + window.location.search;
  return `${STORAGE_PREFIX}:${urlPart}${draftKey ? `:${draftKey}` : ""}`;
}

const EditableContentForm: React.FC<EditableContentFormProps> = ({
  value,
  onChange,
  className,
  placeholder,
  expanded,
  draftKey,
  autosaveMs = 1200,
  restoreDraft,
  onDraftRestored,
  clearDraftSignal,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const saveTimer = useRef<number | null>(null);
  const storageKeyRef = useRef<string>(getStorageKey(draftKey));
  const lastSavedHashRef = useRef<string>("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingScrollRestoreRef = useRef<{ x: number; y: number } | null>(
    null
  );

  const shouldRestoreDraft = restoreDraft ?? draftKey !== undefined;

  useEffect(() => {
    storageKeyRef.current = getStorageKey(draftKey);
  }, [draftKey]);

  useEffect(() => {
    if (!shouldRestoreDraft || typeof window === "undefined") return;

    const raw = sessionStorage.getItem(storageKeyRef.current);
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
    if (typeof window === "undefined") return;

    const doSave = () => {
      const hash = JSON.stringify(value);
      if (hash === lastSavedHashRef.current) return; // nothing changed since last save
      const payload = JSON.stringify({
        dto: value,
        savedAt: new Date().toISOString(),
      });
      sessionStorage.setItem(storageKeyRef.current, payload);
      lastSavedHashRef.current = hash;
    };

    if (saveTimer.current) window.clearTimeout(saveTimer.current);

    if (clearDraftSignal !== undefined) {
      saveTimer.current = window.setTimeout(
        doSave,
        autosaveMs
      ) as unknown as number;
    }

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [value, autosaveMs]);

  // Allow parent to clear the draft after a successful real save
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!clearDraftSignal) return;
    try {
      sessionStorage.removeItem(storageKeyRef.current);
      lastSavedHashRef.current = JSON.stringify(value);
    } catch {
      // ignore
    }
  }, [clearDraftSignal]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    if (pendingScrollRestoreRef.current) {
      const { x, y } = pendingScrollRestoreRef.current;
      if (window.scrollX !== x || window.scrollY !== y) {
        window.scrollTo(x, y);
      }
      pendingScrollRestoreRef.current = null;
    }
  }, [value.body, expanded]);

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
        })
      );
    }
    return Promise.all(readers);
  };

  const handleFilesSelected = async (e: {
    target?: { files: FileList | null };
    dataTransfer?: DataTransfer | null;
  }) => {
    const files = e.target?.files ?? e.dataTransfer?.files ?? null;
    if (!files || files.length === 0) return;

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
      }
    } catch (err) {
      console.error("Failed to paste image(s)", err);
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
      className={`relative ${className ?? ""}`}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <textarea
        ref={textareaRef}
        className={`w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-transparent border-none ${
          expanded ? "" : "resize-none"
        }`}
        rows={expanded ? 2 : 1}
        value={value.body}
        onChange={(e) => {
          if (typeof window !== "undefined") {
            pendingScrollRestoreRef.current = {
              x: window.scrollX,
              y: window.scrollY,
            };
          }
          onChange({ ...value, body: e.target.value });
        }}
        onPaste={onPaste}
        placeholder={placeholder}
        autoFocus={expanded}
        style={{ overflowAnchor: "none" }}
      />
      {isDragging && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 rounded pointer-events-none">
          <div className="text-white font-medium">Drop images to attach</div>
        </div>
      )}
      {value.attachments && value.attachments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {value.attachments.map((img, idx) => (
            <div key={idx} className="relative inline-block">
              <img src={img} className="w-20 h-20 object-cover rounded" />
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...value,
                    attachments: value.attachments!.filter((_, i) => i !== idx),
                  })
                }
                className="absolute -top-2 -right-2 bg-black/70 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center pl-[0.5px] pb-[1px]"
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
