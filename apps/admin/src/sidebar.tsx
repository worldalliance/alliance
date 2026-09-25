import { cn } from "@alliance/shared/styles/util";
import { isProduction } from "@alliance/sharedweb/lib/config";
import { useQuery } from "@tanstack/react-query";
import { LogOut, PanelLeft } from "lucide-react";
import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Outlet } from "react-router";
import SidebarNav from "./components/SidebarNav";
import { useAuth } from "./lib/AuthContext";
import { useGroupAssignment } from "./lib/GroupAssignmentContext";
import { outreachPartnershipResponsesQuery } from "./lib/outreachPartnershipResponsesQuery";

const Sidebar: React.FC = () => {
  const { data: partnershipResponses = [] } = useQuery(
    outreachPartnershipResponsesQuery,
  );
  const pendingOutreachPartnershipCount = useMemo(
    () =>
      partnershipResponses.filter(
        (partnershipResponse) => partnershipResponse.notesHistory.length === 0,
      ).length,
    [partnershipResponses],
  );

  const { logout, user, loading: authLoading } = useAuth();
  const { membersUndergoingGroupAssignment } = useGroupAssignment();

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
        className="overflow-y-auto max-h-screen overflow-x-hidden flex flex-col justify-between relative transition-all duration-100 bg-[#f4f4f4]"
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
              "text-[14pt] font-bold pb-0",
              isProd ? "text-red-500" : "text-gray-900",
            )}
          >
            Alliance Admin
          </h1>
          <SidebarNav
            groupAssignmentCount={membersUndergoingGroupAssignment.length}
            pendingOutreachPartnershipCount={pendingOutreachPartnershipCount}
          />
        </div>
        {isSidebarOpen && (
          <div className="flex flex-row justify-between items-center p-3 px-5">
            <p className="text-sm text-gray-800 truncate">{user?.email}</p>
            <button
              type="button"
              aria-label="Log out"
              title="Log out"
              className="shrink-0 rounded p-1.5 text-zinc-700 hover:bg-zinc-200 hover:text-black cursor-pointer"
              onClick={logout}
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
        <div
          className={cn(
            "absolute top-7",
            isSidebarOpen ? "right-7" : "right-1",
            "cursor-pointer",
          )}
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          <PanelLeft className="h-5 w-5" />
        </div>
      </div>
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
