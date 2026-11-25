import { R, type Result } from "../../../../../common/src/result";
import type { AgentSession } from "./session";

export type SessionHooks = {
  onClosing: (closed: Promise<void>) => void;
  onExit: () => void;
};

type Entry = Promise<Result<AgentSession, Error>>;
type Slot = { id: string; entry?: Entry };

const failed = (error: unknown) => R.failure(R.toError(error));

/** A backend's live sessions: concurrent resumes of one id share a launch, a resume waits out that id's closing CLI, and a failed or exited session is forgotten. */
export function sessionRegistry() {
  const live = new Map<string, Entry>();
  const closing = new Map<string, Promise<void>>();

  // A handle whose CLI has exited may close after a newer one replaced it; only the live one's close counts.
  function hooksFor(slot: Slot): SessionHooks {
    const liveId = () =>
      live.get(slot.id) === slot.entry ? slot.id : undefined;
    return {
      onExit: () => {
        const id = liveId();
        if (id !== undefined) live.delete(id);
      },
      onClosing: (closed) => {
        const id = liveId();
        if (id === undefined) return;
        live.delete(id);
        closing.set(id, closed);
        void closed.then(() => {
          if (closing.get(id) === closed) closing.delete(id);
        });
      },
    };
  }

  return {
    live: (id: string): Entry | undefined => live.get(id),

    /** Launches id's session once its closing CLI, if any, has exited, which keeps two from running on one session. */
    launch(id: string, launch: (hooks: SessionHooks) => Entry): Entry {
      const slot: Slot = { id };
      const entry = (closing.get(id) ?? Promise.resolve())
        .then(() => launch(hooksFor(slot)))
        .catch(failed);
      slot.entry = entry;
      live.set(id, entry);
      void entry.then((result) => {
        if (!result.ok && live.get(id) === entry) live.delete(id);
      });
      return entry;
    },

    /** Launches a session whose id its CLI gives once running, which joins the live set then; hooks it fires before that take effect once it has joined. */
    async launchNew(launch: (hooks: SessionHooks) => Entry): Entry {
      const early: ((hooks: SessionHooks) => void)[] = [];
      let held = (run: (hooks: SessionHooks) => void) => {
        early.push(run);
      };
      const started = await Promise.resolve()
        .then(() =>
          launch({
            onExit: () => held((hooks) => hooks.onExit()),
            onClosing: (closed) => held((hooks) => hooks.onClosing(closed)),
          }),
        )
        .catch(failed);
      if (!started.ok) return started;
      const id = started.value.id;
      const entry = Promise.resolve(started);
      live.set(id, entry);
      const hooks = hooksFor({ id, entry });
      held = (run) => run(hooks);
      for (const run of early) run(hooks);
      return started;
    },
  };
}
