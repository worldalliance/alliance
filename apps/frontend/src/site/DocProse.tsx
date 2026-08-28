import { cn } from "@alliance/shared/styles/util";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router";
import remarkGfm from "remark-gfm";

/**
 * The guide, foundation, governance, legal pages, and FAQ answers are all
 * authored as markdown, so one renderer carries the type scale for them.
 */
export function DocProse({
  markdown,
  className,
}: {
  markdown: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col text-[var(--site-ink)]", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => (
            <h2 className="mt-10 text-[1.5rem] leading-tight font-normal text-[var(--site-primary)] first:mt-0 sm:text-[1.75rem]">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-8 text-[1.2rem] leading-tight font-medium first:mt-0">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mt-4 text-[1.05rem] leading-[1.65] text-[var(--site-ink)]/85 first:mt-0 sm:text-[1.12rem]">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-medium text-[var(--site-ink)]">
              {children}
            </strong>
          ),
          ol: ({ children }) => (
            <ol className="mt-4 flex list-outside list-decimal flex-col gap-2 pl-6 text-[1.05rem] leading-[1.65] text-[var(--site-ink)]/85 sm:text-[1.12rem]">
              {children}
            </ol>
          ),
          ul: ({ children }) => (
            <ul className="mt-4 flex list-outside list-disc flex-col gap-2 pl-6 text-[1.05rem] leading-[1.65] text-[var(--site-ink)]/85 sm:text-[1.12rem]">
              {children}
            </ul>
          ),
          li: ({ children }) => (
            <li className="[&>p]:mt-0 [&>p]:inline">{children}</li>
          ),
          a: ({ children, href }) => {
            const className =
              "text-[var(--site-primary)] underline decoration-[var(--site-primary)]/35 underline-offset-2 hover:decoration-[var(--site-primary)]";
            const target = href ?? "#";
            // Absolute URLs and mailto: leave the app, so they stay plain
            // anchors rather than going through the router.
            return /^[a-z]+:/i.test(target) ? (
              <a
                href={target}
                className={className}
                target={target.startsWith("http") ? "_blank" : undefined}
                rel={target.startsWith("http") ? "noreferrer" : undefined}
              >
                {children}
              </a>
            ) : (
              <Link to={target} className={className}>
                {children}
              </Link>
            );
          },
          hr: () => (
            <hr className="mt-10 border-t border-[var(--site-ink)]/12" />
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
