import type { CustomComponentProps } from "@alliance/shared/forms/customComponents";
import { useShareUrlDisplay } from "@alliance/shared/forms/useShareLink";
import { CardStyle } from "@alliance/shared/styles/card";
import { useEffect, useState } from "react";
import Button, { ButtonColor } from "../../ui/Button";
import Card from "../../ui/Card";

const ShareUrlComponent = ({ field }: CustomComponentProps) => {
  const [copied, setCopied] = useState(false);

  const { isConfigured, shareUrl, message, muted } = useShareUrlDisplay(field);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1000);
    return () => clearTimeout(timer);
  }, [copied]);

  if (!isConfigured) {
    return (
      <Card style={CardStyle.Grey} className="flex flex-row items-center !p-0">
        <p className="flex-1 p-2 pl-3 text-zinc-500">No share configured</p>
      </Card>
    );
  }

  return (
    <Card style={CardStyle.Grey} className="flex-row items-center !p-0">
      <p className={`flex-1 p-2 pl-3 ${muted ? "text-zinc-500" : ""}`}>
        {message}
      </p>
      <Button
        color={ButtonColor.Transparent}
        onClick={() => {
          if (muted || !shareUrl) return;
          navigator.clipboard.writeText(shareUrl);
          setCopied(true);
        }}
        disabled={muted}
        className="text-sm !p-3 !px-3 text-green"
      >
        {copied ? "Copied!" : "Copy"}
      </Button>
    </Card>
  );
};

export default ShareUrlComponent;
