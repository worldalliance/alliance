import { cn } from "@alliance/shared/styles/util";
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import React, { useEffect, useMemo } from "react";
import { Outlet } from "react-router";
import AdminSearch from "./components/AdminSearch";
import EnvironmentBadge from "./components/EnvironmentBadge";
import MemberZoneLink from "./components/MemberZoneLink";
import SidebarNav from "./components/SidebarNav";
import { useAuth } from "./lib/AuthContext";
import { MmsThreadsLiveProvider } from "./lib/mmsThreadsLive";
import { useSidebarCollapsed } from "./lib/sidebarCollapsed";
import { useGroupAssignmentMembersAdmin } from "./lib/useGroupAssignmentAdmin";
import { useOutreachPartnershipResponsesAdmin } from "./lib/useOutreachPartnershipResponsesAdmin";
import { useNeedsReplyCount } from "./lib/useTextThreadsAdmin";

const Sidebar: React.FC = () => {
  const { data: partnershipResponses = [] } =
    useOutreachPartnershipResponsesAdmin();
  const pendingOutreachPartnershipCount = useMemo(
    () =>
      partnershipResponses.filter(
        (partnershipResponse) => partnershipResponse.notesHistory.length === 0,
      ).length,
    [partnershipResponses],
  );

  const { logout, user, loading: authLoading } = useAuth();
  const { data: membersUndergoingGroupAssignment = [] } =
    useGroupAssignmentMembersAdmin();
  const needsReplyCount = useNeedsReplyCount();

  const [collapsed, setCollapsed] = useSidebarCollapsed();

  useEffect(() => {
    if (!authLoading && user && !user.admin) {
      logout();
    }
  }, [authLoading, user, logout]);

  const toggleLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <div className="flex h-screen bg-page">
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 transition-[width] duration-150 ease-out",
          collapsed ? "w-14" : "w-60",
        )}
      >
        <div
          className={cn(
            "flex gap-2 pt-4 pb-3",
            collapsed ? "flex-col items-center px-2" : "items-start px-4",
          )}
        >
          <div className={cn("flex flex-col gap-1", !collapsed && "flex-1")}>
            {!collapsed && (
              <span className="text-sm font-semibold text-zinc-900">
                Alliance admin
              </span>
            )}
            <EnvironmentBadge collapsed={collapsed} />
          </div>
          <button
            type="button"
            aria-label={toggleLabel}
            title={toggleLabel}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed(!collapsed)}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-900"
          >
            <ToggleIcon size={16} aria-hidden />
          </button>
        </div>
        <div className={cn("pb-3", collapsed ? "px-2.5" : "px-3")}>
          <AdminSearch compact={collapsed} />
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {!collapsed && (
            <SidebarNav
              groupAssignmentCount={membersUndergoingGroupAssignment.length}
              needsReplyCount={needsReplyCount}
              pendingOutreachPartnershipCount={pendingOutreachPartnershipCount}
            />
          )}
        </div>
        <div
          className={cn(
            "flex items-center gap-1 border-t border-zinc-200 py-2",
            collapsed ? "flex-col px-2" : "px-3",
          )}
        >
          <MemberZoneLink />
          {!collapsed && (
            <span className="min-w-0 flex-1 truncate text-xs text-zinc-600">
              {user?.email}
            </span>
          )}
          <button
            type="button"
            aria-label="Log out"
            title="Log out"
            className="shrink-0 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-900"
            onClick={logout}
          >
            <LogOut size={16} aria-hidden />
          </button>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};

const SidebarLayout = () => (
  <MmsThreadsLiveProvider>
    <Sidebar />
  </MmsThreadsLiveProvider>
);

export default SidebarLayout;
