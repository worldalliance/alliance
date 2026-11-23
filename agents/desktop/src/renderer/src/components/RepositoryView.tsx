import { useState } from "react";
import type { RepositoryReply } from "../../../shared/ipc";
import { type Problem, RepositoryStatus } from "../../../shared/repository";
import { agent } from "../agent";
import { focusIfLost } from "../focus";
import {
  blockerWords,
  clonePhaseWords,
  type ShownRepository,
} from "../repository";
import { Folder } from "./Folder";
import { ProblemText } from "./ProblemText";

export function RepositoryView({ shown }: { shown: ShownRepository }) {
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // Shown only while the state keeps the status the action started in.
  const [actionProblem, setActionProblem] = useState<{
    problem: Problem;
    status?: RepositoryStatus;
  }>();

  const act = async (run: () => Promise<RepositoryReply>) => {
    if (pending) return;
    const status = shown.state?.status;
    setPending(true);
    setActionProblem(undefined);
    const replied = await run();
    setPending(false);
    setConfirming(false);
    if (!replied.ok)
      setActionProblem({ problem: { message: replied.error }, status });
    else if (replied.value)
      setActionProblem({ problem: replied.value, status });
  };

  const button = (params: {
    label: string;
    run: () => Promise<RepositoryReply>;
    primary?: boolean;
  }) => (
    <button
      type="button"
      className={params.primary ? "primary" : undefined}
      aria-disabled={pending || undefined}
      onClick={() => void act(params.run)}
    >
      {params.label}
    </button>
  );

  const useExisting = button({
    label: "Use existing copy…",
    run: () => agent.useExistingRepository(),
  });
  const checkAgain = button({
    label: "Check again",
    run: () => agent.checkRepositoryAgain(),
  });

  const body = () => {
    const { state } = shown;
    if (!state)
      return shown.problem ? (
        <ProblemText
          problem={{
            message: "Alliance agent couldn't check the repository.",
            details: shown.problem,
          }}
        />
      ) : (
        <p role="status">Checking for the Alliance repository…</p>
      );
    switch (state.status) {
      case RepositoryStatus.Checking:
        return (
          <p role="status" tabIndex={-1} ref={focusIfLost}>
            Checking for the Alliance repository…
          </p>
        );
      case RepositoryStatus.GitMissing:
        return (
          <>
            <ProblemText problem={{ message: state.message }} />
            <div className="actions">{checkAgain}</div>
          </>
        );
      case RepositoryStatus.NotSetUp:
        return (
          <>
            {state.problem && <ProblemText problem={state.problem} />}
            <Folder label="Clone into" folder={state.cloneFolder} />
            <div className="actions">
              {button({
                label: "Clone",
                run: () => agent.cloneRepository(),
                primary: true,
              })}
              {button({
                label: "Change folder…",
                run: () => agent.changeCloneFolder(),
              })}
              {useExisting}
              {state.problem && checkAgain}
            </div>
          </>
        );
      case RepositoryStatus.Cloning:
        return (
          <>
            <Folder label="Cloning into" folder={state.folder} />
            <p role="status" tabIndex={-1} ref={focusIfLost}>
              {clonePhaseWords(state.phase)}
            </p>
            <progress
              aria-label="Clone progress"
              max={100}
              value={state.percent}
            />
            <div className="actions">
              <button type="button" onClick={() => agent.cancelClone()}>
                Cancel
              </button>
              {button({
                label: "Change folder…",
                run: () => agent.changeCloneFolder(),
              })}
              {useExisting}
            </div>
          </>
        );
      case RepositoryStatus.Ready:
        return (
          <>
            <Folder label="Folder" folder={state.folder} />
            <p role="status" tabIndex={-1} ref={focusIfLost}>
              Ready.
            </p>
            <div className="actions">{useExisting}</div>
          </>
        );
      case RepositoryStatus.UpdateNeeded:
        return (
          <>
            <Folder label="Folder" folder={state.folder} />
            <p>
              This copy is older than Alliance agent needs, so tasks can't use
              it yet.
            </p>
            {state.problem && <ProblemText problem={state.problem} />}
            {state.blocker ? (
              <>
                <p>{blockerWords(state.blocker)}</p>
                <div className="actions">
                  {checkAgain}
                  {useExisting}
                </div>
              </>
            ) : confirming ? (
              <>
                <p>
                  Update {state.folder} to the latest main? Its main branch
                  moves forward to match GitHub; nothing on it is lost.
                </p>
                <div className="actions">
                  {button({
                    label: "Update",
                    run: () => agent.updateRepository(),
                    primary: true,
                  })}
                  <button
                    type="button"
                    ref={focusIfLost}
                    onClick={() => setConfirming(false)}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <div className="actions">
                <button
                  type="button"
                  className="primary"
                  ref={focusIfLost}
                  onClick={() => setConfirming(true)}
                >
                  Update to the latest main…
                </button>
                {useExisting}
              </div>
            )}
          </>
        );
      case RepositoryStatus.Updating:
        return (
          <>
            <Folder label="Folder" folder={state.folder} />
            <p role="status" tabIndex={-1} ref={focusIfLost}>
              Updating to the latest main…
            </p>
            <div className="actions">
              <button type="button" onClick={() => agent.cancelUpdate()}>
                Cancel
              </button>
            </div>
          </>
        );
      default:
        throw new Error(`unknown status: ${state satisfies never}`);
    }
  };

  return (
    <div className="start repository">
      <h1>Alliance repository</h1>
      <p className="hint">
        Agents work on their own copy of this for each task.
      </p>
      {body()}
      {actionProblem && actionProblem.status === shown.state?.status && (
        <ProblemText problem={actionProblem.problem} />
      )}
    </div>
  );
}
