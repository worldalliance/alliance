import { MEMBER_GOAL } from "@alliance/shared/lib/constants";
import { roleBadges } from "@alliance/shared/lib/copy";
import {
  inviteGoalProgressPercent,
  inviteGoalStatus,
  inviteGoalSummary,
  selectInviteGoals,
} from "@alliance/shared/lib/inviteGoals";
import { useAllianceMemberCount } from "@alliance/shared/lib/useAllianceMemberCount";
import { useAmbassadorInviteDashboard } from "@alliance/shared/lib/useAmbassadorInviteDashboard";
import {
  newInviteGoalErrorCopy,
  useInviteGoalForms,
} from "@alliance/shared/lib/useInviteGoalForms";
import { CardStyle } from "@alliance/shared/styles/card";
import Card from "@alliance/sharedweb/ui/Card";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { ToastPlacement, useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { MoreHorizontal, Trash2 } from "lucide-react";
import type { FormEvent, MouseEvent } from "react";
import { useCallback, useMemo } from "react";

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const AmbassadorInviteGoalCard = () => {
  const { error: errorToast, confirm } = useToast();
  const {
    data: ambassadorDashboard,
    isLoading: loadingAmbassadorDashboard,
    isError: ambassadorDashboardError,
    createGoal,
    isCreatingGoal,
    updateGoal,
    isUpdatingGoal,
    deleteGoal,
    isDeletingGoal,
  } = useAmbassadorInviteDashboard();

  const { currentGoal, pastGoals } = useMemo(
    () => selectInviteGoals(ambassadorDashboard?.goals ?? []),
    [ambassadorDashboard],
  );
  const {
    goalTarget,
    setGoalTarget,
    goalStartDate,
    setGoalStartDate,
    goalDueDate,
    setGoalDueDate,
    goalFormMessage,
    submitNewGoal,
    showProminentGoalForm,
    editGoalStartDate,
    changeEditGoalStartDate,
    editGoalDueDate,
    changeEditGoalDueDate,
    editGoalTarget,
    setEditGoalTarget,
    saveEditGoalTarget,
    goalEditMessage,
  } = useInviteGoalForms({ currentGoal, createGoal, updateGoal });
  const currentGoalSummary = useMemo(() => {
    if (!currentGoal) {
      return null;
    }

    return inviteGoalSummary(inviteGoalStatus(currentGoal)).map((part, i) =>
      typeof part === "string" ? (
        part
      ) : (
        <span key={i} className="font-semibold text-white">
          {part.emphasis}
        </span>
      ),
    );
  }, [currentGoal]);

  const handleDeleteGoal = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (!currentGoal) {
        return;
      }

      const goalId = currentGoal.goal.id;
      void (async () => {
        const ok = await confirm({
          title: "Delete invitation goal?",
          message: "Are you sure you want to do this?",
          confirmLabel: "Delete goal",
          cancelLabel: "Cancel",
          anchorEl: event.currentTarget,
          placement: ToastPlacement.TopLeft,
        });
        if (!ok) {
          return;
        }

        await deleteGoal(goalId).catch((err: Error) => {
          errorToast(`Failed to delete goal: ${err.message}`);
        });
      })();
    },
    [confirm, currentGoal, deleteGoal, errorToast],
  );

  const handleSetGoal = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const result = submitNewGoal();
      if (!result.ok) {
        errorToast(newInviteGoalErrorCopy[result.error].message);
      }
    },
    [errorToast, submitNewGoal],
  );

  const handleEditGoalTargetChange = useCallback(
    (value: string) => {
      setEditGoalTarget(value);
      saveEditGoalTarget(value);
    },
    [saveEditGoalTarget, setEditGoalTarget],
  );

  const currentGoalProgressPercent = currentGoal
    ? inviteGoalProgressPercent(currentGoal)
    : 0;
  const currentGoalInvitesCreated = currentGoal?.stats.totalInvitesSent ?? 0;

  const { data: allianceMemberCount, isPending: allianceMemberCountPending } =
    useAllianceMemberCount();

  return (
    <Card
      style={CardStyle.White}
      className="p-6 gap-y-5 bg-green-bg-card border-none text-white shadow-sm"
    >
      <div className="flex flex-col gap-y-1">
        <div className="text-xs bg-ambassador text-white px-2 py-0.5 rounded-sm self-start cursor-default">
          {roleBadges.ambassador.label}
        </div>
        <h2 className="text-2xl font-semibold leading-tight">
          Current invitation goal
        </h2>
        <p className="text-sm text-white/70">
          Alliance growth goal:{" "}
          <span className="font-semibold text-white">
            {allianceMemberCountPending
              ? "..."
              : (allianceMemberCount ?? 0).toLocaleString()}
          </span>{" "}
          / {MEMBER_GOAL.toLocaleString()} members.
        </p>
      </div>

      {ambassadorDashboardError ? (
        <p className="text-sm text-red-100">
          Failed to load invitation goal stats.
        </p>
      ) : loadingAmbassadorDashboard || !ambassadorDashboard ? (
        <Spinner />
      ) : (
        <div className="flex flex-col gap-y-5">
          {currentGoal && (
            <div className="rounded border border-white/15 bg-white/10 p-4 sm:p-5 flex flex-col gap-y-5">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <p className="font-semibold text-lg leading-snug">
                    {currentGoalSummary}
                  </p>
                  <p className="text-sm text-white/70">
                    {formatDate(currentGoal.goal.startAt)} -{" "}
                    {formatDate(currentGoal.goal.dueAt)}
                  </p>
                </div>
                <div className="flex flex-row items-center gap-x-2 shrink-0">
                  <details className="relative">
                    <summary
                      className="border border-white/20 rounded p-2 h-10 w-10 flex items-center justify-center cursor-pointer list-none text-white hover:bg-white/10 [&::-webkit-details-marker]:hidden"
                      aria-label="Edit invitation goal"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </summary>
                    <div className="absolute right-0 top-12 z-20 w-72 rounded border border-zinc-200 bg-white p-4 text-black shadow-lg">
                      <p className="text-sm font-semibold">Edit goal</p>
                      <div className="mt-3 grid grid-cols-1 gap-3">
                        <label className="flex flex-col gap-y-1 min-w-0">
                          <span className="text-xs font-semibold text-zinc-500">
                            Target successful invitations
                          </span>
                          <input
                            className="border border-zinc-200 rounded px-3 py-2 h-11 w-full min-w-0"
                            type="number"
                            min={1}
                            inputMode="numeric"
                            value={editGoalTarget}
                            disabled={isUpdatingGoal}
                            onChange={(event) =>
                              handleEditGoalTargetChange(event.target.value)
                            }
                          />
                        </label>
                        <label className="flex flex-col gap-y-1 min-w-0">
                          <span className="text-xs font-semibold text-zinc-500">
                            Goal start
                          </span>
                          <input
                            className="border border-zinc-200 rounded px-3 py-2 h-11 w-full min-w-0"
                            type="date"
                            value={editGoalStartDate}
                            disabled={isUpdatingGoal}
                            onChange={(event) =>
                              changeEditGoalStartDate(event.target.value)
                            }
                          />
                        </label>
                        <label className="flex flex-col gap-y-1 min-w-0">
                          <span className="text-xs font-semibold text-zinc-500">
                            Goal end
                          </span>
                          <input
                            className="border border-zinc-200 rounded px-3 py-2 h-11 w-full min-w-0"
                            type="date"
                            value={editGoalDueDate}
                            disabled={isUpdatingGoal}
                            onChange={(event) =>
                              changeEditGoalDueDate(event.target.value)
                            }
                          />
                        </label>
                        {isUpdatingGoal && !goalEditMessage && (
                          <p className="text-sm text-zinc-500">Saving...</p>
                        )}
                        {goalEditMessage && (
                          <p className="text-sm text-red-500">
                            {goalEditMessage}
                          </p>
                        )}
                      </div>
                    </div>
                  </details>
                  <button
                    className="border border-red-200/70 bg-red-500/10 text-red-100 rounded p-2 disabled:opacity-40 h-10 w-10 flex items-center justify-center hover:bg-red-500/20 hover:border-red-200"
                    type="button"
                    aria-label="Delete invitation goal"
                    disabled={isDeletingGoal}
                    onClick={handleDeleteGoal}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-y-1">
                <div className="w-full h-4 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-[width] duration-300 ease-out"
                    style={{ width: `${currentGoalProgressPercent}%` }}
                    role="progressbar"
                    aria-valuenow={currentGoal.stats.goalSuccessfulRecruits}
                    aria-valuemin={0}
                    aria-valuemax={currentGoal.goal.targetSuccessfulRecruits}
                    aria-label="Successful invitations toward invitation goal"
                  />
                </div>
                <p className="text-sm sm:text-base tabular-nums">
                  <span className="font-semibold text-white">
                    {currentGoal.stats.goalSuccessfulRecruits}
                  </span>
                  <span className="text-white/70">
                    {" "}
                    / {currentGoal.goal.targetSuccessfulRecruits} successful
                    invitations
                  </span>
                </p>
                <div className="mt-2">
                  <div className="rounded border border-white/15 bg-white/10 px-3 py-2">
                    <p className="text-xs font-semibold text-white/65">
                      Invites created
                    </p>
                    <p className="text-lg font-semibold tabular-nums">
                      {currentGoalInvitesCreated}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {pastGoals.length > 0 && (
            <details className="rounded border border-white/15 bg-white/10 px-4 py-3 text-sm">
              <summary className="cursor-pointer font-medium text-white/80">
                View past goals
              </summary>
              <div className="mt-3 flex flex-col divide-y divide-white/15">
                {pastGoals.map((goal) => (
                  <div
                    key={goal.goal.id}
                    className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
                  >
                    <p className="text-white/70">
                      {formatDate(goal.goal.startAt)} -{" "}
                      {formatDate(goal.goal.dueAt)}
                    </p>
                    <p className="tabular-nums">
                      <span className="font-semibold text-white">
                        {goal.stats.goalSuccessfulRecruits}
                      </span>
                      <span className="text-white/70">
                        {" "}
                        / {goal.goal.targetSuccessfulRecruits} successful
                        invitations
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            </details>
          )}

          {showProminentGoalForm && (
            <div className="rounded border border-white/15 bg-white/10 p-4 sm:p-5 flex flex-col gap-y-3">
              <div>
                <p className="font-semibold text-lg">
                  {currentGoal ? "Set a new goal" : "Set a goal"}
                </p>
                <p className="text-sm text-white/70">
                  New goals can start in the past, but they cannot overlap
                  another invite goal.
                </p>
              </div>

              <form
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 items-end"
                onSubmit={handleSetGoal}
              >
                <label className="flex flex-col gap-y-1 min-w-0">
                  <span className="text-xs font-semibold text-white/70">
                    Target successful invitations
                  </span>
                  <input
                    className="border border-zinc-200 rounded px-3 py-2 h-11 w-full min-w-0 bg-white text-black"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    placeholder="10"
                    value={goalTarget}
                    onChange={(event) => setGoalTarget(event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-y-1 min-w-0">
                  <span className="text-xs font-semibold text-white/70">
                    Start date
                  </span>
                  <input
                    className="border border-zinc-200 rounded px-3 py-2 h-11 w-full min-w-0 bg-white text-black"
                    type="date"
                    value={goalStartDate}
                    onChange={(event) => setGoalStartDate(event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-y-1 min-w-0">
                  <span className="text-xs font-semibold text-white/70">
                    End date
                  </span>
                  <input
                    className="border border-zinc-200 rounded px-3 py-2 h-11 w-full min-w-0 bg-white text-black"
                    type="date"
                    value={goalDueDate}
                    onChange={(event) => setGoalDueDate(event.target.value)}
                  />
                </label>
                <button
                  className="bg-white text-green-bg-card rounded px-5 py-2 h-11 disabled:opacity-50 whitespace-nowrap w-full sm:col-span-2 lg:col-span-1 lg:w-auto lg:min-w-32 font-semibold hover:bg-white/90"
                  type="submit"
                  disabled={isCreatingGoal}
                >
                  Set goal
                </button>
                {goalFormMessage && (
                  <p className="sm:col-span-2 lg:col-span-3 text-sm text-red-100">
                    {goalFormMessage}
                  </p>
                )}
              </form>
            </div>
          )}

          <p className="text-sm text-white/70 leading-snug">
            Successful invitations are people you invited who signed their
            membership contract.
          </p>
        </div>
      )}
    </Card>
  );
};

export default AmbassadorInviteGoalCard;
