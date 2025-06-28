import React, { useCallback, useEffect, useState } from "react";
import Card, { CardStyle } from "./Card";
import { useNavigate } from "react-router-dom";
import { ActionDto, actionsFindAllWithDrafts } from "@alliance/shared/client";
import { useAuth } from "./AuthContext";

const AdminPanel: React.FC = () => {
  const [actions, setActions] = useState<ActionDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const { logout, user } = useAuth();

  if (!user?.admin) {
    logout();
  }

  useEffect(() => {
    const loadActions = async () => {
      try {
        const response = await actionsFindAllWithDrafts();
        console.log(response.data);
        if (response.data) {
          setActions(response.data);
        }
        setLoading(false);
      } catch (err) {
        setError("Failed to load actions");
        setLoading(false);
        console.error(err);
      }
    };

    loadActions();
  }, []);

  const handleCreateAction = useCallback(() => {
    navigate("/action/new");
  }, [navigate]);

  const handleEditAction = useCallback(
    (id: number) => {
      navigate(`/action/${id}`);
    },
    [navigate]
  );

  const handleDatabaseViewer = useCallback(() => {
    navigate("/database");
  }, [navigate]);

  return (
    <div className="flex flex-row min-h-screen h-fitcontent flex-nowrap bg-pagebg">
      <div className="flex flex-row py-12 justify-center w-full gap-x-6 px-3">
        <div className="flex flex-col border-r border-gray-300 pr-6 w-[600px] gap-y-5">
          <div className="flex justify-between items-center">
            <h1 className="text-[#111] text-[14pt] font-bold font-sabon">
              Alliance Admin
            </h1>
          </div>
          <h1 className="text-[#111] text-[14pt] font-extrabold">
            Actions List
          </h1>

          {loading ? (
            <p>Loading actions...</p>
          ) : error ? (
            <p className="text-red-500">{error}</p>
          ) : actions.length === 0 ? (
            <p>No actions found.</p>
          ) : (
            actions.map((action) => (
              <Card key={action.name} style={CardStyle.Outline}>
                <div
                  onClick={() => handleEditAction(action.id)}
                  className="cursor-pointer"
                >
                  <div className="flex justify-between mb-2">
                    <h2 className="font-bold">{action.name}</h2>
                    <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                      {action.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">
                    {action.category}
                  </p>
                  <p className="text-sm">{action.shortDescription}</p>
                </div>
              </Card>
            ))
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
            <div className="mt-2">
              <p>Total Actions: {actions.length}</p>
              <p>
                Active: {actions.filter((a) => a.status === "active").length}
              </p>
              <p>Draft: {actions.filter((a) => a.status === "draft").length}</p>
              <p>
                Completed: {actions.filter((a) => a.status === "past").length}
              </p>
            </div>
          </Card>
          <Card style={CardStyle.White}>
            <button
              className="w-full bg-stone-600 hover:bg-stone-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              onClick={logout}
            >
              Logout
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
