import type { CustomComponentProps } from "@alliance/shared/forms/customComponents";
import {
  shareLinkTargetFromConfig,
  useShareLink,
} from "@alliance/shared/forms/useShareLink";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import { setStringAsync as setClipboardStringAsync } from "expo-clipboard";
import { useEffect, useState } from "react";
import Button, { ButtonColor, ButtonSize } from "../system/Button";
import Card from "../system/Card";
import Text from "../system/Text";

const ShareUrlComponent = ({ field }: CustomComponentProps) => {
  const [copied, setCopied] = useState(false);

  const target = shareLinkTargetFromConfig(field.componentConfig);
  const isConfigured = target !== null;

  const { data: shareUrl, isPending, isError } = useShareLink(target);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1000);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    if (!shareUrl) return;
    await setClipboardStringAsync(shareUrl);
    setCopied(true);
  };

  if (!isConfigured) {
    return (
      <Card cardStyle={CardStyle.Grey} className="flex-row items-center !p-0">
        <Text className="flex-1 p-2 pl-3 text-zinc-500">
          No share configured
        </Text>
      </Card>
    );
  }

  const isLoading = isPending;
  const message = isError
    ? "Unable to load share link"
    : isLoading
      ? "Loading…"
      : shareUrl;
  const showMuted = isLoading || isError || !shareUrl;
  return (
    <Card cardStyle={CardStyle.Grey} className="flex-row items-center !p-0">
      <Text
        className={cn("flex-1 p-2 pl-3", showMuted && "text-zinc-500")}
        numberOfLines={1}
        ellipsizeMode="middle"
      >
        {message}
      </Text>
      <Button
        color={ButtonColor.Transparent}
        size={ButtonSize.Custom}
        onPress={handleCopy}
        disabled={showMuted}
        className="px-3 py-3"
        title={copied ? "Copied!" : "Copy"}
      />
    </Card>
  );
};

export default ShareUrlComponent;
