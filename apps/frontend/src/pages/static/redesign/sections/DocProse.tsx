import { cn } from "@alliance/shared/styles/util";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parsePage, rdHref, RedesignPage, type LinkTarget } from "../links";
import type { RedesignVersion } from "../theme";
import { RdTrigger } from "../ui";
import { useJoinTarget } from "./JoinRequest";

/** Marks a link as pointing at another mockup page rather than the live site. */
const INTERNAL_PREFIX = "redesign:";

function internalPage(href: string | undefined): RedesignPage | null {
  if (!href?.startsWith(INTERNAL_PREFIX)) return null;
  return parsePage(href.slice(INTERNAL_PREFIX.length));
}

/**
 * The guide, foundation, governance, legal pages, and FAQ answers are all
 * authored as markdown, so one renderer carries the type scale for them.
 */
export function DocProse({
  markdown,
  version,
  className,
}: {
  markdown: string;
  version: RedesignVersion;
  className?: string;
}) {
  const joinTarget = useJoinTarget(version);

  const linkTarget = (href: string | undefined): LinkTarget => {
    const page = internalPage(href);
    if (page === RedesignPage.Join) return joinTarget;
    return { href: page ? rdHref(version, page) : (href ?? "#") };
  };

  return (
    <div className={cn("flex flex-col text-[var(--rd-ink)]", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        /*
         * The default transform drops URLs with a scheme it does not know,
         * which takes `redesign:` links with it. Every document here is a
         * constant in `docContent.ts`, so there is nothing to sanitise.
         */
        urlTransform={(url) => url}
        components={{
          h2: ({ children }) => (
            <h2 className="mt-10 text-[1.5rem] leading-tight font-normal text-[var(--rd-primary)] first:mt-0 sm:text-[1.75rem]">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-8 text-[1.2rem] leading-tight font-medium first:mt-0">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mt-4 text-[1.05rem] leading-[1.65] text-[var(--rd-ink)]/85 first:mt-0 sm:text-[1.12rem]">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-medium text-[var(--rd-ink)]">
              {children}
            </strong>
          ),
          ol: ({ children }) => (
            <ol className="mt-4 flex list-outside list-decimal flex-col gap-2 pl-6 text-[1.05rem] leading-[1.65] text-[var(--rd-ink)]/85 sm:text-[1.12rem]">
              {children}
            </ol>
          ),
          ul: ({ children }) => (
            <ul className="mt-4 flex list-outside list-disc flex-col gap-2 pl-6 text-[1.05rem] leading-[1.65] text-[var(--rd-ink)]/85 sm:text-[1.12rem]">
              {children}
            </ul>
          ),
          li: ({ children }) => (
            <li className="[&>p]:mt-0 [&>p]:inline">{children}</li>
          ),
          a: ({ children, href }) => (
            <RdTrigger
              {...linkTarget(href)}
              className="text-[var(--rd-primary)] underline decoration-[var(--rd-primary)]/35 underline-offset-2 hover:decoration-[var(--rd-primary)]"
            >
              {children}
            </RdTrigger>
          ),
          hr: () => (
            <hr className="mt-10 border-t border-[var(--rd-ink)]/12" />
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
