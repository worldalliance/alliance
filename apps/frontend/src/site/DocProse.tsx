import { cn } from "@alliance/shared/styles/util";
import ReactMarkdown from "react-markdown";
import { Link } from "react-router";
import remarkGfm from "remark-gfm";

export enum DocProseSize {
  Default = "default",
  /** For a dialog, where the reader is mid-flow and scrolling is the cost. */
  Compact = "compact",
}

type ProseType = { h2: string; h3: string; body: string; rule: string };

// `tailwind-merge` counts `text-[length]` as a font size and drops a `leading-*`
// it merges over, so each line height travels with its own size.
const PROSE: Record<DocProseSize, ProseType> = {
  [DocProseSize.Default]: {
    h2: "mt-10 text-[1.5rem] leading-tight sm:text-[1.75rem]",
    h3: "mt-8 text-[1.2rem] leading-tight",
    body: "mt-4 text-[1.05rem] leading-[1.65] sm:text-[1.12rem]",
    rule: "mt-10",
  },
  [DocProseSize.Compact]: {
    h2: "mt-6 text-[1.05rem] leading-tight sm:text-[1.15rem]",
    h3: "mt-5 text-[0.95rem] leading-tight",
    body: "mt-2.5 text-[0.9rem] leading-[1.55]",
    rule: "mt-6",
  },
};

/**
 * The guide, foundation, governance, legal pages, and FAQ answers are all
 * authored as markdown, so one renderer carries the type scale for them.
 */
export function DocProse({
  markdown,
  size = DocProseSize.Default,
  className,
}: {
  markdown: string;
  size?: DocProseSize;
  className?: string;
}) {
  const type = PROSE[size];

  return (
    <div className={cn("flex flex-col text-[var(--site-ink)]", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => (
            <h2
              className={cn(
                "font-normal text-[var(--site-primary)] first:mt-0",
                type.h2,
              )}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className={cn("font-medium first:mt-0", type.h3)}>
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p
              className={cn("text-[var(--site-ink)]/85 first:mt-0", type.body)}
            >
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-medium text-[var(--site-ink)]">
              {children}
            </strong>
          ),
          ol: ({ children }) => (
            <ol
              className={cn(
                "flex list-outside list-decimal flex-col gap-2 pl-6 text-[var(--site-ink)]/85",
                type.body,
              )}
            >
              {children}
            </ol>
          ),
          ul: ({ children }) => (
            <ul
              className={cn(
                "flex list-outside list-disc flex-col gap-2 pl-6 text-[var(--site-ink)]/85",
                type.body,
              )}
            >
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
            <hr
              className={cn("border-t border-[var(--site-ink)]/12", type.rule)}
            />
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
