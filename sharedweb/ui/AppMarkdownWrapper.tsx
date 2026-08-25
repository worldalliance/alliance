import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { imageSrcFromKey } from "../lib/imageSrc";
import ActionLink, { getActionIdFromHref } from "./ActionLink";
import ExternalLinkPreview from "./ExternalLinkPreview";
import { ImageLightboxModal } from "./ImageLightbox";

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
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const openLightbox = (src: string | undefined, e: React.MouseEvent) => {
    if (!src) return;
    // Images wrapped in a link keep their navigation; the lightbox only
    // claims clicks on plain images.
    if ((e.target as HTMLElement).closest("a")) return;
    e.preventDefault();
    e.stopPropagation();
    setLightboxSrc(src);
  };

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
          img: ({ node: _node, ...props }) => (
            <img
              className="rounded cursor-zoom-in [a_&]:cursor-pointer"
              {...props}
              onClick={(e) => openLightbox(props.src, e)}
            />
          ),
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
              // Falls back to a plain Link for non-http(s) hrefs; external
              // links get a hover card previewing the target page.
              <ExternalLinkPreview {...props} />
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
              const src = imageSrcFromKey(img);

              return (
                <div className="text-center my-6">
                  <img
                    src={src}
                    alt={caption || "Image"}
                    className="mx-auto max-h-96 cursor-zoom-in"
                    onClick={(e) => openLightbox(src, e)}
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
            return imageSrcFromKey(url);
          }
          return url;
        }}
      >
        {markdownContent}
      </ReactMarkdown>
      <ImageLightboxModal
        src={lightboxSrc}
        onClose={() => setLightboxSrc(null)}
      />
    </div>
  );
};

export default AppMarkdownWrapper;
