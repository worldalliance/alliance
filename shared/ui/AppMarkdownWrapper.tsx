import React from "react";
import ReactMarkdown from "react-markdown";
import { getApiUrl } from "../lib/config";

interface AppMarkdownWrapperProps {
  markdownContent: string;
  className?: string;
}

const AppMarkdownWrapper: React.FC<AppMarkdownWrapperProps> = ({
  markdownContent,
  className,
}) => {
  return (
    <div className={className}>
      <ReactMarkdown
        components={{
          h1: ({ ...props }) => (
            <h1 className="first:mt-0 mt-6 !font-medium !text-xl" {...props} />
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
          strong: ({ ...props }) => (
            <strong className="!font-semibold" {...props} />
          ),
          ol: ({ ...props }) => (
            <ol className="list-decimal list-inside pl-2" {...props} />
          ),
          ul: ({ ...props }) => (
            <ul className="list-disc list-inside pl-2" {...props} />
          ),
          li: ({ ...props }) => <li className="my-1" {...props} />,
          a: ({ ...props }) => <a className="text-link" {...props} />,
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
          if (url.startsWith("http")) {
            return url;
          }
          return `${getApiUrl()}/images/${url}`;
        }}
      >
        {markdownContent}
      </ReactMarkdown>
    </div>
  );
};

export default AppMarkdownWrapper;
