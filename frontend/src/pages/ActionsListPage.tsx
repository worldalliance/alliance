import React, { useEffect, useState } from "react";
import { actionsApi, Action } from "../lib/actionsApi";
import ActionItemCard, { ActionCardAction } from "../components/ActionItemCard";
import Navbar from "../components/Navbar";
import { NavbarPage } from "../components/Navbar";
import { useNavigate } from "react-router-dom";

const ActionsListPage: React.FC = () => {
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchActions = async () => {
      try {
        console.log("fetching actions");
        const actionsList = await actionsApi.getAllActions();
        setActions(actionsList);
        setLoading(false);
      } catch (err) {
        setError("Failed to load actions. Please try again later.");
        setLoading(false);
        console.error("Error fetching actions:", err);
      }
    };

    fetchActions();
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <h1 className="font-berlingske text-4xl mb-6">Actions</h1>

        {loading && <p className="text-center py-4">Loading actions...</p>}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {actions.map((action) => (
            <ActionItemCard
              key={action.id}
              title={action.name}
              description={action.description}
              category={action.category}
              actions={[ActionCardAction.Details]}
              onClick={() => navigate(`/action/${action.id}`)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ActionsListPage;
