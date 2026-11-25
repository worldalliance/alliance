#!/usr/bin/env bun
// Stands in for the claude executable in tests: replays the capture whose arguments match its own.
import { replayCapture } from "../../testing/replay-cli";
import { stdinShape } from "./capture";
import { stubCapturesVariable } from "./stub";

const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

await replayCapture({
  name: "stub-claude",
  capturesVariable: stubCapturesVariable,
  shape: stdinShape,
  // Session ids differ between the recorded run and a replay, so they compare as equal.
  normalizeArgs: (args) =>
    JSON.stringify(args.map((arg) => arg.replace(uuid, "<uuid>"))),
});
