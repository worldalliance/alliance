import {
  bigLinkIconOrDefault,
  type BigLinkBlock,
  type BigLinkIcon,
} from "@alliance/common/forms/display-blocks";
import {
  ShareLinkTargetKind,
  useShareLink,
} from "@alliance/shared/forms/useShareLink";
import {
  ArrowUpRight,
  File,
  FileCheck,
  FileText,
  MessagesSquare,
  Signature,
} from "lucide-react-native";
import { TouchableOpacity, View } from "react-native";
import { useAuth } from "../../lib/AuthContext";
import { useHandleLinkPress } from "../AppMarkdownWrapper";
import Text, { FontWeight } from "../system/Text";

const bigLinkIcons: Record<BigLinkIcon, React.FC<{ size?: number }>> = {
  "messages-square": MessagesSquare,
  file: File,
  "file-text": FileText,
  "file-check": FileCheck,
  signature: Signature,
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
  const IconComponent = bigLinkIcons[bigLinkIconOrDefault(block.icon)];
  return (
    <TouchableOpacity
      accessibilityRole={url === null ? undefined : "link"}
      className="flex-row items-center gap-3 rounded-lg border border-zinc-200 bg-white px-5 py-4 mr-3"
      disabled={url === null}
      onPress={() => url !== null && handleLinkPress(url)}
    >
      <IconComponent size={20} />
      <View className="flex-1">
        <Text className="text-base text-black" weight={FontWeight.Medium}>
          {block.text}
        </Text>
        {status !== undefined && (
          <Text className="mt-1 text-sm text-zinc-500" numberOfLines={1}>
            {status}
          </Text>
        )}
      </View>
      {url !== null && <ArrowUpRight size={20} />}
    </TouchableOpacity>
  );
}
