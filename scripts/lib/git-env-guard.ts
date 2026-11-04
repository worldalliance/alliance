import { gitLocalEnvVars } from "./git";

// The root and scripts/ bunfigs preload this, and fixture-git.ts imports it for
// runs from other directories. Bun hands children the original environment however
// process.env is edited, and a throw at import fails one test file while the
// rest still run, so this exits.
const leaked = gitLocalEnvVars().filter(
  (name) => process.env[name] !== undefined,
);
if (leaked.length > 0) {
  console.error(
    `${leaked.join(", ")} set: run through scripts/test-all.sh, which unsets them, so fixture git commands can't write to the enclosing repository`,
  );
  process.exit(1);
}
