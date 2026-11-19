import { stat } from "node:fs/promises";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import { z } from "zod";
import { R, type Result } from "../../../../common/src/result";
import { AgentKind } from "../shared/agent-kind";
import {
  type AgentApi,
  type Conversation,
  IpcChannel,
  type IpcResult,
} from "../shared/ipc";
import { queryTimeoutMs } from "./agent/cli-process";
import type { AgentBackend, AgentSession } from "./agent/session";
import { type ConversationStore, conversationTitle } from "./conversations";
import { pickFolder } from "./folder-picker";
import { isNotFound } from "./fs-error";
import { rendererIpc } from "./renderer-ipc";

export type Agent = {
  backend: AgentBackend;
  isSignedIn: (signal: AbortSignal) => Promise<Result<boolean, Error>>;
  /** Runs the CLI's own browser sign-in until it finishes or signal aborts. */
  signIn: (signal: AbortSignal) => Promise<Result<void, Error>>;
};

const toIpc = <T>(result: Result<T, Error>): IpcResult<T> =>
  R.mapError(result, (error) => error.message);

const folderArg = z.string().refine(path.isAbsolute, "not an absolute path");
const idArg = z.string().min(1);
const agentArg = z.enum(AgentKind);
const textArg = z
  .string()
  .refine((text) => text.trim().length > 0, "an empty message");

// AgentApi's inputs type the renderer's calls: a field missing here fails the build, or, when optional, the call.
const startArgs = z.strictObject({
  folder: folderArg,
  firstMessage: textArg,
  agent: agentArg,
}) satisfies z.ZodType<Parameters<AgentApi["start"]>[0]>;
const sendArgs = z.strictObject({
  sessionId: idArg,
  text: textArg,
}) satisfies z.ZodType<Parameters<AgentApi["send"]>[0]>;

function parseArg<T>(schema: z.ZodType<T>, value: unknown): Result<T, Error> {
  const parsed = schema.safeParse(value);
  return parsed.success
    ? R.success(parsed.data)
    : R.failure(
        new Error(`Invalid argument: ${z.prettifyError(parsed.error)}`),
      );
}

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

/** Registers the renderer's handlers and returns the quit step: once called, it aborts running sign-ins and sign-in checks, Start, Resume, SignIn and SignInStatus fail, and it closes every live session, a new one once its CLI has read its first message or openingWaitMs has passed, and resolves when each of those CLIs, and each a failed start closed, has exited, waiting at most openingWaitMs for sessions still starting; one that finishes starting after that is waited for only while other sessions, sign-in CLIs or failed starts' CLIs still close. A new session whose CLI exits without reading its first message, quitting or not, has its saved conversation removed, which the quit waits for. findAgent runs on each call for an agent until it first succeeds for it, so a CLI installed while the app runs is found. */
export function registerIpc(params: {
  findAgent: (agent: AgentKind) => Result<Agent, Error>;
  conversations: ConversationStore;
  /** The URL the window loads; only its top-level page may call these handlers or hear session events. */
  rendererUrl: string;
  openingWaitMs: number;
}): () => Promise<void> {
  const { findAgent, conversations, rendererUrl, openingWaitMs } = params;
  const live = new Map<string, AgentSession>();
  const opening = new Set<Promise<unknown>>();
  // A CLI that exits before it reads its first message may keep no transcript, as Claude Code keeps none, so the quit closes these sessions once it has, or once openingWaitMs runs out. Each resolves once its CLI has read the message, or once it has exited and removing its saved conversation has been tried.
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

  const attach = (session: AgentSession) => {
    if (live.get(session.id) === session) return;
    live.set(session.id, session);
    session.subscribe((event) =>
      toRenderer(IpcChannel.Event, { sessionId: session.id, event }),
    );
    if (closing) closeForQuit(session);
  };

  const quittingError = () => new Error("Alliance agent is quitting.");
  const quitting = <T>(): IpcResult<T> => toIpc(R.failure(quittingError()));

  const openSession = <T>(
    open: () => Promise<IpcResult<T>>,
  ): Promise<IpcResult<T>> => {
    if (closing) return Promise.resolve(quitting());
    const opened = open();
    opening.add(opened);
    void Promise.allSettled([opened]).then(() => opening.delete(opened));
    return opened;
  };

  // Closing stops a running turn, which would otherwise go on unseen while the quit waits.
  const closeForQuit = (session: AgentSession) =>
    quitCloses.push(
      (async () => {
        const removal = newSessions.get(session);
        if (
          removal &&
          !(await Promise.race([
            session.firstMessageRead.then(() => true),
            waitEnded,
          ]))
        )
          console.error(
            `Closing session ${session.id} on quitting: its CLI didn't read the first message within ${openingWaitMs / 1000} s of the quit beginning.`,
          );
        await session.close();
        await removal;
      })(),
    );

  // A session that finishes opening once the quit began joins live, so the quit closes it at once, and waits for it unless the opening wait has run out and the other sessions have closed.
  const refuse = (session: AgentSession) => {
    attach(session);
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

  handle(IpcChannel.ChooseFolder, async (event) =>
    toIpc(await pickFolder(event)),
  );

  handle(IpcChannel.ListConversations, async () =>
    toIpc(await conversations.list()),
  );

  handle(IpcChannel.Start, (_, input) => {
    const args = parseArg(startArgs, input);
    if (!args.ok) return toIpc(args);
    const { folder, firstMessage, agent } = args.value;
    return openSession(() =>
      withAgent(
        agent,
        async ({ backend }): Promise<Result<Conversation, Error>> => {
          const usable = await checkFolder(folder);
          if (!usable.ok) return usable;
          if (closing) return R.failure(quittingError());
          const started = await backend.start({ cwd: folder });
          if (!started.ok) return started;
          const session = started.value;
          if (closing) return refuse(session);
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
          // During the quit, attach closes a session at once unless it is new.
          newSessions.set(session, removeIfUnread(session));
          attach(session);
          const sent = session.send({ text: firstMessage, images: [] });
          if (!sent.ok)
            throw new Error(
              `A new session refused its first message: ${sent.error.message}`,
            );
          return R.success(conversation);
        },
      ),
    );
  });

  handle(IpcChannel.Resume, (_, sessionId) => {
    const parsed = parseArg(idArg, sessionId);
    if (!parsed.ok) return toIpc(parsed);
    const id = parsed.value;
    return openSession(async () => {
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
        const resumed = await backend.resume({
          cwd: conversation.folder,
          sessionId: id,
        });
        if (!resumed.ok) return resumed;
        if (closing) return refuse(resumed.value);
        attach(resumed.value);
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
    const session = live.get(args.value.sessionId);
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
    live.get(id.value)?.interrupt();
  });

  return async () => {
    closing = true;
    for (const controller of signIns.values()) controller.abort();
    quitAbort.abort();
    quitStarted.resolve();
    for (const session of live.values()) closeForQuit(session);
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
}
