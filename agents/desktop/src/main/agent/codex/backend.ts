import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { R, type Result } from "../../../../../../common/src/result";
import {
  cancelKillAfterMs,
  couldNotStart,
  spawnSessionCli,
} from "../cli-process";
import { CliSession } from "../cli-session";
import {
  type AgentBackend,
  type AgentMessage,
  ImageMediaType,
} from "../session";
import { type SessionHooks, sessionRegistry } from "../session-registry";
import {
  checkCodexVersion,
  type CodexCli,
  codexConfigArgs,
  codexEnvironment,
  createCodexHome,
} from "./process";
import {
  CodexNoticeKind,
  initializeParams,
  readNotification,
  readThreadId,
  readTurnId,
  threadResumeParams,
  threadStartParams,
  turnStartParams,
} from "./protocol";
import type { TurnInterruptParams } from "./protocol/v2/TurnInterruptParams.gen";
import { RpcConnection } from "./rpc";
import { trustRepositoryHooks } from "./trust";

const imageExtension: Record<ImageMediaType, string> = {
  [ImageMediaType.Png]: "png",
  [ImageMediaType.Jpeg]: "jpg",
  [ImageMediaType.Gif]: "gif",
  [ImageMediaType.Webp]: "webp",
};

type Turn = {
  interrupted: boolean;
  /** Set once turn/started arrives or turn/start answers, whichever comes first, which an interrupt waits for. */
  id: string | undefined;
  interruptSent: boolean;
  /** Codex keeps an image in the thread's history once the turn starts, so its file goes when the turn ends. */
  imageDir: string | undefined;
};

function removeImages(turn: Turn): void {
  if (!turn.imageDir) return;
  const dir = turn.imageDir;
  rm(dir, { recursive: true, force: true }).catch((error: unknown) =>
    console.error(`Couldn't remove ${dir}: ${R.toError(error).message}`),
  );
}

class CodexSession extends CliSession<Turn> {
  private threadId = "";
  private readonly killAfterMs: number;
  readonly rpc: RpcConnection;

  constructor(
    init: SessionHooks & {
      child: ChildProcessWithoutNullStreams;
      killAfterMs: number;
    },
  ) {
    super({ ...init, product: "Codex" });
    this.killAfterMs = init.killAfterMs;
    this.rpc = new RpcConnection({
      input: init.child.stdout,
      output: init.child.stdin,
      onNotification: (notification) => this.handleNotification(notification),
      onServerRequest: (request) => {
        console.error(
          `session ${this.id}: unexpected ${request.method} request`,
        );
        this.rpc.respondMethodNotFound(
          request.id,
          `Alliance agent doesn't support ${request.method}.`,
        );
        if (this.turn && !this.turn.interrupted)
          this.emitError({
            message: `Codex asked for ${request.method}, which Alliance agent doesn't support.`,
            needsResume: false,
          });
      },
      onUnreadable: (line, error) => {
        console.error(`session ${this.id}: ${error.message}`, line);
        if (this.turn && !this.turn.interrupted)
          this.emitError({
            message: `Codex sent output Alliance agent can't read: ${error.message}`,
            needsResume: false,
          });
      },
    });
  }

  get id(): string {
    return this.threadId;
  }

  /** Called once, when thread/start or thread/resume has answered. */
  attachThread(threadId: string): void {
    this.threadId = threadId;
  }

  protected override onExited(message: string): void {
    this.rpc.close(new Error(message));
  }

  protected newTurn(): Turn {
    return {
      interrupted: false,
      id: undefined,
      interruptSent: false,
      imageDir: undefined,
    };
  }

  protected startTurn(turn: Turn, message: AgentMessage): void {
    void this.runTurn(turn, message);
  }

  // Ending stdin stops a running turn, runs the SessionEnd hooks and exits, idle or mid-turn, so the signals are only for a CLI that hangs.
  protected async shutDown(): Promise<void> {
    if (this.exited) return;
    if (this.turn) this.turn.interrupted = true;
    const { child } = this.init;
    child.stdin.end();
    const timers = [
      setTimeout(() => {
        child.kill("SIGTERM");
        timers.push(setTimeout(() => child.kill("SIGKILL"), cancelKillAfterMs));
      }, this.killAfterMs),
    ];
    await this.closed;
    timers.forEach(clearTimeout);
  }

