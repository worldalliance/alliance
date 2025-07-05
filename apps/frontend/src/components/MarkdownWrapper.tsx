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
          h1: ({ ...props }) => (
            <h1
              className="font-newsreader !font-semibold !text-xl"
              {...props}
            />
          ),
          h2: ({ ...props }) => (
            <h2
              className="font-newsreader !font-bold !text-xl !mt-4"
              {...props}
            />
          ),
          p: ({ ...props }) => (
            <p className="font-newsreader !text-xl my-4" {...props} />
          ),
          ol: ({ ...props }) => (
            <ol
              className="font-newsreader !text-xl list-decimal list-inside my-4 pl-4"
              {...props}
            />
          ),
          ul: ({ ...props }) => (
            <ul
              className="font-newsreader !text-xl list-disc list-inside my-4 pl-4"
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
