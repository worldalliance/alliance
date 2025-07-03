import React from "react";
import ReactMarkdown from "react-markdown";

interface MarkdownWrapperProps {
  markdownContent: string;
}

const MarkdownWrapper: React.FC<MarkdownWrapperProps> = ({
  markdownContent,
}) => {
  return (
    <div className="markdown-wrapper">
      <ReactMarkdown
        components={{
          h1: ({ node, ...props }) => (
            <h1 className="font-avenir !text-xl" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="font-avenir !text-lg !mt-4" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="font-serif my-4 !text-lg" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol
              className="font-serif !text-lg list-decimal list-inside my-2 pl-4"
              {...props}
            />
          ),
        }}
      >
        {markdownContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownWrapper;
