import { cn } from "@alliance/shared/styles/util";
import { Flag } from "lucide-react";
import React from "react";

/**
 * Glyph used to mark an action link. A flag reads as "a cause to rally to",
 * which fits an Alliance action better than a generic link. Swap here to
 * restyle every action link platform-wide.
 */
const ActionIcon = Flag;

/**
 * Extract an action id from a link href. Handles both relative
 * (`/actions/92`, `/action/92`) and absolute (`https://worldalliance.org/actions/92`)
 * forms. Returns null when the href is not an action link.
 */
export function getActionIdFromHref(href: string | undefined): number | null {
  if (!href) return null;
  let pathname = href;
  if (!href.startsWith("/")) {
    try {
      pathname = new URL(href).pathname;
    } catch {
      return null;
    }
  }
  const match = pathname.match(/^\/actions?\/(\d+)(?:\/|$|\?|#)/);
  return match ? Number(match[1]) : null;
}

type ActionLinkProps = Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "ref"
> & {
  /** mdast node passed by react-markdown; discarded so it isn't spread to the DOM */
  node?: unknown;
};

/**
 * Renders a reference to an action as an inline link, visually distinguished
 * with a small flag icon. Falls back to a plain link when the href is not an
 * action link.
 */
export default function ActionLink({
  node: _node,
  href,
  children,
  className,
  ...rest
}: ActionLinkProps) {
  const actionId = getActionIdFromHref(href);

  if (actionId == null) {
    return (
      <a className={cn("text-link", className)} href={href} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <a
      href={href}
      rel="noreferrer"
      className={cn(
        "text-link inline whitespace-normal underline-offset-2",
        className,
      )}
      {...rest}
    >
      {children}
      <ActionIcon
        className="inline-block shrink-0"
        size={13}
        style={{ margin: "-3px 0 0 3px" }}
        aria-hidden
      />
    </a>
  );
}
