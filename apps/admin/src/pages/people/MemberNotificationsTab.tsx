import { useMemo } from "react";
import { useUserNotifsAndFormsAdmin } from "../../lib/useUserNotifsAndFormsAdmin";
import { Skeleton } from "../../ui/Skeleton";
import { ContentState, TableSkeleton } from "../../ui/templates/States";
import { byChannel } from "./memberNotifications";
import { MemberNotificationSettingsPanel } from "./MemberNotificationSettingsPanel";
import {
  MemberEmailNotifsPanel,
  MemberPushNotifsPanel,
  MemberTextNotifsPanel,
} from "./MemberNotifPanels";

const historySkeleton = (
  <div className="overflow-hidden rounded-card border border-line bg-surface">
    <div className="flex min-h-12 items-center border-b border-line px-card">
      <Skeleton className="h-4 w-32" />
    </div>
    <TableSkeleton columns={4} rows={4} />
  </div>
);

/** What the member has been sent by text, email and push, and their settings. */
export function MemberNotificationsTab({ userId }: { userId: number }) {
  const { notifs } = useUserNotifsAndFormsAdmin(userId);
  const channels = useMemo(() => byChannel(notifs.data ?? []), [notifs.data]);
  return (
    <>
      <MemberNotificationSettingsPanel userId={userId} />
      <ContentState
        things="notifications"
        query={notifs}
        skeleton={historySkeleton}
      >
        <MemberTextNotifsPanel texts={channels.texts} />
        <MemberEmailNotifsPanel emails={channels.emails} />
        <MemberPushNotifsPanel pushes={channels.pushes} />
      </ContentState>
    </>
  );
}
