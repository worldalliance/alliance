/*
 * Prints a dotenv-parsed value, or nothing when absent. Shell database commands
 * use this parser so comments and quotes cannot change a DROP target.
 */
import { envFileValue } from "../common/src/dev-database";

function main(): void {
  const args = process.argv.slice(2);

  if (args.length !== 2) {
    console.error("usage: bun scripts/env-value.ts <file> <key>");
    process.exit(2);
  }

  const [file, key] = args;
  const value = envFileValue(file, key);

  if (value !== null) console.log(value);
}

main();
