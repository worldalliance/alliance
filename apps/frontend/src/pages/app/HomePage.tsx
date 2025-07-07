import React, { useEffect, useState, useCallback } from "react";
import { HomeTaskView } from "../../components/HomeTaskView";
import {
  ActionDto,
  actionsComplete,
  actionsFindAllWithStatus,
} from "@alliance/shared/client";
import { useAuth } from "../../lib/AuthContext";
import { HomeNewActionsView } from "../../components/HomeNewActionsView";
import InviteMemberCard from "../../components/InviteMemberCard";
import GatheringCommitmentsView from "../../components/GatheringCommitmentsView";

const HomePage: React.FC = () => {
  const [actions, setActions] = useState<ActionDto[]>([]);
  const [todoActions, setTodoActions] = useState<ActionDto[]>([]);
  const [newActions, setNewActions] = useState<ActionDto[]>([]);
  const [committedActions, setCommittedActions] = useState<ActionDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { loading: authLoading, isAuthenticated } = useAuth();

  const updateActions = useCallback((actions: ActionDto[]) => {
    setActions(actions);
    setTodoActions(
      actions.filter(
        (action) =>
          action.myRelation?.status === "joined" &&
          action.status === "member_action"
      )
    );
    setNewActions(
      actions.filter(
        (action) =>
          !action.myRelation ||
          (action.myRelation.status === "none" &&
            action.status === "gathering_commitments")
      )
    );
    setCommittedActions(
      actions.filter(
        (action) =>
          action.myRelation?.status === "joined" &&
          action.status === "gathering_commitments"
      )
    );
  }, []);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    actionsFindAllWithStatus()
      .then(({ data }) => {
        console.log(data);
        if (data) {
          updateActions(data);
        }
      })
      .catch(() => setError("Failed to load actions"));
  }, [authLoading, isAuthenticated, updateActions]);

  const handleTaskComplete = (actionId: number) => {
    actionsComplete({ path: { id: actionId.toString() } }).then(() => {
      updateActions(actions.filter((action) => action.id !== actionId));
    });
  };

  return (
    <div className="flex flex-col w-full h-full items-center bg-white">
      <div className="flex flex-col py-16 max-w-[728px] md:min-w-[600px] gap-y-5 overflow-y-auto px-3">
        {error && <p className="text-red-500">{error}</p>}
        <div className="flex flex-col gap-y-8">
          {todoActions.length > 0 && (
            <HomeTaskView
              actions={todoActions.slice(0, 2)}
              onTaskComplete={handleTaskComplete}
            />
          )}
          <HomeNewActionsView actions={newActions} />
          <GatheringCommitmentsView actions={committedActions} />
          <InviteMemberCard />
        </div>
      </div>
    </div>
  );
};

export default HomePage;
