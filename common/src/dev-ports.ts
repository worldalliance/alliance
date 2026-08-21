// Worktree ports outrank ambient values that may belong to another checkout.
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { BASE_PORTS, DevService, MAX_PORT_SLOT } from "./dev-ports-base";
import { isDeployed, parseNodeEnv } from "./node-env";

const portSchema = z.number().int().min(1).max(65535);

const portsFileSchema = z.object({
  slot: z.number().int().min(1).max(MAX_PORT_SLOT),
  server: portSchema,
  frontend: portSchema,
  admin: portSchema,
  mobile: portSchema,
  database: z.string().min(1),
  testDatabase: z.string().min(1),
});

export type DevPorts = {
  slot: number;
  server: number;
  frontend: number;
  admin: number;
  mobile: number;
  /** null in the main checkout, which has no `.worktree/ports.json`. */
  database: string | null;
  testDatabase: string | null;
};

export type PortContext = {
  cwd: string;
  env: Record<string, string | undefined>;
};

function findPortsFile(cwd: string): string | null {
  let dir = cwd;

  for (;;) {
    // Stop at the checkout root so an ancestor's ports cannot rebind this one.
    // Linked worktrees have a .git file; main checkouts have a directory.
    if (fs.existsSync(path.join(dir, ".git"))) {
      const candidate = path.join(dir, ".worktree", "ports.json");
      return fs.existsSync(candidate) ? candidate : null;
    }

    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// Not PORT: apps/frontend/server.js reads that as its own listen port, so one
// name would mean two things in one repo.
const PORT_ENV_VAR: Record<DevService, string> = {
  [DevService.Server]: "SERVER_PORT",
  [DevService.Frontend]: "FRONTEND_PORT",
  [DevService.Admin]: "ADMIN_PORT",
  [DevService.Mobile]: "MOBILE_PORT",
};

function envPort(env: PortContext["env"], service: DevService): number {
  const name = PORT_ENV_VAR[service];
  const raw = env[name];
  if (!raw) return BASE_PORTS[service];

  const parsed = portSchema.safeParse(Number(raw));
  if (!parsed.success) throw new Error(`${name}=${raw} is not a valid port`);

  return parsed.data;
}

/**
 * Server callers honor deployed NODE_ENV values. Tooling ignores NODE_ENV
 * because Vite sets it to production before loading the config.
 */
export enum PortCaller {
  Server = "server",
  Tooling = "tooling",
}

const CONSULTS_NODE_ENV: Record<PortCaller, boolean> = {
  [PortCaller.Server]: true,
  [PortCaller.Tooling]: false,
};

function worktreeFileApplies(
  caller: PortCaller,
  env: PortContext["env"],
): boolean {
  if (!CONSULTS_NODE_ENV[caller]) return true;

  const nodeEnv = parseNodeEnv(env.NODE_ENV);

  if (!nodeEnv.ok) {
    throw new Error(
      `${nodeEnv.error.message}, and this checkout has a .worktree/ports.json whose ports and database apply only outside a deployed environment. Set NODE_ENV in server/.env.`,
    );
  }

  return !isDeployed(nodeEnv.value);
}

export function resolveDevPorts(
  caller: PortCaller,
  context: PortContext,
): DevPorts {
  const found = findPortsFile(context.cwd);
  const file = found && worktreeFileApplies(caller, context.env) ? found : null;

  if (!file) {
    return {
      slot: 0,
      server: envPort(context.env, DevService.Server),
      frontend: envPort(context.env, DevService.Frontend),
      admin: envPort(context.env, DevService.Admin),
      mobile: envPort(context.env, DevService.Mobile),
      database: null,
      testDatabase: null,
    };
  }

  try {
    return portsFileSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch (cause) {
    throw new Error(
      `${file} is malformed, and every port and database name this worktree uses comes from it. Rebuilding it needs the main checkout, so report this rather than editing it or falling back to the base ports.`,
      { cause },
    );
  }
}

/**
 * Rejects a port variable that disagrees with the worktree's own ports.
 *
 * A worktree takes every port from `.worktree/ports.json` and never reads these
 * variables, so one that disagrees moves nothing. Left unchecked, exporting
 * SERVER_PORT to shift the API looks like it worked until the requests keep
 * landing on the old port. No-op outside a worktree, where the variables are
 * the source rather than a stale copy of it.
 */
export function assertWorktreePorts({
  ports,
  env,
}: {
  ports: DevPorts;
  env: PortContext["env"];
}): void {
  if (ports.slot === 0) return;

  for (const service of Object.values(DevService)) {
    const name = PORT_ENV_VAR[service];
    const actual = env[name];
    if (!actual || Number(actual) === ports[service]) continue;

    throw new Error(
      `${name}=${actual} but this worktree owns port ${ports[service]} on slot ${ports.slot} (.worktree/ports.json), which is what the dev servers bind. Unset ${name} wherever you set it.`,
    );
  }
}

const cached = new Map<PortCaller, DevPorts>();

export function devPorts(caller: PortCaller): DevPorts {
  const hit = cached.get(caller);
  if (hit) return hit;

  const env = process.env;
  const resolved = resolveDevPorts(caller, { cwd: process.cwd(), env });
  assertWorktreePorts({ ports: resolved, env });
  cached.set(caller, resolved);
  return resolved;
}

/** Rejects tools that pin a fixed database and the base ports instead of resolving this checkout. */
export function assertNotWorktree({
  ports,
  what,
}: {
  ports: DevPorts;
  what: string;
}): void {
  if (ports.slot === 0) return;

  throw new Error(
    `${what} pins a fixed database and the base ports, so it does not work in this worktree, which owns ${ports.database} on slot ${ports.slot}. Report this rather than editing server/.env or .worktree/ports.json to get past it.`,
  );
}

export enum DevDatabase {
  Dev = "DB_NAME",
  Test = "TEST_DB_NAME",
}

const EXPECTED_DATABASE: Record<
  DevDatabase,
  (ports: DevPorts) => string | null
> = {
  [DevDatabase.Dev]: (ports) => ports.database,
  [DevDatabase.Test]: (ports) => ports.testDatabase,
};

const RESEED_DATABASE_BASE = "citesting_reseed";

/** Uses a separate namespace and the unique live slot to prevent cross-worktree drops without accumulating names. */
export function reseedDatabase(ports: DevPorts): string {
  return ports.slot === 0
    ? RESEED_DATABASE_BASE
    : `${RESEED_DATABASE_BASE}_${ports.slot}`;
}

const ALSO_OWNED: Record<DevDatabase, (ports: DevPorts) => string[]> = {
  [DevDatabase.Dev]: (ports) => [reseedDatabase(ports)],
  [DevDatabase.Test]: () => [],
};

/** No-op when this checkout has no `.worktree/ports.json`. */
export function assertWorktreeDatabase({
  ports,
  which,
  actual,
}: {
  ports: DevPorts;
  which: DevDatabase;
  actual: string | undefined;
}): void {
  const expected = EXPECTED_DATABASE[which](ports);
  if (expected === null || actual === expected) return;
  if (actual !== undefined && ALSO_OWNED[which](ports).includes(actual)) return;

  throw new Error(
    `${which}=${actual ?? "<unset>"} but this worktree owns ${expected} (.worktree/ports.json). Fix server/.env, or unset ${which} if you exported it in your shell.`,
  );
}

export enum DevUrl {
  Api = "ALLIANCE_DEV_API_URL",
  App = "ALLIANCE_DEV_APP_URL",
}

const DEV_URL_PORT: Record<DevUrl, (ports: DevPorts) => number> = {
  [DevUrl.Api]: (ports) => ports.server,
  [DevUrl.App]: (ports) => ports.frontend,
};

/** Accepts environment overrides only when no worktree ports contradict them. */
export function resolveDevUrl({
  ports,
  which,
  override,
}: {
  ports: DevPorts;
  which: DevUrl;
  override: string | undefined;
}): string {
  const port = DEV_URL_PORT[which](ports);

  if (!override) return `http://localhost:${port}`;

  if (ports.slot !== 0) {
    throw new Error(
      `${which}=${override} is set, but this worktree owns port ${port} (.worktree/ports.json). Unset it.`,
    );
  }

  return override;
}

export function devApiUrl(): string {
  return resolveDevUrl({
    ports: devPorts(PortCaller.Tooling),
    which: DevUrl.Api,
    override: process.env[DevUrl.Api],
  });
}

export function devAppUrl(): string {
  return resolveDevUrl({
    ports: devPorts(PortCaller.Tooling),
    which: DevUrl.App,
    override: process.env[DevUrl.App],
  });
}

// Keep these keys outside Vite's VITE_ namespace so `.env` files cannot
// override this checkout's resolved ports.
export function devViteDefine(): Record<string, string> {
  return {
    "import.meta.env.ALLIANCE_DEV_API_URL": JSON.stringify(devApiUrl()),
    "import.meta.env.ALLIANCE_DEV_APP_URL": JSON.stringify(devAppUrl()),
  };
}
