import React from "react";
import ReactMarkdown from "react-markdown";

interface MarkdownWrapperProps {
  markdownContent: string;
  maxWidth?: string;
}

const MarkdownWrapper: React.FC<MarkdownWrapperProps> = ({
  markdownContent,
  maxWidth = "max-w-3xl",
}) => {
  return (
    <div className={`markdown-wrapper mx-auto ${maxWidth}`}>
      <ReactMarkdown
        components={{
          h1: ({ ...props }) => (
            <h1 className="font-ibm !font-semibold !text-xl" {...props} />
          ),
          h2: ({ ...props }) => (
            <h2 className="font-ibm !font-medium !text-2xl !mt-6" {...props} />
          ),
          p: ({ ...props }) => (
            <p className="font-ibm !text-xl my-4" {...props} />
          ),
          ol: ({ ...props }) => (
            <ol
              className="font-ibm !text-xl list-decimal list-inside my-4 pl-4"
              {...props}
            />
          ),
          ul: ({ ...props }) => (
            <ul
              className="font-ibm text-xl list-disc list-inside my-4 pl-4"
              {...props}
            />
          ),
          li: ({ ...props }) => <li className="my-2" {...props} />,
          a: ({ ...props }) => (
            <a
              className="text-blue-600 hover:text-blue-800 underline"
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
