import type { Request } from "express";

/** The address a request's one-time-code rate limits count against. */
export function clientIp(req: Request): string {
  return req.ip ?? "unknown";
}
