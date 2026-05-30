import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getApiUrl } from "../lib/config";
import ActionLink, { getActionIdFromHref } from "./ActionLink";
import Link from "./Link";

// TOOD add heading, body color enums

export interface AppMarkdownWrapperProps {
  markdownContent: string;
  className?: string;
  /**
   * When true (the default), markdown links that point to an action are
   * rendered with {@link ActionLink} — visually distinguished and with a hover
   * preview — instead of a standard anchor tag. Set to false to opt a surface
   * out (e.g. where an action preview would be noise).
   */
  distinguishActionLinks?: boolean;
}

const AppMarkdownWrapper: React.FC<AppMarkdownWrapperProps> = ({
  markdownContent,
  className,
  distinguishActionLinks = true,
}) => {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ ...props }) => (
            <h1
              className="first:mt-0 mt-6 !font-semibold !text-xl"
              {...props}
            />
          ),
          h2: ({ ...props }) => (
            <h2
              className="first:mt-0 mt-6 !font-semibold !text-lg"
              {...props}
            />
          ),
          h3: ({ ...props }) => (
            <h3
              className="first:mt-0 mt-6 !font-semibold !text-base"
              {...props}
            />
          ),
          p: ({ ...props }) => <p className="first:mt-0 mt-4" {...props} />,
          img: ({ ...props }) => <img className="rounded" {...props} />,
          strong: ({ ...props }) => (
            <strong className="!font-semibold" {...props} />
          ),
          ol: ({ ...props }) => (
            <ol
              className="list-decimal list-outside pl-6 first:mt-0 mt-2"
              {...props}
            />
          ),
          ul: ({ ...props }) => (
            <ul
              className="list-disc list-outside pl-6 first:mt-0 mt-2"
              {...props}
            />
          ),
          li: ({ ...props }) => (
            <li className="first:mt-0 mt-2 pl-1 [&>p]:my-0" {...props} />
          ),
          a: ({ node: _node, ...props }) =>
            distinguishActionLinks &&
            getActionIdFromHref(props.href) != null ? (
              <ActionLink {...props} />
            ) : (
              <Link {...props} />
            ),
          blockquote: ({ ...props }) => (
            <blockquote
              className="border-l-2 border-gray-300 pl-4 my-4"
              {...props}
            />
          ),
          code: ({ className, children, ...props }) => {
            const language = className?.replace("language-", "");
            const value = String(children).trim();

            if (language === "imgcap") {
              const [imgLine, ...captionLines] = value.split("\n");
              const img = imgLine.trim();
              const caption = captionLines.join("\n").trim();

              return (
                <div className="text-center my-6">
                  <img
                    src={`${getApiUrl()}/images/${img}`}
                    alt={caption || "Image"}
                    className="mx-auto max-h-96"
                  />
                  {caption && (
                    <p className="text-sm text-gray-500 mt-2">{caption}</p>
                  )}
                </div>
              );
            }

            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
        urlTransform={(url) => {
          // TODO: better way to identify images
          if (url.includes(".webp") && !url.startsWith("http")) {
            return `${getApiUrl()}/images/${url}`;
          }
          return url;
        }}
      >
        {markdownContent}
      </ReactMarkdown>
    </div>
  );
};

export default AppMarkdownWrapper;
