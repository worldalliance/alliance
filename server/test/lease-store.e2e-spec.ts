import { type LockAcquireResult, LocksStorage } from "@nestjs/locks";
import { lockStoreContract } from "@nestjs/locks/testing";
import { Test } from "@nestjs/testing";
import { TypeOrmModule } from "@nestjs/typeorm";
import type { Subprocess } from "bun";
import { testConnectionOptions } from "src/datasources/dataSourceTest";
import { LeaseModule } from "src/leases/lease.module";
import { PgLockStore } from "src/leases/pg-lock-store";
import { closeTestApp, createTestApp, TestContext } from "./e2e-test-utils";

describe("PgLockStore (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp([]);
  }, 50000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  it("is the store LocksModule uses", () => {
    expect(ctx.app.get(LocksStorage).source).toBe(ctx.app.get(PgLockStore));
  });

  it("fails startup when another store replaces it", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          ...testConnectionOptions(),
          synchronize: false,
          dropSchema: false,
        }),
        LeaseModule,
      ],
    })
      .overrideProvider(PgLockStore)
      .useValue({})
      .compile();
    const app = moduleRef.createNestApplication();
    try {
      await expect(app.init()).rejects.toThrow("not on PgLockStore");
    } finally {
      await closeTestApp(app);
    }
  });

  describe("store contract", () => {
    const cases = lockStoreContract(() => ctx.app.get(PgLockStore), {
      concurrent: true,
    });
    for (const { name, run } of cases) it(name, run, 30_000);
  });

  describe("two processes racing for one key", () => {
    let contenders: Contender[];

    beforeAll(async () => {
      contenders = await Promise.all([startContender(), startContender()]);
    }, 30_000);

    afterAll(async () => {
      await Promise.all(contenders.map((contender) => contender.stop()));
    });

    it("lets exactly one win each round, with growing tokens", async () => {
      const key = "two-processes";
      let previous = 0;
      for (let round = 0; round < 20; round++) {
        const owners = contenders.map((_, i) => `round-${round}-process-${i}`);
        const answers = await Promise.all(
          contenders.map((contender, i) => contender.acquire(key, owners[i])),
        );
        const winners = answers.flatMap((answer, i) =>
          answer.acquired ? [{ i, token: answer.fencingToken }] : [],
        );
        expect(winners).toHaveLength(1);
        const [{ i, token }] = winners;
        expect(token).toBeGreaterThan(previous);
        previous = token;
        expect(await contenders[i].release(key, owners[i])).toBe(true);
      }
    }, 30_000);
  });
});

interface Contender {
  acquire(key: string, owner: string): Promise<LockAcquireResult>;
  release(key: string, owner: string): Promise<boolean>;
  stop(): Promise<void>;
}

async function startContender(): Promise<Contender> {
  const child: Subprocess<"pipe", "pipe", "inherit"> = Bun.spawn(
    [process.execPath, "test/lease-contender.ts"],
    {
      cwd: `${__dirname}/..`,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "inherit",
    },
  );
  const lines = readLines(child.stdout);
  const next = async () => {
    const { value, done } = await lines.next();
    if (done) throw new Error("the contender process exited");
    return JSON.parse(value);
  };
  const ask = async (command: string) => {
    await child.stdin.write(`${command}\n`);
    await child.stdin.flush();
    return next();
  };
  await next();
  return {
    acquire: (key, owner) => ask(`acquire ${key} ${owner}`),
    release: (key, owner) => ask(`release ${key} ${owner}`),
    async stop() {
      await child.stdin.end();
      await child.exited;
    },
  };
}

async function* readLines(stream: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  let buffered = "";
  for await (const chunk of stream) {
    buffered += decoder.decode(chunk, { stream: true });
    let newline: number;
    while ((newline = buffered.indexOf("\n")) !== -1) {
      yield buffered.slice(0, newline);
      buffered = buffered.slice(newline + 1);
    }
  }
}
