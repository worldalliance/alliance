import { ActionEventNotifDto, Push } from "@alliance/shared/client/types.gen";
import { cn } from "@alliance/shared/styles/util";
import { UseQueryResult } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { SectionLoadState, SectionRefreshError } from "./SectionQueryState";

export default function UserNotificationsSection({
  query: { data: notifs, isError, isRefetchError },
}: {
  query: UseQueryResult<ActionEventNotifDto[]>;
}) {
  if (!notifs) {
    return <SectionLoadState noun="notifications" isError={isError} />;
  }
  return <UserNotifications notifs={notifs} isRefetchError={isRefetchError} />;
}

function UserNotifications({
  notifs,
  isRefetchError,
}: {
  notifs: ActionEventNotifDto[];
  isRefetchError: boolean;
}) {
  const [expandedEmailId, setExpandedEmailId] = useState<number | null>(null);

  const { emailNotifs, textNotifs, pushNotifs } = useMemo(() => {
    // Categorize each channel independently
    const email: ActionEventNotifDto[] = [];
    const text: ActionEventNotifDto[] = [];
    const push: Push[] = [];
    notifs.forEach((notif) => {
      if (notif.mail) email.push(notif);
      if (notif.mms) text.push(notif);
      notif.pushes?.forEach((p) => push.push(p));
    });
    const sortDesc = (arr: ActionEventNotifDto[]) =>
      [...arr].sort((a, b) => notifTimestamp(b) - notifTimestamp(a));
    return {
      emailNotifs: sortDesc(email),
      textNotifs: sortDesc(text),
      pushNotifs: [...push].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    };
  }, [notifs]);

  const emailClickRate = useMemo(() => {
    if (!emailNotifs.length) return null;
    const clicked = emailNotifs.filter((n) => n.mail?.clickedLink).length;
    return Math.round((clicked / emailNotifs.length) * 100);
  }, [emailNotifs]);

  const textClickRate = useMemo(() => {
    if (!textNotifs.length) return null;
    const clicked = textNotifs.filter((n) => n.mms?.clickedLink).length;
    return Math.round((clicked / textNotifs.length) * 100);
  }, [textNotifs]);

  const pushOpenRate = useMemo(() => {
    if (!pushNotifs.length) return null;
    const opened = pushNotifs.filter((p) => p.openedAt).length;
    return Math.round((opened / pushNotifs.length) * 100);
  }, [pushNotifs]);

  return (
    <section>
      <h2 className="text-sm font-semibold text-zinc-700 mb-2">
        Notifications ({notifs.length})
      </h2>
      {isRefetchError && <SectionRefreshError noun="notifications" />}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Texts */}
        <div className="border border-zinc-200 rounded overflow-hidden">
          <div className="bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-600 border-b border-zinc-200 flex items-center justify-between">
            <span>Texts ({textNotifs.length})</span>
            {textClickRate !== null && (
              <span className="font-normal text-zinc-500">
                {textClickRate}% click rate
              </span>
            )}
          </div>
          {textNotifs.length ? (
            <div className="max-h-64 overflow-y-auto divide-y divide-zinc-100">
              {textNotifs.map((notif) => {
                const mms = notif.mms;
                const status = mms?.status || (notif.sent ? "sent" : "pending");
                return (
                  <div
                    key={keyForNotif(notif)}
                    className="px-3 py-2 text-xs hover:bg-zinc-50 flex flex-row items-center w-full"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "font-medium",
                            ["sent", "delivered"].includes(status.toLowerCase())
                              ? "text-green-600"
                              : ["failed", "undelivered"].includes(
                                    status.toLowerCase(),
                                  )
                                ? "text-red-600"
                                : "text-amber-600",
                          )}
                        >
                          {status}
                        </span>
                        <span className="text-zinc-400">
                          {mms?.createdAt &&
                            new Date(mms.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {mms?.body && (
                        <p className="text-zinc-600 line-clamp-2 mt-0.5">
                          {mms.body}
                        </p>
                      )}
                      {mms?.clickedLink && (
                        <span className="text-green-600">Link clicked</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="px-3 py-2 text-xs text-zinc-500">No texts sent.</p>
          )}
        </div>

        {/* Emails */}
        <div className="border border-zinc-200 rounded overflow-hidden">
          <div className="bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-600 border-b border-zinc-200 flex items-center justify-between">
            <span>Emails ({emailNotifs.length})</span>
            {emailClickRate !== null && (
              <span className="font-normal text-zinc-500">
                {emailClickRate}% click rate
              </span>
            )}
          </div>
          {emailNotifs.length ? (
            <div className="max-h-96 overflow-y-auto divide-y divide-zinc-100">
              {emailNotifs.map((notif) => {
                const mail = notif.mail;
                const isExpanded = expandedEmailId === mail?.id;
                return (
                  <div key={keyForNotif(notif)}>
                    <div
                      className="px-3 py-2 text-xs hover:bg-zinc-50 cursor-pointer"
                      onClick={() =>
                        setExpandedEmailId(
                          isExpanded ? null : (mail?.id ?? null),
                        )
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-400">
                            {isExpanded ? (
                              <ChevronDown size={16} />
                            ) : (
                              <ChevronRight size={16} />
                            )}
                          </span>
                          <span
                            className={cn(
                              "font-medium",
                              mail?.status?.toLowerCase() === "sent"
                                ? "text-green-600"
                                : mail?.status?.toLowerCase() === "failed"
                                  ? "text-red-600"
                                  : "text-amber-600",
                            )}
                          >
                            {mail?.status || "unknown"}
                          </span>
                        </div>
                        <span className="text-zinc-400">
                          {mail?.createdAt &&
                            new Date(mail.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-zinc-500 truncate mt-0.5 ml-5">
                        {mail?.to}
                      </p>
                      {mail?.clickedLink && (
                        <span className="text-green-600 ml-5">
                          Link clicked
                        </span>
                      )}
                    </div>
                    {isExpanded && mail?.renderedHtml && (
                      <div className="border-t border-zinc-200 bg-white">
                        <iframe
                          srcDoc={mail.renderedHtml}
                          className="w-full h-96 border-0"
                          title="Email preview"
                          sandbox=""
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="px-3 py-2 text-xs text-zinc-500">No emails sent.</p>
          )}
        </div>

        {/* Push */}
        <div className="border border-zinc-200 rounded overflow-hidden">
          <div className="bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-600 border-b border-zinc-200 flex items-center justify-between">
            <span>Push ({pushNotifs.length})</span>
            {pushOpenRate !== null && (
              <span className="font-normal text-zinc-500">
                {pushOpenRate}% open rate
              </span>
            )}
          </div>
          {pushNotifs.length ? (
            <div className="max-h-64 overflow-y-auto divide-y divide-zinc-100">
              {pushNotifs.map((push) => {
                const status =
                  push.receiptStatus ||
                  push.ticketStatus ||
                  (push.errorCode ? "error" : "sent");
                return (
                  <div
                    key={push.id}
                    className="px-3 py-2 text-xs hover:bg-zinc-50 flex flex-row items-center w-full"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "font-medium",
                            ["ok", "delivered"].includes(status.toLowerCase())
                              ? "text-green-600"
                              : ["error", "failed"].includes(
                                    status.toLowerCase(),
                                  )
                                ? "text-red-600"
                                : "text-amber-600",
                          )}
                        >
                          {status}
                        </span>
                        <span className="text-zinc-400">
                          {new Date(push.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {push.body && (
                        <p className="text-zinc-600 line-clamp-2 mt-0.5">
                          {push.body}
                        </p>
                      )}
                      {push.errorMessage && (
                        <p className="text-red-500 line-clamp-2 mt-0.5">
                          {push.errorMessage}
                        </p>
                      )}
                      {push.openedAt && (
                        <span className="text-green-600">Opened</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="px-3 py-2 text-xs text-zinc-500">
              No push notifications sent.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function notifTimestamp(notif: ActionEventNotifDto): number {
  const source = notif.mail ? notif.mail : notif.mms;
  const createdAt = source?.createdAt;
  return createdAt ? new Date(createdAt).getTime() : 0;
}

function keyForNotif(notif: ActionEventNotifDto) {
  const mailId = notif.mail?.id;
  const mmsId = notif.mms?.id;
  const pushId = notif.pushes?.[0]?.id;
  return `${notif.user.id}-${mailId ?? mmsId ?? pushId ?? Math.random()}`;
}
