import { stat } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { z } from "zod";
import { R, type Result } from "../../../../common/src/result";
import { AgentKind } from "../shared/agent-kind";
import {
  type AgentApi,
  type Conversation,
  IpcChannel,
  type IpcResult,
  type StartInput,
} from "../shared/ipc";
import { queryTimeoutMs } from "./agent/cli-process";
import type { AgentBackend, AgentSession } from "./agent/session";
import { type ConversationStore, conversationTitle } from "./conversations";
import { isNotFound } from "./fs-error";
import {
  agentArg,
  folderArg,
  idArg,
  parseArg,
  textArg,
  toIpc,
} from "./ipc-args";
import { rendererIpc } from "./renderer-ipc";

export type Agent = {
  backend: AgentBackend;
  isSignedIn: (signal: AbortSignal) => Promise<Result<boolean, Error>>;
  /** Runs the CLI's own browser sign-in until it finishes or signal aborts. */
  signIn: (signal: AbortSignal) => Promise<Result<void, Error>>;
};

// AgentApi's inputs type the renderer's calls: a field missing here fails the build, or, when optional, the call.
const startArgs = z.strictObject({
  folder: folderArg,
  firstMessage: textArg,
  agent: agentArg,
}) satisfies z.ZodType<StartInput>;
const sendArgs = z.strictObject({
  sessionId: idArg,
  text: textArg,
}) satisfies z.ZodType<Parameters<AgentApi["send"]>[0]>;

// Node reports a missing cwd as ENOENT on the executable, which would blame the CLI.
async function checkFolder(folder: string): Promise<Result<void, Error>> {
  const found = await R.fromPromise(stat(folder));
  if (!found.ok)
    return R.failure(
      new Error(
        isNotFound(found.error)
          ? `${folder} doesn't exist.`
          : `Alliance agent can't open ${folder}: ${found.error.message}`,
      ),
    );
  return found.value.isDirectory()
    ? R.success(undefined)
    : R.failure(new Error(`${folder} isn't a folder.`));
}

type Closer = {
  folder: string;
  /** The number of openings begun before this closer, which it closes as they attach, even after its call has returned. */
  openedBefore: number;
  /** Until its call returns, it closes every session that attaches in its folder. */
  running: boolean;
  closes: Promise<void>[];
};

