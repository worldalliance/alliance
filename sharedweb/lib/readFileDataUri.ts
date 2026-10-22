import { R, type Result } from "@alliance/common/result";

/**
 * A signal that aborts settles the read as a failure like any other, so a
 * caller that can cancel should check `signal.aborted` before showing the
 * message.
 */
export function readFileDataUri(
  file: File,
  signal?: AbortSignal,
): Promise<Result<string, Error>> {
  return new Promise((resolve) => {
    const unreadable = () =>
      R.failure(new Error(`Could not read ${file.name}`));
    const cancelled = () =>
      R.failure(new Error(`Cancelled reading ${file.name}`));
    if (signal?.aborted) {
      resolve(cancelled());
      return;
    }

    const reader = new FileReader();
    const settle = (result: Result<string, Error>) => {
      signal?.removeEventListener("abort", abort);
      resolve(result);
    };
    const abort = () => {
      reader.abort();
      settle(cancelled());
    };

    reader.onload = () =>
      settle(
        typeof reader.result === "string"
          ? R.success(reader.result)
          : unreadable(),
      );
    reader.onerror = () =>
      settle(reader.error ? R.failure(reader.error) : unreadable());
    signal?.addEventListener("abort", abort, { once: true });
    reader.readAsDataURL(file);
  });
}
