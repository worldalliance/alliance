import {
  ActionDto,
  actionsFindAllWithDrafts,
  actionsPasteJson,
} from "@alliance/shared/client";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import { href, Link, Outlet, useNavigate } from "react-router";
import { useAuth } from "./lib/AuthContext";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import SidebarIcon from "@alliance/shared/ui/icons/SidebarIcon";
import { isProduction } from "@alliance/shared/lib/config";
import DropdownIcon from "@alliance/shared/ui/icons/DropdownIcon";
import Dropdown from "@alliance/shared/ui/Dropdown";
import { useToast } from "@alliance/shared/ui/ToastProvider";

const Sidebar: React.FC = () => {
  const [actions, setActions] = useState<ActionDto[]>([]);
  const [actionsLoading, setActionsLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  const { logout, user, loading: authLoading } = useAuth();

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

  const [sidebarWidth, setSidebarWidth] = useState<number>(320);

  useLayoutEffect(() => {
    if (isSidebarOpen) {
      setSidebarWidth(320);
    } else {
      setSidebarWidth(64);
    }
  }, [isSidebarOpen]);

  const filteredActions = actions.filter((action) => !action.archived);

  const [createActionDropdownOpen, setCreateActionDropdownOpen] =
    useState<boolean>(false);

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
    actions: ActionDto[];
  }[] = [
    {
      name: "Active",
      actions: filteredActions.filter(
        (action) =>
          (action.status === "member_action" ||
            action.status === "gathering_commitments") &&
          !action.everyoneShouldComplete
      ),
    },
    {
      name: "Pending",
      actions: filteredActions.filter(
        (action) =>
          action.status !== "draft" &&
          action.status !== "member_action" &&
          action.status !== "gathering_commitments" &&
          !action.everyoneShouldComplete &&
          action.status !== "completed"
      ),
    },
    {
      name: "Draft",
      actions: filteredActions.filter((action) => action.status === "draft"),
    },
    {
      name: "Onboarding",
      actions: filteredActions.filter(
        (action) =>
          action.everyoneShouldComplete &&
          action.status !== "completed" &&
          action.status !== "draft"
      ),
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
        className={`overflow-y-auto max-h-screen overflow-x-hidden flex flex-col justify-between relative transition-all duration-100 bg-[#f4f4f4]`}
        style={{
          width: `${sidebarWidth}px`,
        }}
      >
        <div
          className={`flex flex-col gap-y-3 sticky p-5 py-6 w-[320px] ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <h1
            className={`text-[14pt] font-bold pb-0 ${
              isProd ? "text-red-500" : "text-gray-900"
            }`}
          >
            Alliance Admin
          </h1>
          <div className="flex flex-col gap-y-2">
            <Link
              to="/"
              className="pl-6 w-full bg-white hover:bg-gray-200/50 border border-gray-300 text-black px-4 py-2 rounded-md text-sm"
            >
              Actions
            </Link>
            <Link
              to="/members"
              className="w-full bg-white pl-6 hover:bg-gray-200/50 border border-gray-300 text-black px-4 py-2 rounded-md text-sm"
            >
              Members
            </Link>
            <Link
              to="/database"
              className="w-full bg-white pl-6 hover:bg-gray-200/50 border border-gray-300 text-blue-500 px-4 py-2 rounded-md text-sm "
            >
              Database Viewer →
            </Link>
            <Link
              to="/invites"
              className="w-full bg-white pl-6 hover:bg-gray-200/50 border border-gray-300 text-black px-4 py-2 rounded-md text-sm "
            >
              User Invites
            </Link>
            <Link
              to={href("/groups")}
              className="w-full bg-white pl-6 hover:bg-gray-200/50 border border-gray-300 text-black px-4 py-2 rounded-md text-sm "
            >
              Groups
            </Link>
          </div>
          <div className="flex flex-row justify-between items-center mt-3 relative">
            <p className="font-bold">Current Actions</p>
            <Button
              onClick={() => navigate("/actions/new")}
              className="text-white !px-3 !py-1 rounded-md text-sm"
              color={ButtonColor.Green}
            >
              Create
              <div
                className="mt-px ml-1 hover:bg-white/20 rounded-full p-1"
                onClick={handleCreateActionDropdown}
              >
                <DropdownIcon size="mini" fill="white" />
              </div>
            </Button>
            {createActionDropdownOpen && (
              <Dropdown
                isOpen={createActionDropdownOpen}
                className="absolute top-[100%] right-0 gap-y-2 min-w-[150px]"
              >
                <Button
                  color={ButtonColor.Light}
                  className="w-full"
                  onClick={() => navigate("/actions/new")}
                >
                  New Action
                </Button>
                <Button
                  color={ButtonColor.Black}
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
                        className={`cursor-pointer hover:bg-zinc-200 p-2 py-3 rounded-md ${
                          currentActionId === action.id ? "bg-zinc-200" : ""
                        }`}
                      >
                        <p className="text-sm">{action.name}</p>
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
          className="absolute top-7 right-6 cursor-pointer"
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
