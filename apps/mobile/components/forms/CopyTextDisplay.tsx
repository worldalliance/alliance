import { milliseconds } from "date-fns";
import { Check, Copy } from "lucide-react-native";
import { useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { copyOrAlert } from "../../lib/clipboard";
import Text, { FontWeight } from "../system/Text";

export default function CopyTextDisplay({
  text,
  title,
}: {
  text: string;
  title?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!(await copyOrAlert(text))) {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), milliseconds({ seconds: 2 }));
  };

  return (
    <View>
      {title ? (
        <Text className="text-sm text-zinc-500 mb-1">{title}</Text>
      ) : null}
      <TouchableOpacity
        className="relative rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3"
        onPress={handleCopy}
        activeOpacity={0.7}
      >
        <Text>{text}</Text>
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
