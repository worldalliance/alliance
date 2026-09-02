import {
  checkQuote,
  componentsFor,
  parseCommits,
  parseFileHistory,
  Refusal,
  repoRelative,
  splitTarget,
  type Components,
} from "./provenance";

describe("checkQuote", () => {
  const refusal = (quote: string) => {
    const checked = checkQuote(quote);
    return checked.ok ? null : checked.error;
  };

  it("refuses a quote that only approves", () => {
    for (const quote of [
      "sounds good",
      "Sounds good, ship it!",
      "go with your recommendation",
      "yes",
    ])
      expect([quote, refusal(quote)]).toEqual([quote, Refusal.ApprovalOnly]);
  });

  it("refuses the phrasings around each of those, not just the exact words", () => {
    for (const quote of [
      "sounds good to me",
      "yeah sounds good",
      "ok go ahead",
      "yes please",
      "looks great",
      "sure thing",
      "that works",
      "fine by me",
      "makes sense to me",
      "go with your recommendation then",
      "whatever you prefer",
      "your choice",
      "i'll trust you",
      "do whatever you think is best",
      "let's do it",
      "yup",
      "approve",
      "sounds reasonable",
      "i'm on board",
    ])
      expect([quote, refusal(quote)]).toEqual([quote, Refusal.ApprovalOnly]);
  });

  /*
   * The vocabulary will always miss a phrasing. What it misses has to land on
   * the floor rather than in the store, so these are the cases that decide
   * whether the vocabulary being incomplete matters.
   */
  it("refuses an approval the vocabulary has never heard of", () => {
    for (const quote of ["no objections", "+1", "go with your gut"])
      expect([quote, refusal(quote)]).toEqual([quote, Refusal.TooThin]);
  });

  it("refuses a quote with no words in it", () => {
    expect(refusal("")).toBe(Refusal.NoWords);
    expect(refusal("👍")).toBe(Refusal.NoWords);
  });

  it("keeps a quote that states something alongside the approval", () => {
    for (const quote of [
      "yes. use SQLite, not Postgres",
      "sounds good, but it must work offline",
      "clicking X sometimes deletes Y",
      "the delete button doesn't work",
      "no dark mode",
      "it crashes on ios",
    ])
      expect([quote, refusal(quote)]).toEqual([quote, null]);
  });
});

describe("splitTarget", () => {
  it("leaves a bare path alone", () => {
    expect(splitTarget("server/src/main.ts")).toEqual([
      "server/src/main.ts",
      null,
    ]);
  });

  it("turns a line and a line range into a -L argument", () => {
    expect(splitTarget("server/src/main.ts:140")).toEqual([
      "server/src/main.ts",
      "140,140",
    ]);
    expect(splitTarget("server/src/main.ts:140-190")).toEqual([
      "server/src/main.ts",
      "140,190",
    ]);
  });
});

describe("repoRelative", () => {
  const root = "/repo";

  it("normalizes every spelling of the same file", () => {
    const target = (t: string) =>
      repoRelative({ root, cwd: "/repo", target: t });
    expect(target("scripts/prov.ts")).toBe("scripts/prov.ts");
    expect(target("./scripts/prov.ts")).toBe("scripts/prov.ts");
    expect(target("/repo/scripts/prov.ts")).toBe("scripts/prov.ts");
  });

  it("resolves a path typed from a subdirectory", () => {
    expect(
      repoRelative({ root, cwd: "/repo/server", target: "src/main.ts" }),
    ).toBe("server/src/main.ts");
  });

  it("refuses a path outside the repo", () => {
    expect(() =>
      repoRelative({ root, cwd: "/repo", target: "/etc/passwd" }),
    ).toThrow("outside the repo");
    expect(() => repoRelative({ root, cwd: "/repo", target: "." })).toThrow(
      "outside the repo",
    );
  });
});

describe("componentsFor", () => {
  const components: Components = {
    server: { paths: ["server/**"] },
    tooling: { paths: ["scripts/**", "deploy/**"] },
    provenance: { paths: [".provenance/**", "scripts/prov.ts"] },
  };

  it("matches every component whose globs cover the path", () => {
    expect(componentsFor({ path: "scripts/prov.ts", components })).toEqual([
      "tooling",
      "provenance",
    ]);
    expect(
      componentsFor({ path: "server/src/user/user.service.ts", components }),
    ).toEqual(["server"]);
  });

  it("returns nothing for a path no component claims", () => {
    expect(componentsFor({ path: "package.json", components })).toEqual([]);
  });
});

describe("parseCommits", () => {
  const entry = (sha: string, subject: string, trailers: string) =>
    `${sha}\x1f${subject}\x1f${trailers}\x1e`;

  it("reads the trailers of each commit", () => {
    expect(
      parseCommits(
        entry("a".repeat(40), "no trailer", "") +
          entry("b".repeat(40), "one", "pv_1") +
          entry("c".repeat(40), "two", "pv_1\x1dpv_2"),
      ),
    ).toEqual([
      { sha: "a".repeat(40), subject: "no trailer", changes: [] },
      { sha: "b".repeat(40), subject: "one", changes: ["pv_1"] },
      { sha: "c".repeat(40), subject: "two", changes: ["pv_1", "pv_2"] },
    ]);
  });

  it("reads nothing out of empty output", () => {
    expect(parseCommits("")).toEqual([]);
  });
});

describe("parseFileHistory", () => {
  const entry = (sha: string, ...paths: string[]) =>
    `\x1e${sha}\n\n${paths.join("\n")}\n`;

  it("collects the commits that touched each path, newest first", () => {
    expect(
      parseFileHistory(
        entry("ccc", "human/b.yaml") +
          entry("bbb", "human/a.yaml", "human/b.yaml") +
          entry("aaa", "human/a.yaml"),
      ),
    ).toEqual(
      new Map([
        ["human/b.yaml", ["ccc", "bbb"]],
        ["human/a.yaml", ["bbb", "aaa"]],
      ]),
    );
  });

  it("keeps a path git no longer lists in HEAD, which is how a deletion shows up", () => {
    expect(
      parseFileHistory(entry("bbb") + entry("aaa", "human/gone.yaml")),
    ).toEqual(new Map([["human/gone.yaml", ["aaa"]]]));
  });

  it("reads nothing out of empty output", () => {
    expect(parseFileHistory("")).toEqual(new Map());
  });
});
