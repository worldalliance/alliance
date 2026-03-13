import {
  Action,
  actionsFindAllWithDrafts,
  actionsPasteJson,
} from "@alliance/shared/client";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import { Link, Outlet, useNavigate } from "react-router";
import { useAuth } from "./lib/AuthContext";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import SidebarIcon from "@alliance/sharedweb/ui/icons/SidebarIcon";
import { isProduction } from "@alliance/sharedweb/lib/config";
import Dropdown from "@alliance/sharedweb/ui/Dropdown";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import {
  Database,
  Film,
  FileText,
  SquareActivity,
  Users,
  UserPlus,
  CirclePile,
  Calendar,
  ImageUp,
  BarChart2,
  Map,
  Newspaper,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  MoreHorizontal,
  ScrollText,
  TowerControl,
  ListOrdered,
} from "lucide-react";
import { useGroupAssignment } from "./lib/GroupAssignmentContext";
import { cn } from "@alliance/shared/styles/util";

const Sidebar: React.FC = () => {
  const [actions, setActions] = useState<Action[]>([]);
  const [actionsLoading, setActionsLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  const { logout, user, loading: authLoading } = useAuth();
  const { membersUndergoingGroupAssignment } = useGroupAssignment();

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  // Only check admin status after loading is complete and we have a user
  useEffect(() => {
    if (!authLoading && user && !user.admin) {
      logout();
    }
  }, [authLoading, user, logout]);

  const loadActions = useCallback(async () => {
    try {
      const response = await actionsFindAllWithDrafts();
      if (response.data) {
        setActions(response.data);
      }
      setActionsLoading(false);
    } catch (err) {
      setActionsLoading(false);
      console.error(err);
    }
  }, []);

  const currentActionId = window.location.pathname.includes("/actions/")
    ? parseInt(window.location.pathname.split("/actions/")[1])
    : null;

  useEffect(() => {
    loadActions();
  }, [loadActions]);

  const handleEditAction = useCallback(
    (id: number) => {
      navigate(`/actions/${id}`);
    },
    [navigate]
  );

  const [sidebarWidth, setSidebarWidth] = useState<number>(220);

  useLayoutEffect(() => {
    if (isSidebarOpen) {
      setSidebarWidth(220);
    } else {
      setSidebarWidth(48);
    }
  }, [isSidebarOpen]);

  const filteredActions = actions.filter((action) => !action.archived);

  const [createActionDropdownOpen, setCreateActionDropdownOpen] =
    useState<boolean>(false);

  const [extrasOpen, setExtrasOpen] = useState<boolean>(false);

  const [pasteJsonLoading, setPasteJsonLoading] = useState<boolean>(false);

  const handleCreateActionDropdown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      setCreateActionDropdownOpen(!createActionDropdownOpen);
      e.stopPropagation();
    },
    [createActionDropdownOpen]
  );

  const { error, success } = useToast();

  const handlePasteJson = useCallback(async () => {
    setPasteJsonLoading(true);
    const json = await navigator.clipboard.readText();

    const response = await actionsPasteJson({ body: { body: json } });
    if (response.data) {
      navigate(`/actions/${response.data.id}`);
      setCreateActionDropdownOpen(false);
      success("Action pasted successfully");
    } else {
      error("Could not paste action");
    }
    setPasteJsonLoading(false);
  }, [navigate, error, success]);

  const groups: {
    name: string;
    actions: Action[];
  }[] = [
    {
      name: "Active",
      actions: filteredActions.filter(
        (action) =>
          (action.status === "member_action" ||
            action.status === "gathering_commitments") &&
          !action.onboarding
      ),
    },
    {
      name: "Draft",
      actions: filteredActions.filter((action) => action.status === "draft"),
    },
    {
      name: "Pending",
      actions: filteredActions.filter(
        (action) =>
          action.status !== "draft" &&
          action.status !== "member_action" &&
          action.status !== "gathering_commitments" &&
          !action.onboarding &&
          action.status !== "completed"
      ),
    },
    {
      name: "Onboarding",
      actions: filteredActions.filter((action) => action.onboarding),
    },
    {
      name: "Completed",
      actions: filteredActions.filter(
        (action) => action.status === "completed"
      ),
    },
  ];

  const isProd = isProduction();

  return (
    <div className="flex flex-row min-h-screen h-fitcontent flex-nowrap bg-pagebg bg-[#fcfcfc]">
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
            isSidebarOpen ? "translate-x-0" : "-translate-x-[300px]"
          )}
        >
          <h1
            className={cn(
              "text-[14pt] font-bold pb-0",
              isProd ? "text-red-500" : "text-gray-900"
            )}
          >
            Alliance Admin
          </h1>
          <nav className="flex flex-col gap-y-1">
            {[
              {
                to: "/actions",
                label: "Actions",
                icon: <SquareActivity size={16} />,
              },
              {
                to: "/general-updates",
                label: "General Updates",
                icon: <Newspaper size={16} />,
              },
              { to: "/members", label: "Members", icon: <Users size={16} /> },
              {
                to: "/database",
                label: "Database Viewer →",
                icon: <Database size={16} />,
              },
              {
                to: "/invites",
                label: "User Invites",
                icon: <UserPlus size={16} />,
              },
              {
                to: "/groups",
                label: "Groups",
                icon: <CirclePile size={16} />,
                notifCount: membersUndergoingGroupAssignment.length,
              },
              {
                to: "/",
                label: "Stats",
                icon: <BarChart2 size={16} />,
              },
            ].map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="flex items-center gap-2 text-[15px] text-gray-700 hover:text-black hover:bg-zinc-200/60 py-2 px-2 rounded transition-colors"
              >
                {link.icon}
                {link.label}
                {!!link.notifCount ? (
                  <div className="justify-self-end font-semibold text-xs text-white bg-red-500 rounded-md flex justify-center items-center w-5 h-5">
                    {link.notifCount}
                  </div>
                ) : null}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => setExtrasOpen(!extrasOpen)}
              className="flex items-center gap-2 text-[15px] text-gray-700 hover:text-black hover:bg-zinc-200/60 py-2 px-2 rounded transition-colors w-full"
            >
              <MoreHorizontal size={16} />
              Extras
              {extrasOpen ? (
                <ChevronDown size={14} className="ml-auto" />
              ) : (
                <ChevronRight size={14} className="ml-auto" />
              )}
            </button>
            {extrasOpen && (
              <div className="flex flex-col gap-y-1 pl-4 border-l border-zinc-300 ml-2">
                {[
                  {
                    to: "/posts",
                    label: "Forum Posts",
                    icon: <MessageSquare size={16} />,
                  },
                  {
                    to: "/contracts",
                    label: "Contracts",
                    icon: <FileText size={16} />,
                  },
                  {
                    to: "/scheduled",
                    label: "Scheduled Plans",
                    icon: <Calendar size={16} />,
                  },
                  {
                    to: "/image",
                    label: "Image Upload",
                    icon: <ImageUp size={16} />,
                  },
                  {
                    to: "/videos",
                    label: "Videos",
                    icon: <Film size={16} />,
                  },
                  {
                    to: "/messaging",
                    label: "Messaging",
                    icon: <TowerControl size={16} />,
                  },
                  {
                    to: "/event-log",
                    label: "Event Log",
                    icon: <ScrollText size={16} />,
                  },
                  {
                    to: "/priority",
                    label: "Priority",
                    icon: <ListOrdered size={16} />,
                  },
                  {
                    to: "/member-map",
                    label: "Member Map",
                    icon: <Map size={16} />,
                  },
                ].map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="flex items-center gap-2 text-[15px] text-gray-700 hover:text-black hover:bg-zinc-200/60 py-2 px-2 rounded transition-colors"
                  >
                    {link.icon}
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </nav>
          <div className="flex flex-row justify-between items-center mt-3 relative">
            <p className="font-bold">Actions</p>
            <Button
              onClick={() => navigate("/actions/new")}
              className="text-white !px-3 !py-1 rounded-md text-sm"
              color={ButtonColor.Green}
            >
              Create
              <div
                className="mt-px ml-1 hover:bg-white/20 rounded-full"
                onClick={handleCreateActionDropdown}
              >
                <ChevronDown size={20} />
              </div>
            </Button>
            {createActionDropdownOpen && (
              <Dropdown
                isOpen={createActionDropdownOpen}
                className="absolute top-[100%] right-0 min-w-[150px] *:text-sm *:w-full divide-y divide-zinc-200"
              >
                <Button
                  color={ButtonColor.Transparent}
                  className=""
                  onClick={() => navigate("/actions/new")}
                >
                  New Action
                </Button>
                <Button
                  color={ButtonColor.Transparent}
                  className=""
                  onClick={() => navigate("/new-suite")}
                >
                  New Suite
                </Button>
                <Button
                  color={ButtonColor.Transparent}
                  className="w-full"
                  onClick={handlePasteJson}
                  disabled={pasteJsonLoading}
                >
                  Paste JSON
                </Button>
              </Dropdown>
            )}
          </div>
          <div className="flex flex-col gap-px">
            {actionsLoading ? (
              <p className="text-sm text-gray-500">Loading actions...</p>
            ) : (
              groups
                .filter((group) => group.actions.length > 0)
                .map((group) => (
                  <React.Fragment key={group.name}>
                    <div
                      key={group.name}
                      className="flex w-full items-center gap-x-2"
                    >
                      <div className="h-px bg-zinc-300 flex-1" />
                      <p className="text-xs font-bold uppercase text-zinc-700">
                        {group.name}
                      </p>
                    </div>
                    {group.actions.map((action) => (
                      <div
                        key={action.id}
                        onClick={() => handleEditAction(action.id)}
                        className={cn(
                          "cursor-pointer hover:bg-zinc-200 p-2 py-3 rounded-md",
                          currentActionId === action.id && "bg-zinc-200"
                        )}
                      >
                        <p className="text-xs">{action.name}</p>
                      </div>
                    ))}
                  </React.Fragment>
                ))
            )}
          </div>
        </div>
        {isSidebarOpen && (
          <div className="flex flex-row justify-between items-center p-3 px-5">
            <p className="text-sm text-gray-800">{user?.email}</p>
            <Button
              className="bg-zinc-200 hover:bg-zinc-300 border border-zinc-300 text-[#222] !px-3 !py-1 rounded-md text-sm"
              onClick={logout}
            >
              Log out
            </Button>
          </div>
        )}
        <div
          className={cn(
            "absolute top-7",
            isSidebarOpen ? "right-7" : "right-1",
            "cursor-pointer"
          )}
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          <SidebarIcon size="large" fill="black" />
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
