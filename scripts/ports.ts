/*
 * Prints this checkout's ports as KEY=value lines. --base prints unslotted
 * constants without ambient overrides; a field name prints one raw value.
 * The dev and test database fields print nothing in the main checkout, which
 * takes those names from server/.env instead.
 */
import { z } from "zod";
import {
  devPorts,
  type DevPorts,
  PortCaller,
  reseedDatabase,
} from "../common/src/dev-ports";
import {
  BASE_PORTS,
  MAX_PORT_SLOT,
  PORT_SLOT_STRIDE,
} from "../common/src/dev-ports-base";

enum Field {
  Server = "server",
  Frontend = "frontend",
  Admin = "admin",
  Mobile = "mobile",
  Database = "database",
  TestDatabase = "test-database",
  ReseedDatabase = "reseed-database",
}

type FieldValue = (ports: DevPorts) => string | number | null;

const FIELD_VALUE: Record<Field, FieldValue> = {
  [Field.Server]: (ports) => ports.server,
  [Field.Frontend]: (ports) => ports.frontend,
  [Field.Admin]: (ports) => ports.admin,
  [Field.Mobile]: (ports) => ports.mobile,
  [Field.Database]: (ports) => ports.database,
  [Field.TestDatabase]: (ports) => ports.testDatabase,
  [Field.ReseedDatabase]: reseedDatabase,
};

const fieldSchema = z.enum(Field);

function emit(values: Record<string, number>): void {
  for (const [key, value] of Object.entries(values)) {
    console.log(`${key}=${value}`);
  }
}

function usage(): never {
  console.error(
    `usage: bun scripts/ports.ts [--base | ${Object.values(Field).join(" | ")}]`,
  );
  process.exit(2);
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length > 1) usage();

  if (args[0] === "--base") {
    emit({
      BASE_SERVER_PORT: BASE_PORTS.server,
      BASE_FRONTEND_PORT: BASE_PORTS.frontend,
      BASE_ADMIN_PORT: BASE_PORTS.admin,
      BASE_MOBILE_PORT: BASE_PORTS.mobile,
      PORT_SLOT_STRIDE,
      MAX_PORT_SLOT,
    });
    return;
  }

  if (args.length === 1) {
    const field = fieldSchema.safeParse(args[0]);
    if (!field.success) usage();

    const value = FIELD_VALUE[field.data](devPorts(PortCaller.Tooling));
    if (value !== null) console.log(value);
    return;
  }

  const ports = devPorts(PortCaller.Tooling);

  emit({
    SLOT: ports.slot,
    SERVER_PORT: ports.server,
    FRONTEND_PORT: ports.frontend,
    ADMIN_PORT: ports.admin,
    MOBILE_PORT: ports.mobile,
  });
}

main();
