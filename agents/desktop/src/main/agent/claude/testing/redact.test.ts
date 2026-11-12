import { expect, test } from "bun:test";
import { CaptureRecordKind } from "./capture";
import { redactCapture } from "./redact";

const machine = {
  repo: "/src/alliance-wt",
  mainCheckout: "/src/alliance",
  home: "/Users/sam",
  account: "sam",
};
const record = (text: unknown) =>
  JSON.stringify({ kind: CaptureRecordKind.Out, text: JSON.stringify(text) });

test("replaces the machine's paths and account name", () => {
  expect(
    redactCapture(
      record({
        cwd: "/src/alliance-wt/x",
        trust: "/src/alliance",
        sibling: "/src/alliance-other",
        backup: "/src/alliance.bak",
        sentence: "in /src/alliance-wt.",
        log: "/Users/sam/.log",
        other: "/Users/samuel/x",
        by: "sam\\n",
        after: "by\nsam\tsam",
        words: "samuel sam_dev xsam",
        ls: "\u001b[33msam\u001b[0m",
        bell: "\u0007sam",
        erase: "\u001b[2Ksam",
        input: '{"c": "\\u0007sam \\u001b[2Ksam \\\\sam"}',
      }),
      machine,
    ),
  ).toBe(
    record({
      cwd: "/repo/x",
      trust: "/repo",
      sibling: "/src/alliance-other",
      backup: "/src/alliance.bak",
      sentence: "in /repo.",
      log: "/home/user/.log",
      other: "/Users/samuel/x",
      by: "user\\n",
      after: "by\nuser\tuser",
      words: "samuel sam_dev xsam",
      ls: "\u001b[33muser\u001b[0m",
      bell: "\u0007user",
      erase: "\u001b[2Kuser",
      input: '{"c": "\\u0007user \\u001b[2Kuser \\\\user"}',
    }),
  );
});

test("leaves JSON escapes alone when the account name is a letter", () => {
  const line = record({ text: "a\nb\tc", input: '{"c": "a\\nb"}' });
  expect(redactCapture(line, { ...machine, account: "n" })).toBe(line);
});

const deltaOf = (type: string, key: string) => (fragment: string) =>
  record({
    type: "stream_event",
    parent_tool_use_id: null,
    event: {
      type: "content_block_delta",
      index: 0,
      delta: { type, [key]: fragment },
    },
  });
const delta = deltaOf("input_json_delta", "partial_json");
const start = record({
  type: "stream_event",
  parent_tool_use_id: null,
  event: {
    type: "content_block_start",
    index: 0,
    content_block: { type: "tool_use" },
  },
});
const streamed = (fragments: string[]) =>
  [start, ...fragments.map(delta)].join("\n");

test.each([
  ["input_json_delta", "partial_json"],
  ["text_delta", "text"],
  ["thinking_delta", "thinking"],
])("replaces a path a block streams across %s lines", (type, key) => {
  const delta = deltaOf(type, key);
  expect(
    redactCapture(
      [start, delta('{"p": "/src/al'), delta("liance-wt/x"), delta('"}')].join(
        "\n",
      ),
      machine,
    ),
  ).toBe([start, delta('{"p": "/repo'), delta("/x"), delta('"}')].join("\n"));
});

test("redacts a block another block at its index follows", () => {
  expect(
    redactCapture(
      [start, delta("/src/al"), delta("liance-wt"), start, delta("x")].join(
        "\n",
      ),
      machine,
    ),
  ).toBe([start, delta("/repo"), delta(""), start, delta("x")].join("\n"));
});

test("keeps a subagent's block at the same index apart", () => {
  const sub = JSON.parse(JSON.parse(delta("x")).text);
  const subagent = record({ ...sub, parent_tool_use_id: "t" });
  expect(
    redactCapture(
      [start, delta("/src/al"), subagent, delta("liance-wt")].join("\n"),
      machine,
    ),
  ).toBe([start, delta("/repo"), subagent, delta("")].join("\n"));
});

const stderr = (text: string) =>
  JSON.stringify({ kind: CaptureRecordKind.Stderr, text });

test("replaces a path stderr writes across chunks", () => {
  expect(
    redactCapture(
      [stderr("config in /Users/sa"), start, stderr("m/x\n")].join("\n"),
      machine,
    ),
  ).toBe([stderr("config in /home/user"), start, stderr("/x\n")].join("\n"));
});

test("replaces the account name after a control character on stderr", () => {
  expect(redactCapture(stderr("\u0007sam here"), machine)).toBe(
    stderr("\u0007user here"),
  );
});

test("keeps a stderr chunk that parses as JSON as written", () => {
  expect(redactCapture(stderr('{"p": "/Users/sam/x"}\n'), machine)).toBe(
    stderr('{"p": "/home/user/x"}\n'),
  );
});

test("fails on a line naming a connector that isn't a capture record", () => {
  expect(() => redactCapture(`${start}\ngarbage claude_ai`, machine)).toThrow(
    "line 2 mentions claude.ai but isn't a capture record with JSON stdout",
  );
});

test("fails on a line that isn't a capture record", () => {
  expect(() => redactCapture(`${start}\ngarbage`, machine)).toThrow(
    "line 2 isn't a capture record",
  );
});

