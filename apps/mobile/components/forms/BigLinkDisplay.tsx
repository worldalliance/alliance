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
import { clipboardCopy } from "@alliance/shared/lib/copy";
import { cn } from "@alliance/shared/styles/util";
import { milliseconds } from "date-fns";
import {
  ArrowUpRight,
  Check,
  Copy,
  File,
  FileCheck,
  FileText,
  MessagesSquare,
  Signature,
} from "lucide-react-native";
import { useState } from "react";
import { TouchableOpacity, View, type AccessibilityRole } from "react-native";
import { useAuth } from "../../lib/AuthContext";
import { copyOrAlert } from "../../lib/clipboard";
import { getSiteUrl } from "../../lib/config";
import { useHandleLinkPress } from "../AppMarkdownWrapper";
import Text, { FontWeight } from "../system/Text";

const bigLinkIcons: Record<
  BigLinkIcon,
  React.FC<{ size?: number; className?: string }> | null
> = {
  "messages-square": MessagesSquare,
  file: File,
  "file-text": FileText,
  "file-check": FileCheck,
  signature: Signature,
  none: null,
};

const bigLinkColors: Record<
  BigLinkColor,
  { card: string; text: string; muted: string; copied: string }
> = {
  [BigLinkColor.Grey]: {
    card: "border-zinc-200 bg-white",
    text: "text-black",
    muted: "text-zinc-500",
    copied: "text-green",
  },
  [BigLinkColor.Green]: {
    card: "border-green bg-green",
    text: "text-white",
    muted: "text-white/80",
    copied: "text-white",
  },
};

const bigLinkActionRoles: Record<BigLinkAction, AccessibilityRole> = {
  [BigLinkAction.Open]: "link",
  [BigLinkAction.Copy]: "button",
};

export default function BigLinkDisplay({ block }: { block: BigLinkBlock }) {
  if (block.externalTargetId === undefined) {
    return <BigLinkRow block={block} url={block.url} />;
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
  const { isAuthenticated, isLoading } = useAuth();
  const { data: url, isError } = useShareLink(
    isAuthenticated
      ? { kind: ShareLinkTargetKind.ExternalTarget, externalTargetId }
      : null,
  );

  if (!isAuthenticated && !isLoading) {
    return <BigLinkRow block={block} url={block.url} />;
  }
  if (url) return <BigLinkRow block={block} url={url} />;
  return (
    <BigLinkRow
      block={block}
      url={null}
      status={
        isError ? "Couldn't load your link. Try again later." : "Loading…"
      }
    />
  );
}

function BigLinkRow({
  block,
  url,
  status,
}: {
  block: BigLinkBlock;
  url: string | null;
  status?: string;
}) {
  const handleLinkPress = useHandleLinkPress();
  const [copied, setCopied] = useState(false);
  const IconComponent = bigLinkIcons[bigLinkIconOrDefault(block.icon)];
  const color = bigLinkColors[block.color ?? BigLinkColor.Grey];
  const action = block.action ?? BigLinkAction.Open;
  const shownUrl =
    url === null || action === BigLinkAction.Open
      ? url
      : withOrigin({ url, origin: getSiteUrl() });

  const handlePress = async (target: string) => {
    switch (action) {
      case BigLinkAction.Open:
        handleLinkPress(target);
        return;
      case BigLinkAction.Copy:
        if (!(await copyOrAlert(target))) return;
        setCopied(true);
        setTimeout(() => setCopied(false), milliseconds({ seconds: 2 }));
        return;
      default:
        throw new Error(`unknown big link action: ${action satisfies never}`);
    }
  };

  return (
    <TouchableOpacity
      accessibilityRole={
        shownUrl === null ? undefined : bigLinkActionRoles[action]
      }
      accessibilityHint={
        action === BigLinkAction.Copy ? clipboardCopy.copyLink : undefined
      }
      className={cn(
        "flex-row items-center gap-3 rounded-lg border px-5 py-4 mr-3",
        color.card,
      )}
      disabled={shownUrl === null}
      onPress={() => shownUrl !== null && handlePress(shownUrl)}
    >
      {IconComponent && <IconComponent size={20} className={color.text} />}
      <View className="flex-1 gap-0.5">
        <Text
          className={cn("text-base", color.text)}
          weight={FontWeight.Medium}
        >
          {block.text}
        </Text>
        {block.body ? (
          <Text className={cn("text-sm", color.text)}>{block.body}</Text>
        ) : null}
        {block.showUrl && shownUrl !== null && (
          <Text className={cn("text-sm", color.muted)}>{shownUrl}</Text>
        )}
        {status !== undefined && (
          <Text className={cn("mt-1 text-sm", color.muted)} numberOfLines={1}>
            {status}
          </Text>
        )}
      </View>
      {shownUrl !== null && (
        <BigLinkActionIcon action={action} copied={copied} color={color} />
      )}
    </TouchableOpacity>
  );
}

function BigLinkActionIcon({
  action,
  copied,
  color,
}: {
  action: BigLinkAction;
  copied: boolean;
  color: (typeof bigLinkColors)[BigLinkColor];
}) {
  switch (action) {
    case BigLinkAction.Open:
      return <ArrowUpRight size={20} className={color.text} />;
    case BigLinkAction.Copy:
      return copied ? (
        <Check size={20} className={color.copied} />
      ) : (
        <Copy size={20} className={color.text} />
      );
    default:
      throw new Error(`unknown big link action: ${action satisfies never}`);
  }
}
