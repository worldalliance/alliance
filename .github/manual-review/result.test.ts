import { describe, expect, test } from "bun:test";

function extract(events: unknown[]) {
  return Bun.spawnSync(["jq", "-ner", "-f", `${import.meta.dir}/result.jq`], {
    stdin: Buffer.from(events.map((event) => JSON.stringify(event)).join("\n")),
  });
}

describe("manual review result", () => {
  test("extracts the final review without intermediate tool output", () => {
    const result = extract([
      { type: "assistant", message: "Inspecting the change" },
      { type: "result", is_error: false, result: "## Summary\n\nReviewed." },
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toBe("## Summary\n\nReviewed.\n");
  });

  test("rejects failed, missing, and empty results", () => {
    for (const events of [
      [],
      [{ type: "assistant", message: "Incomplete review" }],
      [{ type: "result", is_error: true, result: "Authentication failed" }],
      [{ type: "result", is_error: false, result: "" }],
      [{ type: "result", is_error: false, result: " \n\t" }],
      [{ type: "result", is_error: false, result: null }],
      [{ type: "result", is_error: false }],
    ]) {
      expect(extract(events).exitCode).not.toBe(0);
    }
  });

  test("uses the last result after background work resumes the agent", () => {
    const result = extract([
      { type: "result", is_error: false, result: "Preliminary review" },
      { type: "system", subtype: "task_notification" },
      { type: "result", is_error: false, result: "Completed review" },
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toBe("Completed review\n");
  });

  test("a successful earlier result cannot hide a failed continuation", () => {
    const result = extract([
      { type: "result", is_error: false, result: "Preliminary review" },
      { type: "result", is_error: true, result: "Continuation failed" },
    ]);
    expect(result.exitCode).not.toBe(0);
    expect(result.stdout.toString()).toBe("");
  });
});
