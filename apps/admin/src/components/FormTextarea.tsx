import { useCallback, useEffect, useRef } from "react";

function htmlToMarkdownFromDocs(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");

  doc.querySelectorAll("style, meta, link, script").forEach((n) => n.remove());

  const mdForNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node as Text).data
        .replace(/\u00a0/g, " ") // nbsp
        .replace(/\s+/g, (m) => (m.includes("\n") ? "\n" : " "));
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    const children = () => Array.from(el.childNodes).map(mdForNode).join("");

    switch (tag) {
      case "a": {
        const href = el.getAttribute("href") || "";
        const text = children().trim() || href;
        const safeHref = href.replace(/\)/g, "%29"); // avoid breaking markdown
        return href ? `[${text}](${safeHref})` : text;
      }
      case "b":
      case "strong":
        return `**${children()}**`;
      case "i":
      case "em":
        return `_${children()}_`;
      case "u":
        return children();
      case "br":
        return "\n";
      case "p":
      case "div": {
        const content = children().trim();
        return content ? content + "\n\n" : "";
      }
      case "li": {
        const content = children().trim();
        return content ? `- ${content}\n` : "";
      }
      case "ul":
      case "ol": {
        // Convert each <li>, add blank line after list
        const items = Array.from(el.children)
          .filter((c) => c.tagName.toLowerCase() === "li")
          .map((li) => mdForNode(li))
          .join("");
        return items ? items + "\n" : "";
      }
      default:
        return children();
    }
  };

  let out = mdForNode(doc.body);

  // Cleanup: collapse excessive blank lines
  out = out
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trimEnd();

  return out;
}

export interface FormTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value?: string;
}

function FormTextarea({ value, onChange, ...props }: FormTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const onPaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const ta = ref.current;
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
    [onChange]
  );

  useEffect(() => {
    if (ref.current && value !== null) {
      ref.current.style.height = "auto";
      ref.current.style.height = 2 + ref.current.scrollHeight + "px";
    }
    if (ref.current && !value) {
      ref.current.style.height = "auto";
    }
  }, [value, ref]);

  return (
    <textarea
      ref={ref}
      onPaste={onPaste}
      value={value}
      onChange={onChange}
      {...props}
    />
  );
}

export default FormTextarea;
