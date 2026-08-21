import { imagesUploadImage } from "@alliance/shared/client";
import type { MutableRefObject } from "react";
import React, { forwardRef, useCallback, useRef, useState } from "react";

export type MarkdownTextAreaProps =
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    onUploadStart?: () => void;
    onUploadEnd?: () => void;
    onUploadError?: (error: unknown) => void;
    className?: string;
    disabled?: boolean;
    onDrop?: (event: React.DragEvent<HTMLTextAreaElement>) => void;
    onDragOver?: (event: React.DragEvent<HTMLTextAreaElement>) => void;
    onDragEnter?: (event: React.DragEvent<HTMLTextAreaElement>) => void;
    onDragLeave?: (event: React.DragEvent<HTMLTextAreaElement>) => void;
  };

export const MarkdownTextArea = forwardRef<
  HTMLTextAreaElement,
  MarkdownTextAreaProps
>(
  (
    {
      className,
      disabled,
      onDrop,
      onDragOver,
      onDragEnter,
      onDragLeave,
      onUploadStart,
      onUploadEnd,
      onUploadError,
      ...rest
    },
    ref,
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const setRefs = useCallback(
      (node: HTMLTextAreaElement | null) => {
        textareaRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          (ref as MutableRefObject<HTMLTextAreaElement | null>).current = node;
        }
      },
      [ref],
    );

    const readFileAsDataUrl = useCallback((file: File) => {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            resolve(reader.result);
          } else {
            reject(new Error("Failed to read file"));
          }
        };
        reader.onerror = () =>
          reject(reader.error ?? new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
    }, []);

    const insertMarkdown = useCallback((markdown: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      textarea.focus();

      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? textarea.value.length;
      const before = textarea.value.slice(0, start);
      const after = textarea.value.slice(end);
      const needsLeadingNewline = before.length > 0 && !before.endsWith("\n");
      const needsTrailingNewline = after.length > 0 && !after.startsWith("\n");
      const textToInsert = `${needsLeadingNewline ? "\n" : ""}${markdown}${
        needsTrailingNewline ? "\n" : ""
      }`;

      textarea.setRangeText(textToInsert, start, end, "end");
      const event = new Event("input", { bubbles: true });
      textarea.dispatchEvent(event);
    }, []);

    const containsImage = (event: React.DragEvent<HTMLTextAreaElement>) => {
      const items = Array.from(event.dataTransfer?.items ?? []);
      return items.some(
        (item) => item.kind === "file" && item.type.startsWith("image/"),
      );
    };

    const buildClassName = () => {
      return [
        "w-full min-h-[120px] rounded border border-gray-300 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
        disabled ? "opacity-50 cursor-not-allowed" : "",
        isDragging ? "border-blue-500 border-dashed bg-blue-50" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ");
    };

    const handleDragEnter: React.DragEventHandler<HTMLTextAreaElement> = (
      event,
    ) => {
      if (containsImage(event)) {
        event.preventDefault();
        if (!disabled) {
          setIsDragging(true);
        }
      }
      onDragEnter?.(event);
    };

    const handleDragOver: React.DragEventHandler<HTMLTextAreaElement> = (
      event,
    ) => {
      if (containsImage(event)) {
        event.preventDefault();
        event.dataTransfer.dropEffect = disabled ? "none" : "copy";
        if (!disabled) {
          setIsDragging(true);
        }
      }
      onDragOver?.(event);
    };

    const handleDragLeave: React.DragEventHandler<HTMLTextAreaElement> = (
      event,
    ) => {
      if (containsImage(event)) {
        event.preventDefault();
        setIsDragging(false);
      }
      onDragLeave?.(event);
    };

    const handleDrop: React.DragEventHandler<HTMLTextAreaElement> = async (
      event,
    ) => {
      const dtFiles = Array.from(event.dataTransfer?.files ?? []);
      const imageFiles = dtFiles.filter((file) =>
        file.type.startsWith("image/"),
      );

      if (!imageFiles.length) {
        onDrop?.(event);
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);

      onDrop?.(event);

      if (disabled) {
        return;
      }

      setUploadError(null);
      setIsUploading(true);
      onUploadStart?.();

      try {
        const urls: string[] = [];
        for (const file of imageFiles) {
          const fileB64 = await readFileAsDataUrl(file);
          const { data } = await imagesUploadImage({
            body: { file: fileB64 },
          });
          if (data) {
            urls.push(data.key);
          }
        }

        if (urls.length) {
          const markdown = urls.map((url) => `![image](${url})`).join("\n");
          insertMarkdown(markdown);
        }
      } catch (error) {
        console.error("Failed to upload image", error);
        setUploadError("Failed to upload image");
        onUploadError?.(error);
      } finally {
        setIsUploading(false);
        onUploadEnd?.();
      }
    };

    return (
      <div>
        <textarea
          {...rest}
          ref={setRefs}
          className={buildClassName()}
          disabled={disabled || isUploading}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        />
        {isUploading && (
          <p className="mt-1 text-xs text-gray-500">Uploading image...</p>
        )}
        {uploadError && (
          <p className="mt-1 text-xs text-red-600">{uploadError}</p>
        )}
      </div>
    );
  },
);

MarkdownTextArea.displayName = "MarkdownTextArea";
