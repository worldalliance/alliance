import React from "react";
import ReactMarkdown from "react-markdown";

interface MarkdownWrapperProps {
  markdownContent: string;
  id: string;
  maxWidth?: string;
  className?: string;
}

const MarkdownWrapper: React.FC<MarkdownWrapperProps> = ({
  markdownContent,
  id,
  maxWidth = "max-w-4xl",
  className = "",
}) => {
  return (
    <div
      className={`markdown-wrapper w-full mx-auto ${maxWidth} ${className}`}
      id={id}
    >
      <ReactMarkdown
        components={{
          h1: ({ ...props }) => (
            <h1
              className="!font-medium !text-2xl md:!text-3xl !mt-4 md:!mt-6"
              {...props}
            />
          ),
          h2: ({ ...props }) => (
            <h2
              className="!font-medium !text-xl md:!text-2xl !mt-4 md:!mt-6"
              {...props}
            />
          ),
          p: ({ ...props }) => (
            <p
              className="text-zinc-900 text-lg first:!mt-0 !mt-2 md:!mt-4"
              {...props}
            />
          ),
          strong: ({ ...props }) => (
            <strong className="font-semibold " {...props} />
          ),
          ol: ({ ...props }) => (
            <ol
              className="text-lg list-decimal list-inside first:!mt-0 !mt-2 md:!mt-4 pl-4"
              {...props}
            />
          ),
          ul: ({ ...props }) => (
            <ul
              className="text-lg list-disc list-inside first:!mt-0 !mt-2 md:!mt-4 pl-4"
              {...props}
            />
          ),
          li: ({ ...props }) => <li className="my-1" {...props} />,
          a: ({ ...props }) => <a className="text-link" {...props} />,
        }}
      >
        {markdownContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownWrapper;
