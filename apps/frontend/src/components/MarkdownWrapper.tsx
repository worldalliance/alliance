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
              className="!font-semibold !text-2xl md:!text-3xl !mt-4 md:!mt-8"
              {...props}
            />
          ),
          h2: ({ ...props }) => (
            <h2
              className="!font-semibold !text-xl md:!text-2xl !mt-4 md:!mt-8"
              {...props}
            />
          ),
          p: ({ ...props }) => (
            <p
              className="text-zinc-900 text-lg first:!mt-0 !mt-2 md:!mt-5"
              {...props}
            />
          ),
          strong: ({ ...props }) => (
            <strong className="font-semibold " {...props} />
          ),
          ol: ({ ...props }) => (
            <ol
              className="text-lg list-decimal list-inside first:!mt-0 !mt-2 md:!mt-5 pl-4"
              {...props}
            />
          ),
          ul: ({ ...props }) => (
            <ul
              className="text-lg list-disc list-inside first:!mt-0 !mt-2 md:!mt-5 pl-4"
              {...props}
            />
          ),
          li: ({ ...props }) => <li className="first:!mt-0 !mt-2" {...props} />,
          a: ({ ...props }) => <a className="text-link" {...props} />,
        }}
      >
        {markdownContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownWrapper;
