import path from "node:path";

const dist = path.join(import.meta.dirname, "..", "dist");

/** Where `bun run package` leaves the app it builds for this platform, per package.json's build targets. */
export const packagedApp =
  process.platform === "darwin"
    ? {
        arch: "arm64",
        executable: path.join(
          dist,
          "mac-arm64/Alliance agent.app/Contents/MacOS/Alliance agent",
        ),
        resources: path.join(
          dist,
          "mac-arm64/Alliance agent.app/Contents/Resources",
        ),
      }
    : {
        arch: "x64",
        executable: path.join(dist, "linux-unpacked/alliance-agent"),
        resources: path.join(dist, "linux-unpacked/resources"),
      };
