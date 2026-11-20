// A GIT_DIR or GIT_WORK_TREE inherited from a git hook or rebase would point git at another repository.
export const gitEnvironment = (env: NodeJS.ProcessEnv = process.env) =>
  Object.fromEntries(
    Object.entries(env).filter(([name]) => !name.startsWith("GIT_")),
  );