test("fails on a delta the CLI escaped differently from JSON.stringify", () => {
  const escaped = JSON.stringify({
    kind: CaptureRecordKind.Out,
    text: JSON.stringify({
      type: "stream_event",
      parent_tool_use_id: null,
      event: {
        type: "content_block_delta",
        index: 0,
        delta: { type: "input_json_delta", partial_json: "/src/al" },
      },
    }).replaceAll("/", "\\u002f"),
  });
  expect(() =>
    redactCapture([start, escaped, delta("liance-wt")].join("\n"), machine),
  ).toThrow("line 2 doesn't write its delta text as JSON.stringify does");
});

test.each([
  [
    ["/Users/sam", "/github/alliance-wt/x"],
    ["/repo", "/x"],
  ],
  [
    ["/Users/sam/github/alliance", "-wt/x"],
    ["/repo", "/x"],
  ],
  [
    ["at /Users/sam ", "😀", "😀 end"],
    ["at /home/user ", "😀", "😀 end"],
  ],
  [
    ["/Users/sam", "uel/x"],
    ["/Users/sam", "uel/x"],
  ],
  [
    ["/Users/sam/github/alliance", "-other"],
    ["/home/user/github/alliance", "-other"],
  ],
])(
  "redacts %j where the whole path ends, not where a fragment does",
  (fragments, expected) => {
    const underHome = {
      repo: "/Users/sam/github/alliance-wt",
      mainCheckout: "/Users/sam/github/alliance",
      home: "/Users/sam",
      account: "sam",
    };
    expect(redactCapture(streamed(fragments), underHome)).toBe(
      streamed(expected),
    );
  },
);

test("drops the account's claude.ai connectors and their tools", () => {
  expect(
    redactCapture(
      [
        record({
          type: "system",
          tools: ["Bash", "mcp__claude_ai_Drive__search", "mcp__local__run"],
          mcp_servers: [
            { name: "claude.ai Drive", source: "claudeai" },
            { name: "claude.ai Gmail", status: "connected" },
            { name: "local", source: "project" },
          ],
        }),
        JSON.stringify({ kind: CaptureRecordKind.Exit, code: 0 }),
      ].join("\n"),
      machine,
    ),
  ).toBe(
    [
      record({
        type: "system",
        tools: ["Bash", "mcp__local__run"],
        mcp_servers: [{ name: "local", source: "project" }],
      }),
      JSON.stringify({ kind: CaptureRecordKind.Exit, code: 0 }),
    ].join("\n"),
  );
});

test("drops a connector whose marker holds the account name", () => {
  expect(
    redactCapture(
      record({
        type: "system",
        mcp_servers: [{ name: "claude.ai Gmail", status: "connected" }],
      }),
      { ...machine, account: "ai" },
    ),
  ).toBe(record({ type: "system", mcp_servers: [] }));
});

test.each([
  ["a key the parser reads", record({ type: "system" }), "type"],
  [
    "an event type into another",
    record({
      type: "assistant",
      parent_tool_use_id: null,
      message: { content: [{ type: "text", text: "hi" }] },
    }),
    "assistant",
  ],
  ["a capture record's key", record({ type: "system" }), "kind"],
  [
    "a tool name",
    record({
      type: "assistant",
      parent_tool_use_id: null,
      message: {
        content: [{ type: "tool_use", id: "t", name: "Edit", input: {} }],
      },
    }),
    "Edit",
  ],
  [
    "an argument the stub matches",
    JSON.stringify({ kind: CaptureRecordKind.Start, args: ["--verbose"] }),
    "verbose",
  ],
  [
    "a stdin subtype the stub matches",
    JSON.stringify({
      kind: CaptureRecordKind.In,
      text: JSON.stringify({
        type: "control_request",
        request: { subtype: "interrupt" },
      }),
    }),
    "interrupt",
  ],
])("fails when the account name rewrites %s", (_, line, account) => {
  expect(() => redactCapture(line, { ...machine, account })).toThrow(
    `the account name ${account} as a word the CLI's output uses`,
  );
});

test("names what a path rule changed in what the adapter reads", () => {
  expect(() =>
    redactCapture(
      JSON.stringify({
        kind: CaptureRecordKind.Start,
        args: ["--add-dir", machine.repo],
      }),
      machine,
    ),
  ).toThrow(`from ["--add-dir","${machine.repo}"] to ["--add-dir","/repo"]`);
});

test("fails when the recorded session called a claude.ai connector", () => {
  expect(() =>
    redactCapture(
      record({
        type: "assistant",
        message: {
          content: [{ type: "tool_use", name: "mcp__claude_ai_Drive__search" }],
        },
      }),
      machine,
    ),
  ).toThrow("still mentions claude.ai");
});

test("fails when a line other than stdout names a claude.ai connector", () => {
  expect(() =>
    redactCapture(
      JSON.stringify({
        kind: CaptureRecordKind.Stderr,
        text: "mcp__claude_ai_Drive failed",
      }),
      machine,
    ),
  ).toThrow("still mentions claude.ai");
  expect(() =>
    redactCapture(
      JSON.stringify({
        kind: CaptureRecordKind.Stderr,
        text: "claude.ai Gmail failed",
      }),
      machine,
    ),
  ).toThrow("still mentions claude.ai");
});

test("fails when a redacted key collides with another key", () => {
  expect(() =>
    redactCapture(record({ type: "system", sam: 1, user: 2 }), machine),
  ).toThrow("keys sam and user both redact to user");
});
