import type { CustomComponentProps } from "@alliance/shared/forms/customComponents";
import {
  shareLinkTargetFromConfig,
  useShareLink,
} from "@alliance/shared/forms/useShareLink";
import { CardStyle } from "@alliance/shared/styles/card";
import { milliseconds } from "date-fns";
import { useEffect, useState } from "react";
import Button, { ButtonColor } from "../../ui/Button";
import Card from "../../ui/Card";

const ShareUrlComponent = ({ field }: CustomComponentProps) => {
  const [copied, setCopied] = useState(false);

  const target = shareLinkTargetFromConfig(field.componentConfig);
  const isConfigured = target !== null;

  const { data: shareUrl, isPending, isError } = useShareLink(target);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(
      () => setCopied(false),
      milliseconds({ seconds: 1 }),
    );
    return () => clearTimeout(timer);
  }, [copied]);

  if (!isConfigured) {
    return (
      <Card style={CardStyle.Grey} className="flex flex-row items-center !p-0">
        <p className="flex-1 p-2 pl-3 text-zinc-500">No share configured</p>
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
    <Card style={CardStyle.Grey} className="flex-row items-center !p-0">
      <p className={`flex-1 p-2 pl-3 ${showMuted ? "text-zinc-500" : ""}`}>
        {message}
      </p>
      <Button
        color={ButtonColor.Transparent}
        onClick={() => {
          if (showMuted || !shareUrl) return;
          navigator.clipboard.writeText(shareUrl);
          setCopied(true);
        }}
        disabled={showMuted}
        className="text-sm !p-3 !px-3 text-green"
      >
        {copied ? "Copied!" : "Copy"}
      </Button>
    </Card>
  );
};

export default ShareUrlComponent;
