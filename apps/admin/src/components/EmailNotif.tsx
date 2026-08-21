import { ActionEventNotifDto, ProfileDto } from "@alliance/shared/client";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import Badge from "@alliance/sharedweb/ui/Badge";
import Card from "@alliance/sharedweb/ui/Card";
import React from "react";

function statusClasses(status?: string) {
  const s = (status || "").toString().toLowerCase();
  if (s === "sent") return "bg-green-100 text-green-800";
  if (s === "failed") return "bg-red-100 text-red-800";
  if (s === "pending") return "bg-yellow-100 text-yellow-800";
  return "bg-stone-200 text-gray-800";
}

export function linkClickClasses(clickedLink?: boolean) {
  if (clickedLink) return "bg-green-100 text-green-800";
  return "bg-red-100 text-red-800";
}

export interface EmailNotifProps {
  notif: ActionEventNotifDto;
}

const EmailNotif: React.FC<EmailNotifProps> = ({ notif }) => {
  const user: ProfileDto = notif.user;
  const mail = notif.mail;

  if (!mail) {
    return (
      <Card style={CardStyle.White}>
        <p>No data</p>
      </Card>
    );
  }

  return (
    <Card style={CardStyle.White}>
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-y-2">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm">{user.displayName}</p>
            <span className="text-xs text-zinc-500">{mail.to}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              className={cn(
                statusClasses(mail.status),
                "!bg-zinc-100 !py-2 !px-3",
              )}
            >
              {mail.status}
            </Badge>
            <Badge
              className={cn(
                linkClickClasses(mail.clickedLink),
                "!bg-zinc-100 !py-2 !px-3",
              )}
            >
              {mail.clickedLink ? "Link clicked" : "No link clicked"}
            </Badge>
          </div>
          {mail.sentMessageId && (
            <span className="text-xs text-zinc-500 wrap-anywhere">
              {mail.sentMessageId}
            </span>
          )}
        </div>
      </div>
      <p className="text-xs text-zinc-500">
        {new Date(mail.createdAt).toLocaleString()}
      </p>
    </Card>
  );
};

export default EmailNotif;
