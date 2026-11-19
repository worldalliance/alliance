#!/usr/bin/env bun
// Stands in for the codex executable in tests: replays the capture whose arguments match its own.
import { replayCapture } from "../../testing/replay-cli";
import { stdinShape } from "./capture";
import { stubCapturesVariable } from "./stub";

await replayCapture({
  name: "stub-codex",
  capturesVariable: stubCapturesVariable,
  shape: stdinShape,
  normalizeArgs: (args) => JSON.stringify(args),
});
