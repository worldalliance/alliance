import { R, type Result } from "@alliance/common/result";

export function readFileDataUri(file: File): Promise<Result<string, Error>> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(R.success(reader.result));
        return;
      }
      resolve(R.failure(new Error(`Could not read ${file.name}`)));
    };
    reader.onerror = () =>
      resolve(
        R.failure(reader.error ?? new Error(`Could not read ${file.name}`)),
      );
    reader.readAsDataURL(file);
  });
}
