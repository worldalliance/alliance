import { cn } from "@alliance/shared/styles/util";
import React from "react";

type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  /** mdast node passed by react-markdown; discarded so it isn't spread to the DOM */
  node?: unknown;
};

export default function Link({
  node: _node,
  children,
  className,
  ...rest
}: LinkProps) {
  return (
    <a
      className={cn("text-link", className)}
      target="_blank"
      rel="noreferrer"
      {...rest}
    >
      {children}
    </a>
  );
}
