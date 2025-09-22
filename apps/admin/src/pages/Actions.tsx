import {
  ActionDto,
  actionsAddEvent,
  actionsClearDb,
  actionsCreate,
  actionsFindAllWithDrafts,
  actionsSetTestRelations,
} from "@alliance/shared/client";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import ActionProgressBar from "../components/ActionProgressBar";
import ActionTimeline from "../components/ActionTimeline";
import ConfirmDialog from "../components/ConfirmDialog";
import { testActions } from "../lib/testData";

const ActionsList: React.FC = () => {
  const [actions, setActions] = useState<ActionDto[]>([]);
  const [actionsLoading, setActionsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showPopulateConfirm, setShowPopulateConfirm] = useState(false);
  const [isPopulating, setIsPopulating] = useState(false);
  const navigate = useNavigate();

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

  const handleEditAction = useCallback(
    (id: number) => {
      navigate(`/actions/${id}`);
    },
    [navigate]
  );

  const handlePopulateTestData = useCallback(async () => {
    setIsPopulating(true);
    try {
      await actionsClearDb();
      // Create each test action using the existing endpoint
      for (let i = 0; i < testActions.length; i++) {
        const testAction = testActions[i];
        const response = await actionsCreate({ body: { ...testAction } });

        if (response.data?.id) {
          await actionsAddEvent({
            path: { id: response.data.id },
            body: {
              title: "Action Launch",
              description:
                "Action is now live and gathering commitments from the community.",
              newStatus: "gathering_commitments",
              date: new Date(Date.now() - 86400000).toISOString(),
              showInTimeline: true,
              sendNotifsTo: "all",
            },
          });
          if (i % 2 === 0) {
            await actionsAddEvent({
              path: { id: response.data.id },
              body: {
                title: "Member action",
                description: "Enough people have committed! Time for action.",
                newStatus: "member_action",
                date: new Date(Date.now() - 26400000).toISOString(),
                showInTimeline: true,
                sendNotifsTo: "joined",
              },
            });
          }
        }
      }
      await loadActions();
      await actionsSetTestRelations();
    } catch (err) {
      setError("Failed to populate test data");
      console.error(err);
    } finally {
      setIsPopulating(false);
      setShowPopulateConfirm(false);
    }
  }, [loadActions]);

  if (actionsLoading) {
    return <p>Loading actions...</p>;
  }

  if (error) {
    return <p className="text-red-500">{error}</p>;
  }

  if (actions.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <p className="font-bold ml-2">Actions</p>
          <button
            onClick={() => setShowPopulateConfirm(true)}
            disabled={isPopulating}
            className="bg-gray-100 hover:bg-gray-200/50 border border-gray-300 text-black px-4 py-2 rounded-md text-sm font-medium"
          >
            {isPopulating ? "Populating..." : "Populate Test Data"}
          </button>
        </div>
        <p>No actions found.</p>
        {showPopulateConfirm && (
          <ConfirmDialog
            isOpen={showPopulateConfirm}
            onCancel={() => setShowPopulateConfirm(false)}
            onConfirm={handlePopulateTestData}
            title="Populate Test Data"
            message={`This will clear all existing action data and replace it with test actions. Are you sure you want to proceed?`}
            confirmText="Populate Data"
            cancelText="Cancel"
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ActionTimeline actions={actions} className="h-full" />
      <p className="font-bold my-4 px-5">All actions</p>
      <p className="text-sm text-zinc-500 px-5">
        Sorted by appearance to users (earliest last event first)
      </p>

      <div className="space-y-3 flex-1 overflow-y-auto p-5 pt-0">
        {actions
          .sort((a, b) => {
            const aEvent = a.events[a.events.length - 1];
            const bEvent = b.events[b.events.length - 1];

            const aDate = aEvent ? new Date(aEvent.date) : new Date(0);
            const bDate = bEvent ? new Date(bEvent.date) : new Date(0);

            return aDate.getTime() - bDate.getTime();
          })
          .map((action) => (
            <Card key={action.name} style={CardStyle.White}>
              <div
                onClick={() => handleEditAction(action.id)}
                className="cursor-pointer relative"
              >
                <div className="flex justify-between mb-2 ">
                  <div className="flex flex-row items-center gap-x-2">
                    <h2 className="font-bold text-sm">{action.name}</h2>
                    {action.events.length > 0 && (
                      <p className="text-sm text-zinc-500">
                        Last event{" "}
                        {new Date(
                          action.events[action.events.length - 1]?.date
                        ).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <span className="absolute p-2 right-0 top-0 bg-zinc-50 text-zinc-800 font-medium text-xs rounded-sm text-nowrap border-zinc-200 border">
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
                  donationAmount={action.donationAmount}
                  className="mt-2"
                />
              </div>
            </Card>
          ))}
        {window.location.href.includes("localhost") && (
          <div className="flex justify-between items-center">
            <button
              onClick={() => setShowPopulateConfirm(true)}
              disabled={isPopulating}
              className="bg-gray-100 hover:bg-gray-200/50 border border-gray-300 text-black px-4 py-2 rounded-md text-sm font-medium"
            >
              {isPopulating ? "Populating..." : "Populate Test Data"}
            </button>
          </div>
        )}
      </div>

      {showPopulateConfirm && (
        <ConfirmDialog
          isOpen={showPopulateConfirm}
          onCancel={() => setShowPopulateConfirm(false)}
          onConfirm={handlePopulateTestData}
          title="Populate Test Data"
          message={`This will clear all existing action data and replace it with test actions. Are you sure you want to proceed?`}
          confirmText="Populate Data"
          cancelText="Cancel"
        />
      )}
    </div>
  );
};

export default ActionsList;
