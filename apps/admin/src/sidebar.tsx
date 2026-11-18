import { cn } from "@alliance/shared/styles/util";
import { isProduction } from "@alliance/sharedweb/lib/config";
import { LogOut, PanelLeft } from "lucide-react";
import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Outlet } from "react-router";
import AdminSearch from "./components/AdminSearch";
import MemberZoneLink from "./components/MemberZoneLink";
import SidebarNav from "./components/SidebarNav";
import { useAuth } from "./lib/AuthContext";
import { useGroupAssignmentMembersAdmin } from "./lib/useGroupAssignmentAdmin";
import { useNeedsReplyCount } from "./lib/useMemberTextsAdmin";
import { useOutreachPartnershipResponsesAdmin } from "./lib/useOutreachPartnershipResponsesAdmin";

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

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  // Only check admin status after loading is complete and we have a user
  useEffect(() => {
    if (!authLoading && user && !user.admin) {
      logout();
    }
  }, [authLoading, user, logout]);

  const [sidebarWidth, setSidebarWidth] = useState<number>(220);

  useLayoutEffect(() => {
    if (isSidebarOpen) {
      setSidebarWidth(220);
    } else {
      setSidebarWidth(48);
    }
  }, [isSidebarOpen]);

  const isProd = isProduction();

  return (
    <div className="flex flex-row min-h-screen h-fitcontent flex-nowrap bg-page">
      <div
        className="overflow-y-auto max-h-screen overflow-x-hidden flex flex-col justify-between relative transition-all duration-100 bg-zinc-100"
        style={{
          width: `${sidebarWidth}px`,
          ...(isSidebarOpen
            ? { overflowY: `auto` }
            : { overflowY: `hidden`, backgroundColor: `transparent` }),
        }}
      >
        <div
          className={cn(
            "flex flex-col gap-y-3 sticky",
            "p-5 py-6",
            `w-[${sidebarWidth}px]`,
            isSidebarOpen ? "translate-x-0" : "-translate-x-[300px]",
          )}
        >
          <h1
            className={cn(
              "text-lg font-bold pb-0",
              isProd ? "text-red-500" : "text-zinc-900",
            )}
          >
            Alliance Admin
            {isProd && (
              <span className="mt-1 block w-fit rounded-sm bg-red-600 px-1.5 py-0.5 text-xs font-semibold text-white">
                Production
              </span>
            )}
          </h1>
          <AdminSearch />
          <SidebarNav
            groupAssignmentCount={membersUndergoingGroupAssignment.length}
            needsReplyCount={needsReplyCount}
            pendingOutreachPartnershipCount={pendingOutreachPartnershipCount}
          />
        </div>
        {isSidebarOpen && (
          <div className="flex flex-row justify-between items-center p-3 px-5 pb-8">
            <p className="text-sm text-zinc-800 truncate">{user?.email}</p>
            <button
              type="button"
              aria-label="Log out"
              title="Log out"
              className="shrink-0 rounded-md p-1.5 text-zinc-700 hover:bg-zinc-200 hover:text-black cursor-pointer"
              onClick={logout}
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
        <button
          type="button"
          aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          aria-expanded={isSidebarOpen}
          className={cn(
            "absolute top-6 rounded-md p-1 hover:bg-zinc-200",
            isSidebarOpen ? "right-6" : "right-0",
            "cursor-pointer",
          )}
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          <PanelLeft className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <MemberZoneLink />
      <div className="flex-1 overflow-y-scroll max-h-screen">
        <div
          className="flex flex-col gap-y-5 min-h-0 flex-1 h-fit"
          style={{
            maxWidth: `calc(100vw - ${sidebarWidth}px)`,
          }}
        >
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
