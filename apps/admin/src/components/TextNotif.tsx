import { ActionEventNotifDto, ProfileDto } from "@alliance/shared/client";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import Badge from "@alliance/sharedweb/ui/Badge";
import Card from "@alliance/sharedweb/ui/Card";
import React from "react";
import { linkClickClasses } from "./EmailNotif";

function statusClasses(status?: string) {
  const s = (status || "").toString().toLowerCase();
  if (["sent", "delivered"].includes(s)) return "bg-green-100 text-green-800";
  if (["failed", "undelivered"].includes(s)) return "bg-red-100 text-red-800";
  if (["queued", "accepted", "scheduled", "sending"].includes(s))
    return "bg-yellow-100 text-yellow-800";
  return "bg-stone-200 text-gray-800";
}

export interface TextNotifProps {
  notif: ActionEventNotifDto;
}

const TextNotif: React.FC<TextNotifProps> = ({ notif }) => {
  const user: ProfileDto = notif.user;
  const mms = notif.mms;
  const status = notif.mms?.status || (notif.sent ? "sent" : "pending");

  if (!mms) {
    return (
      <Card style={CardStyle.White}>
        <p>No data</p>
      </Card>
    );
  }

  return (
    <Card style={CardStyle.White}>
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm">{user.displayName}</p>
            {mms.to && <span className="text-xs text-zinc-500">{mms.to}</span>}
          </div>
          <div className="flex items-center gap-2">
            <Badge
              className={cn(statusClasses(status), "!bg-zinc-100 !py-2 !px-3")}
            >
              {status}
            </Badge>
            <Badge
              className={cn(
                linkClickClasses(mms.clickedLink),
                "!bg-zinc-100 !py-2 !px-3",
              )}
            >
              {mms.clickedLink ? "Link clicked" : "No link clicked"}
            </Badge>
          </div>
          {mms.body && (
            <span className="text-xs text-zinc-500 truncate max-w-[40ch]">
              “{mms.body}”
            </span>
          )}
          {mms.errorMessage && (
            <span className="text-xs text-red-600">
              {mms.errorCode ? `(${mms.errorCode}) ` : ""}
              {mms.errorMessage}
            </span>
          )}
          {mms.twilioSid && (
            <span className="text-xs text-zinc-500 wrap-anywhere">
              {mms.twilioSid}
            </span>
          )}
        </div>
      </div>
      {mms.createdAt && (
        <p className="text-xs text-zinc-500">
          {new Date(mms.createdAt).toLocaleString()}
        </p>
      )}
    </Card>
  );
};

export default TextNotif;