  private async runTurn(turn: Turn, message: AgentMessage): Promise<void> {
    const images = await this.writeImages(turn, message);
    if (this.turn !== turn) return removeImages(turn);
    if (turn.interrupted) return this.endTurn({ interrupted: true });
    if (!images.ok) return this.failTurn(turn, images.error.message);
    const started = await this.rpc.request(
      "turn/start",
      turnStartParams({
        threadId: this.threadId,
        message,
        imagePaths: images.value,
      }),
    );
    if (started.ok) this.settleFirstMessageRead(true);
    if (this.turn !== turn) return;
    const turnId = R.flatMap(started, readTurnId);
    if (!turnId.ok) return this.failTurn(turn, turnId.error.message);
    turn.id ??= turnId.value;
    this.sendInterrupt(turn);
  }

  private async writeImages(
    turn: Turn,
    message: AgentMessage,
  ): Promise<Result<string[], Error>> {
    if (message.images.length === 0) return R.success([]);
    return R.fromPromise(
      (async () => {
        turn.imageDir = await mkdtemp(
          path.join(tmpdir(), "alliance-agent-image-"),
        );
        const dir = turn.imageDir;
        return Promise.all(
          message.images.map(async (image, index) => {
            const file = path.join(
              dir,
              `${index}.${imageExtension[image.mediaType]}`,
            );
            await writeFile(file, image.data, { mode: 0o600 });
            return file;
          }),
        );
      })(),
      (error) =>
        new Error(
          `Alliance agent couldn't save an image for Codex: ${R.toError(error).message}`,
        ),
    );
  }

  // A second turn/interrupt could reach the next turn, so each turn sends at most one, once its id is known.
  protected sendInterrupt(turn: Turn): void {
    if (!turn.interrupted || turn.interruptSent || turn.id === undefined)
      return;
    turn.interruptSent = true;
    void this.rpc
      .request("turn/interrupt", {
        threadId: this.threadId,
        turnId: turn.id,
      } satisfies TurnInterruptParams)
      .then((result) => {
        if (!result.ok && !this.exited)
          console.error(
            `session ${this.id}: turn/interrupt failed: ${result.error.message}`,
          );
      });
  }

  private handleNotification(notification: {
    method: string;
    params: unknown;
  }): void {
    const parsed = readNotification(notification, this.threadId);
    const turn = this.turn;
    if (!parsed.ok) {
      console.error(`session ${this.id}: ${parsed.error.message}`);
      if (!turn) return;
      const message = `Codex sent output Alliance agent can't read: ${parsed.error.message}`;
      // No turn/completed follows an unreadable one, so the turn ends here or every later send fails as mid-turn.
      if (notification.method === "turn/completed")
        return this.failTurn(turn, message);
      if (!turn.interrupted) this.emitError({ message, needsResume: false });
      return;
    }
    if (!turn) return;
    const notice = parsed.value;
    switch (notice.kind) {
      case CodexNoticeKind.TurnStarted:
        this.settleFirstMessageRead(true);
        turn.id ??= notice.turnId;
        this.sendInterrupt(turn);
        return;
      case CodexNoticeKind.Events:
        for (const event of notice.events) this.listeners.emit(event);
        return;
      case CodexNoticeKind.TurnEnded:
        if (notice.error && !turn.interrupted)
          this.emitError({ message: notice.error, needsResume: false });
        this.endTurn({ interrupted: turn.interrupted && notice.interrupted });
        return;
      default:
        throw new Error(`unknown notice kind: ${notice satisfies never}`);
    }
  }

  private failTurn(turn: Turn, message: string): void {
    if (!turn.interrupted) this.emitError({ message, needsResume: false });
    this.endTurn({ interrupted: false });
  }

  protected override endTurn(ended: { interrupted: boolean }): void {
    if (this.turn) removeImages(this.turn);
    super.endTurn(ended);
  }
}

