import React, { useCallback, useEffect, useState } from "react";
import Card, { CardStyle } from "./Card";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ActionDto, actionsFindAllWithDrafts } from "@alliance/shared/client";
import { useAuth } from "./AuthContext";
import ActionDashboard from "./ActionDashboard";
import ActionProgressBar from "./components/ActionProgressBar";

const AdminPanel: React.FC = () => {
  const [actions, setActions] = useState<ActionDto[]>([]);
  const [actionsLoading, setActionsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { logout, user, loading: authLoading } = useAuth();

  // Get current view state from URL params
  const selectedActionId = searchParams.get("action");
  const isCreatingNew = searchParams.get("new") === "true";

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
      setError("Failed to load actions");
      setActionsLoading(false);
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadActions();
  }, [loadActions]);

  const handleCreateAction = useCallback(() => {
    setSearchParams({ new: "true" });
  }, [setSearchParams]);

  const handleEditAction = useCallback(
    (id: number) => {
      setSearchParams({ action: id.toString() });
    },
    [setSearchParams]
  );

  const handleBackToList = useCallback(() => {
    setSearchParams({});
  }, [setSearchParams]);

  const handleActionCreated = useCallback(
    (action: ActionDto) => {
      setSearchParams({ action: action.id.toString() });
      loadActions(); // Refresh the list
    },
    [setSearchParams, loadActions]
  );

  const handleActionUpdated = useCallback(() => {
    loadActions(); // Refresh the list
  }, [loadActions]);

  const handleActionDeleted = useCallback(() => {
    setSearchParams({});
    loadActions(); // Refresh the list
  }, [setSearchParams, loadActions]);

  const handleDatabaseViewer = useCallback(() => {
    navigate("/database");
  }, [navigate]);

  return (
    <div className="flex flex-row min-h-screen h-fitcontent flex-nowrap bg-pagebg">
      <div className="flex flex-row py-12 justify-center w-full gap-x-6 px-3">
        <div className="flex flex-col border-r border-gray-300 pr-6 w-[800px] gap-y-5 min-h-0">
          <div className="flex justify-between items-center">
            <h1 className="text-[#111] text-[14pt] font-bold font-sabon">
              Alliance Admin
            </h1>
          </div>

          {selectedActionId || isCreatingNew ? (
            // Show Action Dashboard
            <div className="flex-1 min-h-0">
              <ActionDashboard
                actionId={selectedActionId || "new"}
                isNew={isCreatingNew}
                onActionCreated={handleActionCreated}
                onActionUpdated={handleActionUpdated}
                onActionDeleted={handleActionDeleted}
                onCancel={handleBackToList}
              />
            </div>
          ) : (
            // Show Actions List
            <>
              <h1 className="text-[#111] text-[14pt] font-extrabold">
                Actions List
              </h1>

              {actionsLoading ? (
                <p>Loading actions...</p>
              ) : error ? (
                <p className="text-red-500">{error}</p>
              ) : actions.length === 0 ? (
                <p>No actions found.</p>
              ) : (
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {actions.map((action) => (
                    <Card key={action.name} style={CardStyle.Outline}>
                      <div
                        onClick={() => handleEditAction(action.id)}
                        className="cursor-pointer"
                      >
                        <div className="flex justify-between mb-2 items-start">
                          <h2 className="font-bold text-sm">{action.name}</h2>
                          <span className="p-2 px-3 ml-2 bg-gray-200 text-gray-800 text-xs rounded-full text-nowrap">
                            {action.status}
                          </span>
                        </div>
                        <p className="text-xs">{action.shortDescription}</p>

                        <ActionProgressBar
                          status={action.status}
                          usersJoined={action.usersJoined}
                          usersCompleted={action.usersCompleted}
                          commitmentThreshold={action.commitmentThreshold}
                          actionType={action.type}
                          donationThreshold={action.donationThreshold}
                          donationAmount={action.donationAmount}
                          className="mt-2"
                        />
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex flex-col gap-y-5 w-[320px]">
          <Card style={CardStyle.White}>
            <h1 className="font-bold pb-0">Admin Actions</h1>
            <div className="flex flex-col gap-y-3 mt-4">
              <button
                onClick={handleCreateAction}
                className="w-full bg-stone-600 hover:bg-stone-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Create New Action
              </button>
              <button
                onClick={handleDatabaseViewer}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Database Viewer
              </button>
            </div>
          </Card>
          <Card style={CardStyle.White}>
            <h1 className="font-bold pb-0">Status Overview</h1>
            <div className="mt-2 space-y-2">
              <div className="flex justify-between">
                <span>Total Actions:</span>
                <span className="font-medium">{actions.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Draft:</span>
                <span className="font-medium">
                  {actions.filter((a) => a.status === "draft").length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Upcoming:</span>
                <span className="font-medium">
                  {actions.filter((a) => a.status === "upcoming").length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Gathering Commitments:</span>
                <span className="font-medium ">
                  {
                    actions.filter((a) => a.status === "gathering_commitments")
                      .length
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span>Commitments Reached:</span>
                <span className="font-medium ">
                  {
                    actions.filter((a) => a.status === "commitments_reached")
                      .length
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span>Member Action:</span>
                <span className="font-medium ">
                  {actions.filter((a) => a.status === "member_action").length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Resolution:</span>
                <span className="font-medium ">
                  {actions.filter((a) => a.status === "resolution").length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Completed:</span>
                <span className="font-medium ">
                  {actions.filter((a) => a.status === "completed").length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Failed/Abandoned:</span>
                <span className="font-medium ">
                  {
                    actions.filter((a) =>
                      ["failed", "abandoned"].includes(a.status)
                    ).length
                  }
                </span>
              </div>
            </div>
          </Card>
          <Card style={CardStyle.White}>
            <button
              className="w-full bg-stone-600 hover:bg-stone-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              onClick={logout}
            >
              Log out
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
