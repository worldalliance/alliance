import type { CustomComponentProps } from "./types";
import Card, { CardStyle } from "../../ui/Card";
import { useEffect, useState } from "react";
import { actionsGetShareLink } from "../../client";
import Button, { ButtonColor } from "../../ui/Button";

const ActionShareUrlComponent = ({ user, field }: CustomComponentProps) => {
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const actionId = (field.componentConfig?.actionId ?? null) as number | null;

  useEffect(() => {
    const fetchShareUrl = async () => {
      if (!actionId) {
        return;
      }
      const shareUrlRes = await actionsGetShareLink({
        path: { id: actionId },
      });
      if (shareUrlRes.data) {
        setShareUrl(shareUrlRes.data);
      }
    };
    fetchShareUrl();
  }, [user]);

  useEffect(() => {
    if (copied) {
      setTimeout(() => {
        setCopied(false);
      }, 1000);
    }
  }, [copied]);

  return (
    <Card style={CardStyle.Grey} className="flex-row items-center !p-0">
      <p className="flex-1 p-1 pl-3">{shareUrl}</p>
      <Button
        color={ButtonColor.Transparent}
        onClick={() => {
          navigator.clipboard.writeText(shareUrl);
          setCopied(true);
        }}
        className="text-sm pr-2 text-green"
      >
        {copied ? "Copied!" : "Copy"}
      </Button>
    </Card>
  );
};

export default ActionShareUrlComponent;