export function createCodexBackend(
  cli: CodexCli,
  timing = {
    // Outlasts the repository's SessionEnd transcript upload, whose hook times out after 3 seconds, as Claude's close does its 10.
    killAfterMs: 15_000,
    // Bounds the handshake, since an app-server that never answers would hold up every later launch's setup.
    setupTimeoutMs: 30_000,
  },
): AgentBackend {
  const sessions = sessionRegistry();
  let versionChecked = false;
  // Every app-server shares cli.home: overlapping first launches race to create its sqlite state, and overlapping hook trust writes to its config.toml overwrite each other.
  let setupQueue: Promise<unknown> = Promise.resolve();
  const failedToStart = (cwd: string) => (error: unknown) =>
    couldNotStart({ executable: cli.executable, cwd, error });

  type Launch = SessionHooks & {
    cwd: string;
    openThread: (rpc: RpcConnection) => Promise<Result<string, Error>>;
  };

  /** Starts an app-server and opens its thread; a session whose handshake failed comes back with the failure, to be closed outside the queue. */
  async function setUp(
    params: Launch,
  ): Promise<
    Result<{ session: CodexSession; opened: Result<string, Error> }, Error>
  > {
    if (!versionChecked) {
      const checked = await checkCodexVersion(cli);
      if (!checked.ok) return checked;
      versionChecked = true;
    }
    const home = await createCodexHome(cli);
    if (!home.ok) return home;
    const child = await spawnSessionCli({
      executable: cli.executable,
      // --strict-config fails the launch on a key this version doesn't know, such as an override a later version renamed.
      args: [...codexConfigArgs, "app-server", "--strict-config"],
      cwd: params.cwd,
      env: codexEnvironment(cli.home),
    });
    if (!child.ok) return child;
    const session = new CodexSession({
      child: child.value,
      onClosing: params.onClosing,
      onExit: params.onExit,
      killAfterMs: timing.killAfterMs,
    });
    const deadline = setTimeout(
      () =>
        session.rpc.close(
          new Error(
            `Codex didn't finish setting up within ${timing.setupTimeoutMs / 1000} seconds.`,
          ),
        ),
      timing.setupTimeoutMs,
    );
    const opened = await handshake(session.rpc, params);
    clearTimeout(deadline);
    return R.success({ session, opened });
  }

  async function handshake(
    rpc: RpcConnection,
    params: Launch,
  ): Promise<Result<string, Error>> {
    const initialized = await rpc.request("initialize", initializeParams);
    if (!initialized.ok) return initialized;
    rpc.notify("initialized");
    const trusted = await trustRepositoryHooks(rpc, params.cwd);
    if (!trusted.ok) return trusted;
    return params.openThread(rpc);
  }

  async function launch(params: Launch): Promise<Result<CodexSession, Error>> {
    const setup = setupQueue.then(() => setUp(params));
    setupQueue = setup.catch(() => undefined);
    const set = await setup;
    if (!set.ok) return set;
    const { session, opened } = set.value;
    if (!opened.ok) {
      // Close may wait out the kill timeouts on an app-server that hangs; onClosing makes a resume of its thread wait for that.
      void session.close();
      return failedToStart(params.cwd)(opened.error);
    }
    session.attachThread(opened.value);
    return R.success(session);
  }

  return {
    start: ({ cwd }) =>
      sessions.launchNew((hooks) =>
        launch({
          cwd,
          ...hooks,
          openThread: async (rpc) =>
            R.flatMap(
              await rpc.request("thread/start", threadStartParams(cwd)),
              readThreadId,
            ),
        }).catch(failedToStart(cwd)),
      ),
    resume: ({ cwd, sessionId }) =>
      sessions.live(sessionId) ??
      sessions.launch(sessionId, (hooks) =>
        launch({
          cwd,
          ...hooks,
          openThread: async (rpc) =>
            R.flatMap(
              await rpc.request(
                "thread/resume",
                threadResumeParams({ cwd, threadId: sessionId }),
              ),
              readThreadId,
            ),
        }).catch(failedToStart(cwd)),
      ),
  };
}
