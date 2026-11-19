import { expect, test } from "bun:test";
import { CaptureRecordKind } from "./capture-record";
import { redactLines } from "./redact-lines";

const out = (delta: string) =>
  JSON.stringify({
    kind: CaptureRecordKind.Out,
    text: JSON.stringify({ delta }),
  });

test("redacts a path split across fragments of a block that never marks its start", () => {
  expect(
    redactLines({
      lines: [out("/Users/al"), out("ice/x")],
      rules: [[/\/Users\/alice/g, "/Users/me"]],
      streamedLine: (stdout) => ({
        block: "text",
        startsBlock: false,
        fragment: { key: "delta", text: JSON.parse(stdout).delta },
      }),
    }),
  ).toEqual([out("/Users/me"), out("/x")]);
});
