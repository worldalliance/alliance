import { cn } from "@alliance/shared/styles/util";
import React from "react";
import ReactMarkdown from "react-markdown";
import ActionLink, { getActionIdFromHref } from "./ActionLink";
import ExternalLinkPreview from "./ExternalLinkPreview";

interface FormMarkdownWrapper {
  markdownContent: string;
  inline?: boolean;
  /** Light-on-dark rendering */
  inverted?: boolean;
}

const FormMarkdownWrapper: React.FC<FormMarkdownWrapper> = ({
  markdownContent,
  inline = false,
  inverted = false,
}) => {
  const inlineClass = inline ? "inline" : "";
  const textClass = inverted ? "text-white" : "text-zinc-800";
  const codeBgClass = inverted ? "bg-white/20" : "bg-zinc-100";
  return (
    <ReactMarkdown
      components={{
        h1: ({ ...props }) => (
          <h1
            className={cn("!font-semibold first:mt-0 mt-6", inlineClass)}
            {...props}
          />
        ),
        h2: ({ ...props }) => (
          <h2
            className={cn("!font-semibold first:mt-0 mt-6", inlineClass)}
            {...props}
          />
        ),
        h3: ({ ...props }) => (
          <h3
            className={cn("!font-semibold first:mt-0 mt-6", inlineClass)}
            {...props}
          />
        ),
        strong: ({ ...props }) => (
          <strong className={cn("!font-semibold", inlineClass)} {...props} />
        ),
        p: ({ ...props }) => (
          <p
            className={cn(textClass, "first:mt-0 mt-4", inlineClass)}
            {...props}
          />
        ),
        ol: ({ ...props }) => (
          <ol
            className={cn(textClass, "list-decimal list-outside pl-6")}
            {...props}
          />
        ),
        ul: ({ ...props }) => (
          <ul
            className={cn(textClass, "list-disc list-outside pl-6")}
            {...props}
          />
        ),
        li: ({ ...props }) => (
          <li className={cn(textClass, "my-1 [&>p]:my-0")} {...props} />
        ),
        // The ! on text-white is load-bearing: the link components apply
        // `text-link`, a raw unlayered CSS class (apps' index.css) that
        // outranks every layered Tailwind utility in the cascade — only an
        // !important utility reliably overrides its green.
        a: ({ node: _node, ...props }) =>
          getActionIdFromHref(props.href) != null ? (
            <ActionLink
              className={cn(
                inverted ? "!text-white underline" : undefined,
                inlineClass,
              )}
              {...props}
              target="_blank"
              rel="noreferrer"
            />
          ) : (
            <ExternalLinkPreview
              className={cn(
                inverted ? "!text-white underline" : "text-link",
                inlineClass,
              )}
              {...props}
              target="_blank"
              rel="noreferrer"
            />
          ),
        code: ({ node: _node, className: _className, ...props }) => (
          <code
            className={cn(
              "rounded px-1 py-0.5 font-mono text-[0.9em]",
              codeBgClass,
              inlineClass,
            )}
            {...props}
          />
        ),
        pre: ({ node: _node, ...props }) => (
          <pre
            className={cn(
              "my-4 overflow-x-auto rounded p-3 font-mono text-[0.85em] [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-[1em]",
              codeBgClass,
            )}
            {...props}
          />
        ),
        blockquote: ({ node: _node, ...props }) => (
          <blockquote
            className={cn(
              "border-l-2 pl-4 my-4",
              textClass,
              inverted ? "border-white/40" : "border-zinc-300",
            )}
            {...props}
          />
        ),
      }}
    >
      {markdownContent}
    </ReactMarkdown>
  );
};

export default FormMarkdownWrapper;
