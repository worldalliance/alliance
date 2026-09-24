import { spawn, type ChildProcess } from "child_process";

export type OnSpawn = (child: ChildProcess) => void;

export const run = (
  command: string,
  args: string[],
  options: {
    cwd: string;
    env?: NodeJS.ProcessEnv;
    stdin?: string;
    onSpawn?: OnSpawn;
  },
) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: [
        options.stdin === undefined ? "inherit" : "pipe",
        "inherit",
        "inherit",
      ],
    });
    options.onSpawn?.(child);

    if (options.stdin !== undefined) child.stdin?.end(options.stdin);

    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else
        reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
