import { R, type Result } from "@alliance/common/result";

export type CommandFailure = {
  command: string;
  exitCode: number;
  stderr: string;
};

export function describeFailure(failure: CommandFailure): string {
  const detail = failure.stderr ? `: ${failure.stderr}` : "";
  return `${failure.command} exited ${failure.exitCode}${detail}`;
}

export async function runCommand(params: {
  command: string[];
  cwd: string;
}): Promise<Result<string, CommandFailure>> {
  const spawned = R.fromThrowable(() =>
    Bun.spawn(params.command, {
      cwd: params.cwd,
      stdout: "pipe",
      stderr: "pipe",
    }),
  );
  if (!spawned.ok) {
    return R.failure({
      command: params.command.join(" "),
      exitCode: -1,
      stderr: spawned.error.message,
    });
  }

  const proc = spawned.value;
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  return exitCode === 0
    ? R.success(stdout)
    : R.failure({
        command: params.command.join(" "),
        exitCode,
        stderr: stderr.trim(),
      });
}

export async function git(params: {
  args: string[];
  cwd: string;
}): Promise<Result<string, CommandFailure>> {
  return runCommand({ command: ["git", ...params.args], cwd: params.cwd });
}

export async function gitText(params: {
  args: string[];
  cwd: string;
}): Promise<Result<string, string>> {
  return R.mapError(await git(params), describeFailure);
}

export function lines(text: string): string[] {
  return text.split("\n").filter((line) => line.length > 0);
}
