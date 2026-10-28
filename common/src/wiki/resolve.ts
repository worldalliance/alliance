import { R, type Result } from "../result";

export enum LinkKind {
  External = "external",
  Local = "local",
}

export type ResolvedLink =
  | { kind: LinkKind.External; url: string }
  | { kind: LinkKind.Local; path: string; fragment: string | undefined };

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function dirname(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash < 0 ? "" : path.slice(0, slash);
}

/** Repo-relative POSIX path for `relative` from directory `base`; fails once it climbs above the repo root. */
function joinRepoPath({
  base,
  relative,
  url,
}: {
  base: string;
  relative: string;
  url: string;
}): Result<string, string> {
  const parts: string[] = [];
  for (const part of `${base}/${relative}`.split("/")) {
    if (part === "" || part === ".") continue;
    if (part !== "..") parts.push(part);
    else if (parts.pop() === undefined) {
      return R.failure(`"${url}" points outside the repository`);
    }
  }
  return R.success(parts.join("/"));
}

/** Resolves `url` as written in the repo file `fromPath`, the way GitHub's Markdown view does for relative links. Rejects root-relative links and query strings, which GitHub accepts. */
export function resolveLink({
  fromPath,
  url,
}: {
  fromPath: string;
  url: string;
}): Result<ResolvedLink, string> {
  if (SCHEME.test(url) || url.startsWith("//")) {
    return R.success({ kind: LinkKind.External, url });
  }
  const hash = url.indexOf("#");
  const rawPath = hash < 0 ? url : url.slice(0, hash);
  const rawFragment = hash < 0 ? "" : url.slice(hash + 1);
  if (rawPath.includes("?")) {
    return R.failure(`remove the query string from "${url}"`);
  }
  if (rawPath.startsWith("/")) {
    return R.failure(`use a relative path instead of "${url}"`);
  }
  const decoded = R.fromThrowable(() => ({
    path: decodeURIComponent(rawPath),
    fragment: decodeURIComponent(rawFragment) || undefined,
  }));
  if (!decoded.ok) return R.failure(`malformed percent-encoding in "${url}"`);
  const { fragment } = decoded.value;
  const path =
    decoded.value.path === ""
      ? R.success(fromPath)
      : joinRepoPath({
          base: dirname(fromPath),
          relative: decoded.value.path,
          url,
        });
  if (!path.ok) return path;
  return R.success({ kind: LinkKind.Local, path: path.value, fragment });
}
