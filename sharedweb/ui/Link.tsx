import React from "react";
import { Layers } from "lucide-react";

type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  distinguishActions?: boolean;
};

export default function Link({ distinguishActions, ...props }: LinkProps) {
  const hrefIsAction = distinguishActions && isHrefActionLink(props.href);

  const { children, ...rest } = props;
  return (
    <a className="text-link" target="_blank" rel="noreferrer" {...rest}>
      {children}
      {hrefIsAction && (
        <Layers
          className="inline-block ml-1"
          size={14}
          style={{ margin: "-3px 0 0 3px" }}
        />
      )}
    </a>
  );
}

function isHrefActionLink(href: string | undefined): boolean {
  if (!href) return false;
  const url = new URL(href);
  return !!url.pathname.match(/^\/actions\/\d+/);
}
