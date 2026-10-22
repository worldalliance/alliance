import {
  bigLinkIconOrDefault,
  type BigLinkBlock,
  type BigLinkIcon,
} from "@alliance/common/forms/display-blocks";
import {
  ShareLinkTargetKind,
  useShareLink,
} from "@alliance/shared/forms/useShareLink";
import { CardStyle } from "@alliance/shared/styles/card";
import {
  ArrowUpRight,
  File,
  FileCheck,
  FileText,
  MessagesSquare,
  Signature,
} from "lucide-react";
import React, { createContext, useContext } from "react";
import { Link } from "react-router";
import Card from "../ui/Card";
import { useSiteHref } from "../ui/SiteAppProvider";

const bigLinkIcons: Record<BigLinkIcon, React.FC<{ size?: number }>> = {
  "messages-square": MessagesSquare,
  file: File,
  "file-text": FileText,
  "file-check": FileCheck,
  signature: Signature,
};

/** Whose code a share-target link carries for the person looking at it. */
export enum ShareLinkViewer {
  /** A signed-in member: their own code. */
  Member = "member",
  /** A guest or an admin: no code, the target's base URL. */
  Anonymous = "anonymous",
  /** Sign-in state is still loading. */
  Pending = "pending",
}

const ShareLinkViewerContext = createContext<ShareLinkViewer | undefined>(
  undefined,
);

export const ShareLinkViewerProvider = ShareLinkViewerContext.Provider;

function useShareLinkViewer(): ShareLinkViewer {
  const viewer = useContext(ShareLinkViewerContext);
  if (viewer === undefined) {
    throw new Error(
      "no ShareLinkViewerProvider is mounted: an app has to say whether its viewer gets their own share code before it can render a share-target link",
    );
  }
  return viewer;
}

export default function BigLinkDisplay({ block }: { block: BigLinkBlock }) {
  if (block.externalTargetId === undefined) {
    return <BigLinkCard block={block} url={block.url} />;
  }
  return (
    <ShareTargetBigLink
      block={block}
      externalTargetId={block.externalTargetId}
    />
  );
}

function ShareTargetBigLink({
  block,
  externalTargetId,
}: {
  block: BigLinkBlock;
  externalTargetId: number;
}) {
  const viewer = useShareLinkViewer();
  const { data: url, isError } = useShareLink(
    viewer === ShareLinkViewer.Member
      ? { kind: ShareLinkTargetKind.ExternalTarget, externalTargetId }
      : null,
  );

  switch (viewer) {
    case ShareLinkViewer.Anonymous:
      return <BigLinkCard block={block} url={block.url} />;
    case ShareLinkViewer.Pending:
      return <BigLinkStatus block={block} message="Loading your link…" />;
    case ShareLinkViewer.Member:
      if (url) return <BigLinkCard block={block} url={url} />;
      return (
        <BigLinkStatus
          block={block}
          message={
            isError ? "Couldn't load your link. Try again later." : "Loading…"
          }
        />
      );
    default:
      throw new Error(`unknown share link viewer: ${viewer satisfies never}`);
  }
}

function BigLinkCard({ block, url }: { block: BigLinkBlock; url: string }) {
  const siteHref = useSiteHref();
  const IconComponent = bigLinkIcons[bigLinkIconOrDefault(block.icon)];
  const href = siteHref(url);

  return (
    <Link
      to={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block group text-black "
    >
      <Card
        className="flex flex-row items-center gap-3 hover:bg-zinc-100"
        style={CardStyle.Grey}
      >
        <IconComponent size={20} />
        <p className="flex-1 text-base" style={{ fontWeight: 450 }}>
          {block.text}
        </p>
        <ArrowUpRight size={20} aria-hidden />
      </Card>
    </Link>
  );
}

function BigLinkStatus({
  block,
  message,
}: {
  block: BigLinkBlock;
  message: string;
}) {
  const IconComponent = bigLinkIcons[bigLinkIconOrDefault(block.icon)];
  return (
    <Card
      className="flex flex-row items-center gap-3 text-black"
      style={CardStyle.Grey}
    >
      <IconComponent size={20} />
      <div>
        <p className="text-base" style={{ fontWeight: 450 }}>
          {block.text}
        </p>
        <p className="text-sm text-zinc-500">{message}</p>
      </div>
    </Card>
  );
}
