import type React from "react";
import { useCallback, useRef } from "react";
import TextareaAutosize, {
  type TextareaAutosizeProps,
} from "react-textarea-autosize";
import { htmlToMarkdownFromDocs } from "@alliance/sharedweb/lib/htmlToMarkdown";

export interface FormTextareaProps extends TextareaAutosizeProps {
  value?: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}

function FormTextarea({
  value,
  onChange,
  textareaRef,
  ...props
}: FormTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resolvedRef = textareaRef ?? ref;

  const onPaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const ta = resolvedRef.current;
      if (!ta) return;

      const html = e.clipboardData.getData("text/html");
      if (!html) return; // let normal paste happen for plain text sources

      e.preventDefault();
      const md = htmlToMarkdownFromDocs(html);

      const next =
        ta.value.slice(0, ta.selectionStart) +
        md +
        ta.value.slice(ta.selectionEnd);

      onChange?.({
        target: {
          value: next,
          name: ta.name,
          id: ta.id,
          type: ta.type,
        },
      } as React.ChangeEvent<HTMLTextAreaElement>);
    },
    [onChange, resolvedRef]
  );

  return (
    <TextareaAutosize
      ref={resolvedRef}
      onPaste={onPaste}
      value={value}
      onChange={onChange}
      {...props}
    />
  );
}

export default FormTextarea;
