import {
  BrowserWindow,
  dialog,
  ipcMain,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from "electron";
import { stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { R, type Result } from "../../../../common/src/result";
import {
  type Conversation,
  IpcChannel,
  type IpcResult,
  type SessionEvent,
} from "../shared/ipc";
import { isSignedInToClaude, signInToClaude } from "./agent/claude/auth";
import type { ClaudeCli } from "./agent/claude/process";
import type { AgentBackend, AgentSession } from "./agent/session";
import { type ConversationStore, conversationTitle } from "./conversations";
import { fromRendererOnly } from "./renderer-frame";

type Claude = { cli: ClaudeCli; backend: AgentBackend };

const toIpc = <T>(result: Result<T, Error>): IpcResult<T> =>
  R.mapError(result, (error) => error.message);

const folderArg = z.string().refine(path.isAbsolute, "not an absolute path");
const idArg = z.string().min(1);
const textArg = z
  .string()
  .refine((text) => text.trim().length > 0, "an empty message");

const startArgs = z.object({ folder: folderArg, firstMessage: textArg });
const sendArgs = z.object({ sessionId: idArg, text: textArg });

function parseArg<T>(schema: z.ZodType<T>, value: unknown): Result<T, Error> {
  const parsed = schema.safeParse(value);
  return parsed.success
    ? R.success(parsed.data)
    : R.failure(
        new Error(`Invalid argument: ${z.prettifyError(parsed.error)}`),
      );
}

// Node reports a missing cwd as ENOENT on the executable, which would blame Claude Code.
async function checkFolder(folder: string): Promise<Result<void, Error>> {
  const found = await R.fromPromise(stat(folder));
  if (!found.ok)
    return R.failure(
      new Error(
        "code" in found.error && found.error.code === "ENOENT"
          ? `${folder} doesn't exist.`
          : `Alliance agent can't open ${folder}: ${found.error.message}`,
      ),
    );
  return found.value.isDirectory()
    ? R.success(undefined)
    : R.failure(new Error(`${folder} isn't a folder.`));
}

function broadcast(sessionEvent: SessionEvent): void {
  for (const window of BrowserWindow.getAllWindows())
    window.webContents.send(IpcChannel.Event, sessionEvent);
}

/** Registers the renderer's handlers. findClaude runs on each call until it first succeeds, so a CLI installed while the app runs is found. */
export function registerIpc(params: {
  findClaude: () => Result<Claude, Error>;
  conversations: ConversationStore;
  /** The URL the window loads; only its top-level page may call. */
  rendererUrl: string;
}): void {
  const { findClaude, conversations, rendererUrl } = params;
  const live = new Map<string, AgentSession>();
  let signIn: AbortController | undefined;
  let claude: Result<Claude, Error> | undefined;

  const withClaude = async <T>(
    run: (claude: Claude) => Promise<Result<T, Error>>,
  ): Promise<IpcResult<T>> => {
    if (!claude?.ok) claude = findClaude();
    return toIpc(claude.ok ? await run(claude.value) : claude);
  };

  const attach = (session: AgentSession) => {
    if (live.get(session.id) === session) return;
    live.set(session.id, session);
    session.subscribe((event) => broadcast({ sessionId: session.id, event }));
  };

  // Per Electron's security checklist, so a frame that slips past the CSP or navigation lock can't run Claude.
  const handle = (
    channel: IpcChannel,
    listener: (event: IpcMainInvokeEvent, arg: unknown) => unknown,
  ) =>
    ipcMain.handle(
      channel,
      fromRendererOnly({
        rendererUrl,
        listener,
        refuse: () => {
          throw new Error(`${channel} called from outside the app's page`);
        },
      }),
    );
  const on = (channel: IpcChannel, listener: (arg: unknown) => void) =>
    ipcMain.on(
      channel,
      fromRendererOnly({
        rendererUrl,
        listener: (_event: IpcMainEvent, arg: unknown) => listener(arg),
        refuse: () =>
          console.error(`${channel} sent from outside the app's page`),
      }),
    );

  handle(IpcChannel.ClaudeStatus, () =>
    withClaude(({ cli }) => isSignedInToClaude(cli)),
  );

  handle(IpcChannel.SignIn, () =>
    withClaude(({ cli }) => {
      signIn?.abort();
      signIn = new AbortController();
      return signInToClaude(cli, signIn.signal);
    }),
  );

  on(IpcChannel.CancelSignIn, () => signIn?.abort());

  handle(IpcChannel.ChooseFolder, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const options: Electron.OpenDialogOptions = {
      properties: ["openDirectory", "createDirectory"],
    };
    const chosen = await (window
      ? dialog.showOpenDialog(window, options)
      : dialog.showOpenDialog(options));
    return chosen.canceled ? undefined : chosen.filePaths[0];
  });

  handle(IpcChannel.ListConversations, async () =>
    toIpc(await conversations.list()),
  );

  handle(IpcChannel.Start, (_, input) => {
    const args = parseArg(startArgs, input);
    if (!args.ok) return toIpc(args);
    const { folder, firstMessage } = args.value;
    return withClaude(
      async ({ backend }): Promise<Result<Conversation, Error>> => {
        const usable = await checkFolder(folder);
        if (!usable.ok) return usable;
        const started = await backend.start({ cwd: folder });
        if (!started.ok) return started;
        const session = started.value;
        const conversation: Conversation = {
          id: session.id,
          folder,
          title: conversationTitle(firstMessage),
          startedAt: new Date().toISOString(),
        };
        const saved = await conversations.add(conversation);
        // A conversation the app can't save couldn't be resumed later, so it doesn't start.
        if (!saved.ok) {
          await session.close();
          return saved;
        }
        attach(session);
        const sent = session.send({ text: firstMessage, images: [] });
        if (!sent.ok)
          throw new Error(
            `A new session refused its first message: ${sent.error.message}`,
          );
        return R.success(conversation);
      },
    );
  });

  handle(IpcChannel.Resume, (_, sessionId) => {
    const parsed = parseArg(idArg, sessionId);
    if (!parsed.ok) return toIpc(parsed);
    const id = parsed.value;
    return withClaude(async ({ backend }) => {
      const found = await conversations.find(id);
      if (!found.ok) return found;
      const conversation = found.value;
      if (!conversation)
        return R.failure(new Error(`No saved conversation has id ${id}.`));
      const usable = await checkFolder(conversation.folder);
      if (!usable.ok) return usable;
      const resumed = await backend.resume({
        cwd: conversation.folder,
        sessionId: id,
      });
      if (!resumed.ok) return resumed;
      attach(resumed.value);
      return R.success({
        conversation,
        turnRunning: resumed.value.turnRunning,
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
}
