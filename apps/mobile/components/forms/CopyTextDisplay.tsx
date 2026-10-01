import {
  CopyTextFormat,
  type CopyTextBlock,
} from "@alliance/common/forms/display-blocks";
import {
  copyTextClipboardContent,
  copyTextFormat,
} from "@alliance/shared/forms/copyText";
import { milliseconds } from "date-fns";
import { Check, Copy } from "lucide-react-native";
import { useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { copyOrAlert } from "../../lib/clipboard";
import { getApiUrl, getShareBaseUrl } from "../../lib/config";
import AppMarkdownWrapper from "../AppMarkdownWrapper";
import { commonMarkParser } from "../markdownParser";
import Text, { FontWeight } from "../system/Text";

function CopyTextBody({ block }: { block: CopyTextBlock }) {
  const format = copyTextFormat(block);
  switch (format) {
    case CopyTextFormat.Plain:
      return <Text>{block.text}</Text>;
    case CopyTextFormat.Markdown:
      return (
        <AppMarkdownWrapper markdownit={commonMarkParser}>
          {block.text}
        </AppMarkdownWrapper>
      );
    default:
      throw new Error(`unknown copy text format: ${format satisfies never}`);
  }
}

export default function CopyTextDisplay({ block }: { block: CopyTextBlock }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const content = copyTextClipboardContent(block, {
      apiUrl: getApiUrl(),
      origin: getShareBaseUrl(),
    });
    if (!(await copyOrAlert(content))) {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), milliseconds({ seconds: 2 }));
  };

  return (
    <View>
      {block.title ? (
        <Text className="text-sm text-zinc-500 mb-1">{block.title}</Text>
      ) : null}
      <TouchableOpacity
        className="relative rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3"
        onPress={handleCopy}
        activeOpacity={0.7}
      >
        <CopyTextBody block={block} />
        <View className="absolute top-1.5 right-1.5 flex-row items-center gap-1 bg-zinc-50 border border-zinc-200 px-1.5 py-0.5 rounded">
          {copied ? (
            <>
              <Text className="text-sm text-green" weight={FontWeight.Medium}>
                Copied!
              </Text>
              <Check size={14} className="text-green" />
            </>
          ) : (
            <Copy size={14} className="text-gray-400" />
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}
