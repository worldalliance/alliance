import { devPorts, PortCaller } from "../../common/src/dev-ports";
import { mintAccessToken } from "./access-token";
import { queryLocalDb } from "./local-db";

const API = `http://localhost:${devPorts(PortCaller.Tooling).server}`;

const tokens = new Map<number, string>();
export async function api<T>(params: {
  as: number;
  method: string;
  route: string;
  body?: unknown;
}): Promise<T> {
  if (!tokens.has(params.as)) tokens.set(params.as, mintAccessToken(params.as));
  const response = await fetch(`${API}${params.route}`, {
    method: params.method,
    headers: {
      Authorization: `Bearer ${tokens.get(params.as)}`,
      "Content-Type": "application/json",
    },
    body: params.body === undefined ? undefined : JSON.stringify(params.body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `${params.method} ${params.route} as ${params.as}: ${response.status} ${text}`,
    );
  }
  return JSON.parse(text || "null");
}

export function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function actionIdByName(name: string): number | null {
  const [row] = queryLocalDb<{ id: number }>(
    `SELECT id FROM action WHERE name = ${sqlString(name)} AND "deletedAt" IS NULL`,
  );
  return row?.id ?? null;
}

export function firstAdminId(): number {
  const [admin] = queryLocalDb<{ id: number }>(
    `SELECT id FROM "user" WHERE admin ORDER BY id LIMIT 1`,
  );
  if (!admin) throw new Error("no admin user in the local db");
  return admin.id;
}
