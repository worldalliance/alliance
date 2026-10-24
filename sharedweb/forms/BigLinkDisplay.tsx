import {
  BigLinkAction,
  BigLinkColor,
  bigLinkIconOrDefault,
  type BigLinkBlock,
  type BigLinkIcon,
} from "@alliance/common/forms/display-blocks";
import { withOrigin } from "@alliance/common/url";
import {
  ShareLinkTargetKind,
  useShareLink,
} from "@alliance/shared/forms/useShareLink";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import {
  ArrowUpRight,
  Check,
  Copy,
  File,
  FileCheck,
  FileText,
  MessagesSquare,
  Signature,
} from "lucide-react";
import React, { createContext, useContext } from "react";
import { Link } from "react-router";
import { CopyOutcome } from "../lib/clipboard";
import { getInviteBaseUrl } from "../lib/config";
import { useCopyOutcome } from "../lib/useCopyOutcome";
import Card from "../ui/Card";
import { useSiteHref } from "../ui/SiteAppProvider";

const bigLinkIcons: Record<BigLinkIcon, React.FC<{ size?: number }>> = {
  "messages-square": MessagesSquare,
  file: File,
  "file-text": FileText,
  "file-check": FileCheck,
  signature: Signature,
};

const bigLinkColors: Record<
  BigLinkColor,
  { style: CardStyle; hover: string; muted: string }
> = {
  [BigLinkColor.Grey]: {
    style: CardStyle.Grey,
    hover: "hover:bg-zinc-100",
    muted: "text-zinc-500",
  },
  [BigLinkColor.Green]: {
    style: CardStyle.LightGreen,
    hover: "hover:bg-green/20",
    muted: "text-zinc-600",
  },
};

const colorOf = (block: BigLinkBlock) =>
  bigLinkColors[block.color ?? BigLinkColor.Grey];

const copyIcons: Record<CopyOutcome, React.ReactNode> = {
  [CopyOutcome.Copied]: (
    <Check size={20} className="text-green" aria-label="Copied" />
  ),
  [CopyOutcome.Failed]: <p className="text-sm text-red-600">Copy failed</p>,
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
  const action = block.action ?? BigLinkAction.Open;
  switch (action) {
    case BigLinkAction.Open:
      return <OpenBigLink block={block} url={url} />;
    case BigLinkAction.Copy:
      return <CopyBigLink block={block} url={url} />;
    default:
      throw new Error(`unknown big link action: ${action satisfies never}`);
  }
}

function OpenBigLink({ block, url }: { block: BigLinkBlock; url: string }) {
  const siteHref = useSiteHref();
  const href = siteHref(url);
  const color = colorOf(block);

  return (
    <Link
      to={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block group text-black "
    >
      <Card
        className={cn("flex flex-row items-center gap-3", color.hover)}
        style={color.style}
      >
        <BigLinkContent block={block} url={url} />
        <ArrowUpRight size={20} aria-hidden />
      </Card>
    </Link>
  );
}

function CopyBigLink({ block, url }: { block: BigLinkBlock; url: string }) {
  const [outcome, copy] = useCopyOutcome();
  const absoluteUrl = withOrigin({ url, origin: getInviteBaseUrl() });
  const color = colorOf(block);

  return (
    <button
      type="button"
      onClick={() => copy(absoluteUrl)}
      className="block w-full text-left text-black"
    >
      <Card
        className={cn("flex flex-row items-center gap-3", color.hover)}
        style={color.style}
      >
        <BigLinkContent block={block} url={absoluteUrl} />
        {outcome ? (
          copyIcons[outcome]
        ) : (
          <Copy size={20} aria-label="Copy link" />
        )}
      </Card>
    </button>
  );
}

function BigLinkContent({
  block,
  url,
  message,
}: {
  block: BigLinkBlock;
  url?: string;
  message?: string;
}) {
  const IconComponent = bigLinkIcons[bigLinkIconOrDefault(block.icon)];
  const muted = colorOf(block).muted;
  return (
    <>
      <IconComponent size={20} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-base" style={{ fontWeight: 450 }}>
          {block.text}
        </p>
        {block.body && (
          <p className="text-sm whitespace-pre-wrap">{block.body}</p>
        )}
        {block.showUrl && url !== undefined && (
          <p className={cn("text-sm break-all", muted)}>{url}</p>
        )}
        {message !== undefined && (
          <p className={cn("text-sm", muted)}>{message}</p>
        )}
      </div>
    </>
  );
}

function BigLinkStatus({
  block,
  message,
}: {
  block: BigLinkBlock;
  message: string;
}) {
  return (
    <Card
      className="flex flex-row items-center gap-3 text-black"
      style={colorOf(block).style}
    >
      <BigLinkContent block={block} message={message} />
    </Card>
  );
}