/** Registers the renderer's handlers and returns, as close, the quit step: once called, it aborts running sign-ins and sign-in checks, Start, Resume, SignIn and SignInStatus fail, and it closes every live session, a new one once its CLI has read its first message or openingWaitMs has passed, and resolves when each of those CLIs, each one closeSessionsIn is closing, and each a failed start closed, has exited, waiting at most openingWaitMs for sessions still starting; one that finishes starting after that is waited for only while other sessions, sign-in CLIs or failed starts' CLIs still close. A new session whose CLI exits without reading its first message, quitting or not, has its saved conversation removed, which the quit waits for. findAgent runs on each call for an agent until it first succeeds for it, so a CLI installed while the app runs is found. */
export function registerIpc(params: {
  findAgent: (agent: AgentKind) => Result<Agent, Error>;
  conversations: ConversationStore;
  /** The URL the window loads; only its top-level page may call these handlers or hear session events. */
  rendererUrl: string;
  openingWaitMs: number;
}): {
  close: () => Promise<void>;
  /** What Start does, its argument checks included, for a conversation the main process starts, such as a new task's first. */
  startConversation: (input: StartInput) => Promise<IpcResult<Conversation>>;
  /** Closes the live sessions in folder, those that attach there before it returns, and the ones already starting there as they start, a new one once its CLI has read its first message or openingWaitMs has passed, resolving once the CLIs of the sessions this call closes have exited and waiting at most openingWaitMs for sessions still starting; every Start and Resume in folder that hasn't reached its agent's CLI yet fails until it returns, and a Start already past that reports success for the session it closes. */
  closeSessionsIn: (folder: string) => Promise<void>;
} {
  const { findAgent, conversations, rendererUrl, openingWaitMs } = params;
  const live = new Map<string, { session: AgentSession; folder: string }>();
  // The backend hands a Resume the same session until its close begins, which closeOnceRead can hold back.
  const closingIn = new WeakSet<AgentSession>();
  const opening = new Set<Promise<unknown>>();
  let openingsBegun = 0;
  // Each closeSessionsIn in progress, with the closes it has begun; it lasts until its call has returned and the sessions starting when it began have started, so one of them that starts in its folder closes as it attaches.
  const closers = new Set<Closer>();
  // A CLI that exits before it reads its first message may keep no transcript, as Claude Code keeps none, so the quit and closeSessionsIn close these sessions once it has, or once openingWaitMs runs out. Each resolves once its CLI has read the message, or once it has exited and removing its saved conversation has been tried.
  const newSessions = new WeakMap<AgentSession, Promise<void>>();
  const quitStarted = Promise.withResolvers<void>();
  const waitEnded = quitStarted.promise.then(() =>
    setTimeout(openingWaitMs, false),
  );
  const quitCloses: Promise<void>[] = [];
  let closing = false;
  const signIns = new Map<AgentKind, AbortController>();
  const quitAbort = new AbortController();
  const queries = new Set<Promise<unknown>>();
  const track = <T>(query: Promise<T>): Promise<T> => {
    queries.add(query);
    void Promise.allSettled([query]).then(() => queries.delete(query));
    return query;
  };
  const found = new Map<AgentKind, Agent>();

  const withAgent = async <T>(
    kind: AgentKind,
    run: (agent: Agent) => Promise<Result<T, Error>>,
  ): Promise<IpcResult<T>> => {
    const cached = found.get(kind);
    if (cached) return toIpc(await run(cached));
    const agent = findAgent(kind);
    if (!agent.ok) return toIpc(agent);
    found.set(kind, agent.value);
    return toIpc(await run(agent.value));
  };

  const { handle, on, toRenderer } = rendererIpc(rendererUrl);

  const removeIfUnread = async (session: AgentSession) => {
    if (await session.firstMessageRead) return;
    console.error(
      `Removing conversation ${session.id}: its CLI exited before reading the first message.`,
    );
    const removed = await conversations.remove(session.id);
    if (removed.ok) toRenderer(IpcChannel.ConversationRemoved, session.id);
    else
      console.error(
        `Couldn't remove conversation ${session.id}: ${removed.error.message}`,
      );
  };

  const attach = (params: {
    session: AgentSession;
    folder: string;
    order: number;
  }) => {
    const { session, folder, order } = params;
    if (live.get(session.id)?.session === session) return;
    live.set(session.id, { session, folder });
    session.subscribe((event) =>
      toRenderer(IpcChannel.Event, { sessionId: session.id, event }),
    );
    const matching = [...closers].filter(
      (c) => c.folder === folder && (c.running || order <= c.openedBefore),
    );
    if (closing) closeForQuit(session);
    else if (matching.length > 0) {
      // Each running call drains its own closes, so every one this close concerns waits for it.
      const closed = closeIn(session, folder);
      for (const closer of matching) closer.closes.push(closed);
    }
  };

  const quittingError = () => new Error("Alliance agent is quitting.");
  const quitting = <T>(): IpcResult<T> => toIpc(R.failure(quittingError()));

  const openSession = <T>(
    open: (order: number) => Promise<IpcResult<T>>,
  ): Promise<IpcResult<T>> => {
    if (closing) return Promise.resolve(quitting());
    const opened = open(++openingsBegun);
    opening.add(opened);
    void Promise.allSettled([opened]).then(() => opening.delete(opened));
    return opened;
  };

  const closeOnceRead = async (params: {
    session: AgentSession;
    /** Resolves false once the wait for a new session's CLI to read its first message has run out. */
    waitEnded: Promise<boolean>;
    /** What the wait counts from. */
    since: string;
  }) => {
    const { session, since } = params;
    const removal = newSessions.get(session);
    if (
      removal &&
      !(await Promise.race([
        session.firstMessageRead.then(() => true),
        params.waitEnded,
      ]))
    )
      console.error(
        `Closing session ${session.id}: its CLI didn't read the first message within ${openingWaitMs / 1000} s of ${since}.`,
      );
    await session.close();
    await removal;
  };

  // Closing stops a running turn, which would otherwise go on unseen while the quit waits.
  const closeForQuit = (session: AgentSession) =>
    quitCloses.push(
      closeOnceRead({ session, waitEnded, since: "the quit beginning" }),
    );

  // A session that finishes opening once the quit began joins live, so the quit closes it at once, and waits for it unless the opening wait has run out and the other sessions have closed.
  const refuse = (opened: Parameters<typeof attach>[0]) => {
    attach(opened);
    return R.failure(quittingError());
  };

  handle(IpcChannel.SignInStatus, (_, agent) => {
    const kind = parseArg(agentArg, agent);
    if (!kind.ok) return toIpc(kind);
    return closing
      ? quitting()
      : withAgent(kind.value, ({ isSignedIn }) =>
          track(
            isSignedIn(
              AbortSignal.any([
                AbortSignal.timeout(queryTimeoutMs),
                quitAbort.signal,
              ]),
            ),
          ),
        );
  });

  handle(IpcChannel.SignIn, (_, agent) => {
    const kind = parseArg(agentArg, agent);
    if (!kind.ok) return toIpc(kind);
    return closing
      ? quitting()
      : withAgent(kind.value, ({ signIn }) => {
          signIns.get(kind.value)?.abort();
          const controller = new AbortController();
          signIns.set(kind.value, controller);
          return track(signIn(controller.signal));
        });
  });

  on(IpcChannel.CancelSignIn, (agent) => {
    const kind = parseArg(agentArg, agent);
    if (!kind.ok) return console.error(`CancelSignIn: ${kind.error.message}`);
    signIns.get(kind.value)?.abort();
  });

  handle(IpcChannel.ListConversations, async () =>
    toIpc(await conversations.list()),
  );

  const closerRunningIn = (folder: string) =>
    [...closers].some((c) => c.running && c.folder === folder);

  const startConversation = (
    input: unknown,
  ): Promise<IpcResult<Conversation>> => {
    const args = parseArg(startArgs, input);
    if (!args.ok) return Promise.resolve(toIpc(args));
    const { folder, firstMessage, agent } = args.value;
    return openSession((order) =>
      withAgent(
        agent,
        async ({ backend }): Promise<Result<Conversation, Error>> => {
          const usable = await checkFolder(folder);
          if (!usable.ok) return usable;
          if (closing) return R.failure(quittingError());
          if (closerRunningIn(folder))
            return R.failure(
              new Error(
                "Conversations in this folder are closing. Try again in a moment.",
              ),
            );
          const started = await backend.start({ cwd: folder });
          if (!started.ok) return started;
          const session = started.value;
          if (closing) return refuse({ session, folder, order });
          const conversation: Conversation = {
            id: session.id,
            folder,
            title: conversationTitle(firstMessage),
            startedAt: new Date().toISOString(),
            agent,
          };
          const saved = await conversations.add(conversation);
          // A conversation the app can't save couldn't be resumed later, so it doesn't start.
          if (!saved.ok) {
            await session.close();
            return saved;
          }
          // Set before attach, which can close the session during the quit or a closeSessionsIn, so that close waits for its first message.
          newSessions.set(session, removeIfUnread(session));
          attach({ session, folder, order });
          const sent = session.send({ text: firstMessage, images: [] });
          if (!sent.ok)
            throw new Error(
              `A new session refused its first message: ${sent.error.message}`,
            );
          return R.success(conversation);
        },
      ),
    );
  };

  handle(IpcChannel.Start, (_, input) => startConversation(input));

  const closingFailure = () =>
    R.failure(
      new Error("This conversation is closing. Try again in a moment."),
    );

  handle(IpcChannel.Resume, (_, sessionId) => {
    const parsed = parseArg(idArg, sessionId);
    if (!parsed.ok) return toIpc(parsed);
    const id = parsed.value;
    return openSession(async (order) => {
      const found = await conversations.find(id);
      if (!found.ok) return toIpc(found);
      const conversation = found.value;
      if (!conversation)
        return toIpc(
          R.failure(new Error(`No saved conversation has id ${id}.`)),
        );
      return withAgent(conversation.agent, async ({ backend }) => {
        const usable = await checkFolder(conversation.folder);
        if (!usable.ok) return usable;
        if (closing) return R.failure(quittingError());
        // The backend holds a Resume until the session's closing CLI exits and then reopens it, after closeSessionsIn has stopped closing what opens.
        if (closerRunningIn(conversation.folder)) return closingFailure();
        const resumed = await backend.resume({
          cwd: conversation.folder,
          sessionId: id,
        });
        if (!resumed.ok) return resumed;
        if (closingIn.has(resumed.value)) return closingFailure();
        const opened = {
          session: resumed.value,
          folder: conversation.folder,
          order,
        };
        if (closing) return refuse(opened);
        attach(opened);
        if (closingIn.has(resumed.value)) return closingFailure();
        return R.success({
          conversation,
          turnRunning: resumed.value.turnRunning,
        });
      });
    });
  });

  // No await may precede session.send: an Interrupt sent right after Send must find the turn started.
  handle(IpcChannel.Send, (_, input) => {
    const args = parseArg(sendArgs, input);
    if (!args.ok) return toIpc(args);
    const session = live.get(args.value.sessionId)?.session;
    if (!session)
      return toIpc(
        R.failure(new Error("This conversation isn't open. Reopen it.")),
      );
    return toIpc(session.send({ text: args.value.text, images: [] }));
  });

  // A one-way message has no reply to carry the error.
  on(IpcChannel.Interrupt, (sessionId) => {
    const id = parseArg(idArg, sessionId);
    if (!id.ok) return console.error(`Interrupt: ${id.error.message}`);
    live.get(id.value)?.session.interrupt();
  });

  const closeIn = (session: AgentSession, folder: string) => {
    live.delete(session.id);
    closingIn.add(session);
    const closed = closeOnceRead({
      session,
      waitEnded: setTimeout(openingWaitMs, false),
      since: `the close of sessions in ${folder} beginning`,
    });
    // The quit drains quitCloses, so it waits for these too.
    quitCloses.push(closed);
    return closed;
  };

  const closeSessionsIn = async (folder: string) => {
    const closer: Closer = {
      folder,
      openedBefore: openingsBegun,
      running: true,
      closes: [],
    };
    closers.add(closer);
    for (const entry of [...live.values()])
      if (entry.folder === folder)
        closer.closes.push(closeIn(entry.session, folder));
    const started = Promise.allSettled([...opening]);
    const allStarted = await Promise.race([
      started.then(() => true),
      setTimeout(openingWaitMs, false),
    ]);
    if (!allStarted)
      console.error(
        `Closing sessions in ${folder} without waiting further for sessions still starting after ${openingWaitMs / 1000} s; one that starts there closes as it does.`,
      );
    // A session that attaches while these close adds its own close, so this drains until no new close appears.
    for (let i = 0; i < closer.closes.length; i++) await closer.closes[i];
    closer.running = false;
    void started.then(() => closers.delete(closer));
  };

  const close = async () => {
    closing = true;
    for (const controller of signIns.values()) controller.abort();
    quitAbort.abort();
    quitStarted.resolve();
    for (const { session } of live.values()) closeForQuit(session);
    const opened = await Promise.race([
      Promise.allSettled(opening).then(() => true),
      waitEnded,
    ]);
    if (!opened)
      console.error(
        `Quitting without waiting further for ${opening.size} session(s) still starting after ${openingWaitMs / 1000} s.`,
      );
    await Promise.allSettled(queries);
    // A session that finishes opening while these close adds its own close, so the quit drains until no new close appears.
    let drained = 0;
    do {
      for (; drained < quitCloses.length; drained++) await quitCloses[drained];
      await Promise.all(
        [...found.values()].map(({ backend }) => backend.settled()),
      );
    } while (drained < quitCloses.length);
  };

  return { close, startConversation, closeSessionsIn };
}
