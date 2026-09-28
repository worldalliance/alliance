import type { CustomComponentProps } from "@alliance/shared/forms/customComponents";
import {
  shareLinkTargetFromConfig,
  useShareLink,
} from "@alliance/shared/forms/useShareLink";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import { milliseconds } from "date-fns";
import { useEffect, useState } from "react";
import { copyOutcome, CopyOutcome } from "../../lib/clipboard";
import Button, { ButtonColor } from "../../ui/Button";
import Card from "../../ui/Card";

const copyLabels: Record<CopyOutcome, string> = {
  [CopyOutcome.Copied]: "Copied!",
  [CopyOutcome.Failed]: "Copy failed",
};

const ShareUrlComponent = ({ field }: CustomComponentProps) => {
  const [outcome, setOutcome] = useState<CopyOutcome | null>(null);

  const target = shareLinkTargetFromConfig(field.componentConfig);
  const isConfigured = target !== null;

  const { data: shareUrl, isPending, isError } = useShareLink(target);

  useEffect(() => {
    if (!outcome) return;
    const timer = setTimeout(
      () => setOutcome(null),
      milliseconds({ seconds: 1 }),
    );
    return () => clearTimeout(timer);
  }, [outcome]);

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
        onClick={async () => {
          if (showMuted || !shareUrl) return;
          setOutcome(await copyOutcome(shareUrl));
        }}
        disabled={showMuted}
        className={cn(
          "text-sm !p-3 !px-3",
          outcome === CopyOutcome.Failed ? "text-red-600" : "text-green",
        )}
      >
        {outcome ? copyLabels[outcome] : "Copy"}
      </Button>
    </Card>
  );
};

export default ShareUrlComponent;
