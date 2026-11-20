import { accessSync, constants, statSync } from "node:fs";
import path from "node:path";
import { R } from "../../../../common/src/result";

/** The first executable file named command in a folder on env's PATH. */
export const findOnPath = (
  command: string,
  env: NodeJS.ProcessEnv,
): string | undefined =>
  (env.PATH ?? "")
    .split(path.delimiter)
    .filter(Boolean)
    .map((dir) => path.resolve(dir, command))
    .find((file) => {
      const isFile = R.fromThrowable(() => {
        accessSync(file, constants.X_OK);
        return statSync(file).isFile();
      });
      return R.isSuccess(isFile) && isFile.value;
    });
