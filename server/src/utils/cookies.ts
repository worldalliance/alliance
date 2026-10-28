import type { Request } from "express";

export function readCookie(req: Request, name: string): string | undefined {
  const value: unknown = req.cookies?.[name];
  return typeof value === "string" && value ? value : undefined;
}
