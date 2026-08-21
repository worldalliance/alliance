import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertNotWorktree,
  assertWorktreeDatabase,
  assertWorktreePorts,
  DevDatabase,
  DevUrl,
  PortCaller,
  reseedDatabase,
  resolveDevPorts,
  resolveDevUrl,
  type DevPorts,
  type PortContext,
} from "./dev-ports";
import { BASE_PORTS } from "./dev-ports-base";
import { NodeEnv } from "./node-env";

const fixtureRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".tmp-test",
  "dev-ports",
);

let sandbox = "";

beforeEach(() => {
  fs.mkdirSync(fixtureRoot, { recursive: true });
  sandbox = fs.mkdtempSync(path.join(fixtureRoot, "dev-ports-"));
});

afterAll(() => {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

const WORKTREE_PORTS: DevPorts = {
  slot: 3,
  server: 3305,
  frontend: 5473,
  admin: 5474,
  mobile: 8385,
  database: "alliance_three",
  testDatabase: "alliance_three_test",
};

const MAIN_CHECKOUT_PORTS: DevPorts = {
  slot: 0,
  ...BASE_PORTS,
  database: null,
  testDatabase: null,
};

function makeCheckout({
  root,
  git = "dir",
  ports,
}: {
  root: string;
  git?: "dir" | "file" | "none";
  ports?: object | string;
}): string {
  const dir = path.join(sandbox, root);
  fs.mkdirSync(dir, { recursive: true });

  if (git === "dir") fs.mkdirSync(path.join(dir, ".git"));
  if (git === "file") fs.writeFileSync(path.join(dir, ".git"), "gitdir: /x\n");

  if (ports !== undefined) {
    fs.mkdirSync(path.join(dir, ".worktree"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, ".worktree", "ports.json"),
      typeof ports === "string" ? ports : JSON.stringify(ports),
    );
  }

  return dir;
}

function resolve(
  caller: PortCaller,
  cwd: string,
  env: PortContext["env"] = {},
): DevPorts {
  return resolveDevPorts(caller, { cwd, env });
}

describe("resolveDevPorts", () => {
  describe("outside a worktree", () => {
    it("falls back to the base ports", () => {
      const dir = makeCheckout({ root: "main" });

      expect(resolve(PortCaller.Tooling, dir)).toEqual(MAIN_CHECKOUT_PORTS);
    });

    it("takes each port from the environment", () => {
      const dir = makeCheckout({ root: "main" });

      expect(
        resolve(PortCaller.Tooling, dir, {
          SERVER_PORT: "4005",
          FRONTEND_PORT: "6173",
          ADMIN_PORT: "6174",
          MOBILE_PORT: "9085",
        }),
      ).toEqual({
        slot: 0,
        server: 4005,
        frontend: 6173,
        admin: 6174,
        mobile: 9085,
        database: null,
        testDatabase: null,
      });
    });

    it("throws rather than falling back when a port variable is not a port", () => {
      const dir = makeCheckout({ root: "main" });

      expect(() =>
        resolve(PortCaller.Tooling, dir, { SERVER_PORT: "not-a-port" }),
      ).toThrow("SERVER_PORT=not-a-port is not a valid port");
      expect(() =>
        resolve(PortCaller.Tooling, dir, { ADMIN_PORT: "70000" }),
      ).toThrow("ADMIN_PORT=70000 is not a valid port");
    });

    it("treats an empty port variable as unset", () => {
      const dir = makeCheckout({ root: "main" });

      expect(resolve(PortCaller.Tooling, dir, { SERVER_PORT: "" }).server).toBe(
        BASE_PORTS.server,
      );
    });
  });

  describe("in a worktree", () => {
    it("reads .worktree/ports.json from an ancestor of the working directory", () => {
      const root = makeCheckout({
        root: "wt",
        git: "file",
        ports: WORKTREE_PORTS,
      });
      const nested = path.join(root, "apps", "frontend");
      fs.mkdirSync(nested, { recursive: true });

      expect(resolve(PortCaller.Tooling, nested)).toEqual(WORKTREE_PORTS);
    });

    it("outranks ambient port variables", () => {
      const root = makeCheckout({
        root: "wt",
        git: "file",
        ports: WORKTREE_PORTS,
      });

      expect(
        resolve(PortCaller.Tooling, root, {
          SERVER_PORT: "3005",
          FRONTEND_PORT: "5173",
        }),
      ).toEqual(WORKTREE_PORTS);
    });

    it("names the recovery when ports.json is unreadable", () => {
      for (const ports of ["{ not json", JSON.stringify({ slot: 3 })]) {
        const root = makeCheckout({
          root: `wt-${ports.length}`,
          git: "file",
          ports,
        });

        expect(() => resolve(PortCaller.Tooling, root)).toThrow(
          "report this rather than editing it or falling back to the base ports",
        );
      }
    });
  });

  describe("the walk", () => {
    it.each(["file", "dir"] as const)(
      "stops at a .git %s rather than reading a parent's ports.json",
      (git) => {
        makeCheckout({ root: "outer", git: "none", ports: WORKTREE_PORTS });
        const inner = makeCheckout({ root: "outer/inner", git });

        expect(resolve(PortCaller.Tooling, inner)).toEqual(MAIN_CHECKOUT_PORTS);
      },
    );

    it("ignores a ports.json that is not beside a .git", () => {
      makeCheckout({ root: "box" });
      const stray = makeCheckout({
        root: "box/home",
        git: "none",
        ports: WORKTREE_PORTS,
      });

      expect(
        resolve(PortCaller.Server, stray, { NODE_ENV: NodeEnv.Test }),
      ).toEqual(MAIN_CHECKOUT_PORTS);
    });
  });

  describe("NODE_ENV", () => {
    const worktree = () =>
      makeCheckout({ root: "wt", git: "file", ports: WORKTREE_PORTS });

    it.each([NodeEnv.Production, NodeEnv.Staging])(
      "leaves the deployed server on SERVER_PORT under %s",
      (nodeEnv) => {
        expect(
          resolve(PortCaller.Server, worktree(), {
            NODE_ENV: nodeEnv,
            SERVER_PORT: "8080",
          }),
        ).toEqual({ ...MAIN_CHECKOUT_PORTS, server: 8080 });
      },
    );

    it.each([NodeEnv.Development, NodeEnv.Test])(
      "gives the server the worktree's ports under %s",
      (nodeEnv) => {
        expect(
          resolve(PortCaller.Server, worktree(), { NODE_ENV: nodeEnv }),
        ).toEqual(WORKTREE_PORTS);
      },
    );

    // Guessing "deployed" here would select the main checkout's database.
    it.each([undefined, "", "qa", "Production"])(
      "refuses to guess for the server when NODE_ENV is %p",
      (nodeEnv) => {
        expect(() =>
          resolve(PortCaller.Server, worktree(), { NODE_ENV: nodeEnv }),
        ).toThrow(/\.worktree\/ports\.json/);
      },
    );

    it.each([undefined, "qa"])(
      "has nothing to guess about outside a worktree when NODE_ENV is %s",
      (nodeEnv) => {
        const main = makeCheckout({ root: "main" });

        expect(resolve(PortCaller.Server, main, { NODE_ENV: nodeEnv })).toEqual(
          MAIN_CHECKOUT_PORTS,
        );
      },
    );

    // Vite sets NODE_ENV=production before loading its config.
    it("is ignored by tooling", () => {
      expect(
        resolve(PortCaller.Tooling, worktree(), {
          NODE_ENV: NodeEnv.Production,
        }),
      ).toEqual(WORKTREE_PORTS);
    });
  });
});

describe("assertNotWorktree", () => {
  it("lets the main checkout through", () => {
    expect(() =>
      assertNotWorktree({
        ports: MAIN_CHECKOUT_PORTS,
        what: "the screenshot run",
      }),
    ).not.toThrow();
  });

  it("names the worktree and tells the caller to report rather than edit", () => {
    expect(() =>
      assertNotWorktree({ ports: WORKTREE_PORTS, what: "the screenshot run" }),
    ).toThrow(
      "the screenshot run pins a fixed database and the base ports, so it does not work in this worktree, which owns alliance_three on slot 3. Report this rather than editing server/.env or .worktree/ports.json to get past it.",
    );
  });
});

describe("assertWorktreePorts", () => {
  it("has nothing to check outside a worktree, where the variables decide", () => {
    expect(() =>
      assertWorktreePorts({
        ports: MAIN_CHECKOUT_PORTS,
        env: { SERVER_PORT: "4005", FRONTEND_PORT: "6173" },
      }),
    ).not.toThrow();
  });

  it("passes when no port variable is set", () => {
    expect(() =>
      assertWorktreePorts({ ports: WORKTREE_PORTS, env: {} }),
    ).not.toThrow();
  });

  it("passes when every variable repeats the worktree's own ports", () => {
    expect(() =>
      assertWorktreePorts({
        ports: WORKTREE_PORTS,
        env: {
          SERVER_PORT: "3305",
          FRONTEND_PORT: "5473",
          ADMIN_PORT: "5474",
          MOBILE_PORT: "8385",
        },
      }),
    ).not.toThrow();
  });

  it.each([
    ["SERVER_PORT", "3999", 3305],
    ["FRONTEND_PORT", "5173", 5473],
    ["ADMIN_PORT", "5174", 5474],
    ["MOBILE_PORT", "8085", 8385],
  ])("names %s and the port this worktree owns", (name, actual, owned) => {
    expect(() =>
      assertWorktreePorts({ ports: WORKTREE_PORTS, env: { [name]: actual } }),
    ).toThrow(
      `${name}=${actual} but this worktree owns port ${owned} on slot 3 (.worktree/ports.json)`,
    );
  });

  it("treats an empty variable as unset rather than as a mismatch", () => {
    expect(() =>
      assertWorktreePorts({ ports: WORKTREE_PORTS, env: { SERVER_PORT: "" } }),
    ).not.toThrow();
  });
});

describe("assertWorktreeDatabase", () => {
  it("passes when the name matches the worktree's", () => {
    expect(() =>
      assertWorktreeDatabase({
        ports: WORKTREE_PORTS,
        which: DevDatabase.Dev,
        actual: "alliance_three",
      }),
    ).not.toThrow();
  });

  it("has nothing to check outside a worktree", () => {
    expect(() =>
      assertWorktreeDatabase({
        ports: MAIN_CHECKOUT_PORTS,
        which: DevDatabase.Dev,
        actual: "alliance",
      }),
    ).not.toThrow();
  });

  it("throws when DB_NAME points at another checkout's database", () => {
    expect(() =>
      assertWorktreeDatabase({
        ports: WORKTREE_PORTS,
        which: DevDatabase.Dev,
        actual: "alliance",
      }),
    ).toThrow("DB_NAME=alliance but this worktree owns alliance_three");
  });

  it("checks TEST_DB_NAME against the test database, and names it when unset", () => {
    expect(() =>
      assertWorktreeDatabase({
        ports: WORKTREE_PORTS,
        which: DevDatabase.Test,
        actual: undefined,
      }),
    ).toThrow(
      "TEST_DB_NAME=<unset> but this worktree owns alliance_three_test",
    );
  });

  it("passes this checkout's reseed database as DB_NAME", () => {
    expect(() =>
      assertWorktreeDatabase({
        ports: WORKTREE_PORTS,
        which: DevDatabase.Dev,
        actual: "citesting_reseed_3",
      }),
    ).not.toThrow();
  });

  it("throws on another slot's reseed database", () => {
    expect(() =>
      assertWorktreeDatabase({
        ports: WORKTREE_PORTS,
        which: DevDatabase.Dev,
        actual: "citesting_reseed_4",
      }),
    ).toThrow(
      "DB_NAME=citesting_reseed_4 but this worktree owns alliance_three",
    );
  });

  it("does not accept the reseed database as TEST_DB_NAME", () => {
    expect(() =>
      assertWorktreeDatabase({
        ports: WORKTREE_PORTS,
        which: DevDatabase.Test,
        actual: "citesting_reseed_3",
      }),
    ).toThrow("this worktree owns alliance_three_test");
  });
});

describe("reseedDatabase", () => {
  it("is unsuffixed in the main checkout", () => {
    expect(reseedDatabase(MAIN_CHECKOUT_PORTS)).toBe("citesting_reseed");
  });

  // Keyed by slot, not by name: two live checkouts never share a slot, and the
  // set stays bounded as worktrees come and go.
  it("takes the slot in a worktree", () => {
    expect(reseedDatabase(WORKTREE_PORTS)).toBe("citesting_reseed_3");
  });
});

describe("resolveDevUrl", () => {
  it.each([
    [DevUrl.Api, "http://localhost:3305"],
    [DevUrl.App, "http://localhost:5473"],
  ])("builds %s from this checkout's port", (which, expected) => {
    expect(
      resolveDevUrl({ ports: WORKTREE_PORTS, which, override: undefined }),
    ).toBe(expected);
  });

  it("takes an override in the main checkout, which has no ports.json to contradict", () => {
    expect(
      resolveDevUrl({
        ports: MAIN_CHECKOUT_PORTS,
        which: DevUrl.Api,
        override: "http://api.test",
      }),
    ).toBe("http://api.test");
  });

  it("throws rather than letting an override outrank a worktree", () => {
    expect(() =>
      resolveDevUrl({
        ports: WORKTREE_PORTS,
        which: DevUrl.Api,
        override: "http://localhost:3005",
      }),
    ).toThrow(
      "ALLIANCE_DEV_API_URL=http://localhost:3005 is set, but this worktree owns port 3305",
    );
  });

  it("treats an empty override as unset", () => {
    expect(
      resolveDevUrl({ ports: WORKTREE_PORTS, which: DevUrl.App, override: "" }),
    ).toBe("http://localhost:5473");
  });
});
