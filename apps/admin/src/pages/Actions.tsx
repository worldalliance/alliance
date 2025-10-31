import {
  ActionDto,
  actionsAddEvent,
  actionsClearDb,
  actionsCreate,
  actionsFindAllWithDrafts,
  actionsSetTestRelations,
  userList,
} from "@alliance/shared/client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import ActionTimeline from "../components/ActionTimeline";
import ConfirmDialog from "../components/ConfirmDialog";
import { testActions } from "../lib/testData";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import ActionListCard from "../components/ActionListCard";

export const getLastPastEventDate = (action: ActionDto): Date | null => {
  const now = Date.now();
  let latest: Date | null = null;

  for (const event of action.events) {
    if (!event?.date) {
      continue;
    }

    const eventDate = new Date(event.date);
    const eventTime = eventDate.getTime();

    if (Number.isNaN(eventTime) || eventTime > now) {
      continue;
    }

    if (!latest || eventDate > latest) {
      latest = eventDate;
    }
  }

  return latest;
};

const compareActionsBySchedule = (a: ActionDto, b: ActionDto) => {
  if (a.archived && !b.archived) {
    return 1;
  }

  if (!a.archived && b.archived) {
    return -1;
  }

  const aLastPast = getLastPastEventDate(a);
  const bLastPast = getLastPastEventDate(b);

  if (!aLastPast || !bLastPast) {
    return 0;
  }

  return aLastPast.getTime() - bLastPast.getTime();
};

type ActionSuiteGroup = {
  id: number | null;
  name: string;
  actions: ActionDto[];
  sortDate: Date | null;
  isArchivedOnly: boolean;
};

const ActionsList: React.FC = () => {
  const [actions, setActions] = useState<ActionDto[]>([]);
  const [actionsLoading, setActionsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showPopulateConfirm, setShowPopulateConfirm] = useState(false);
  const [isPopulating, setIsPopulating] = useState(false);
  const [totalUsers, setTotalUsers] = useState<number>(0);
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
    userList().then((res) => setTotalUsers(res.data?.length ?? 0));
  }, [loadActions]);

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

  const groupedActions = useMemo<ActionSuiteGroup[]>(() => {
    if (actions.length === 0) {
      return [];
    }

    const suites = new Map<
      string,
      {
        id: number | null;
        name: string;
        actions: ActionDto[];
      }
    >();

    actions.forEach((action) => {
      const suiteId = action.suite?.id ?? null;
      const suiteKey =
        suiteId === null ? "suite-unspecified" : `suite-${suiteId}`;
      const suiteName = action.suite?.name ?? "No suite";
      const existing = suites.get(suiteKey);

      if (existing) {
        existing.actions.push(action);
        return;
      }

      suites.set(suiteKey, {
        id: suiteId,
        name: suiteName,
        actions: [action],
      });
    });

    return Array.from(suites.values())
      .map((suite) => {
        const suiteActions = suite.actions
          .slice()
          .sort(compareActionsBySchedule);
        const nonArchivedActions = suiteActions.filter(
          (action) => !action.archived
        );
        const relevantActions =
          nonArchivedActions.length > 0 ? nonArchivedActions : suiteActions;

        const firstActionDate = relevantActions.reduce<Date | null>(
          (earliest, action) => {
            const date = getLastPastEventDate(action);
            if (!date) {
              return earliest;
            }

            if (!earliest || date < earliest) {
              return date;
            }

            return earliest;
          },
          null
        );

        return {
          ...suite,
          actions: suiteActions,
          sortDate: firstActionDate,
          isArchivedOnly: suiteActions.every((action) => action.archived),
        };
      })
      .sort((a, b) => {
        if (a.isArchivedOnly && !b.isArchivedOnly) {
          return 1;
        }

        if (!a.isArchivedOnly && b.isArchivedOnly) {
          return -1;
        }

        const aDate = a.sortDate;
        const bDate = b.sortDate;

        if (!aDate || !bDate) {
          if (aDate && !bDate) {
            return -1;
          }
          if (!aDate && bDate) {
            return 1;
          }

          return 0;
        }

        return aDate.getTime() - bDate.getTime();
      });
  }, [actions]);

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
      <title>Admin panel</title>
      <ActionTimeline
        actions={actions.filter(
          (a) => !a.archived && !a.everyoneShouldComplete
        )}
        className="h-full"
      />
      <div className="flex items-center gap-x-2 px-5 my-4">
        <p className="font-bold ">All actions</p>
        <Button
          onClick={() => navigate("/actions/new")}
          className="bg-green-3 hover:bg-green-2 text-white !px-3 !py-1 rounded-md text-sm"
          color={ButtonColor.Green}
        >
          New action
        </Button>
        <Button
          onClick={() => navigate("/new-suite")}
          className="bg-green-3 !px-3 !py-1 rounded-md text-sm"
          color={ButtonColor.White}
        >
          New suite
        </Button>
      </div>
      <p className="text-sm text-zinc-500 px-5">
        Grouped by suite and ordered by earliest appearing action (earliest last
        event first)
      </p>

      <div className="space-y-5 flex-1 overflow-y-auto p-5 pt-0">
        {groupedActions.map((suite) => (
          <div
            key={suite.id ?? "suite-unspecified"}
            className="border border-zinc-200 rounded-lg overflow-hidden"
          >
            <div className="px-4 py-2 border-b border-zinc-200 bg-zinc-50">
              {suite.id ? (
                <Link
                  to={`/suites/${suite.id}`}
                  className="text-sm font-semibold text-black hover:text-green"
                >
                  {suite.name}
                </Link>
              ) : (
                <p className="text-sm font-semibold text-black ">
                  {suite.name}
                </p>
              )}
            </div>
            <div className="space-y-3 p-4">
              {suite.actions.map((action) => (
                <ActionListCard
                  key={action.id}
                  action={action}
                  totalUsers={totalUsers}
                />
              ))}
            </div>
          </div>
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
