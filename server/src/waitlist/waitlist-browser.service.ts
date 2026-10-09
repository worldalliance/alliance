import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { milliseconds } from "date-fns";
import type { CookieOptions, Request, Response } from "express";
import { createHash } from "node:crypto";
import { randomToken } from "src/utils/random";
import type { Repository } from "src/utils/Repository";
import { LessThan, MoreThan } from "typeorm";
import { WaitlistBrowser } from "./entities/waitlist-browser.entity";
import type { WaitlistEntry } from "./entities/waitlist-entry.entity";

export const WAITLIST_SESSION_COOKIE = "waitlist_session";

/** Persistent cookies older clients were given; read only to expire them. */
const LEGACY_BROWSER_COOKIE = "waitlist_browser";
const LEGACY_INVITE_COOKIE = "remembered_invite";

/** The browser session ends the cookie sooner; this bounds a restored one. */
const SESSION_MAX_MS = milliseconds({ days: 30 });

const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/",
});

const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("base64url");

const cookie = (req: Request, name: string): string | undefined => {
  const value: unknown = req.cookies?.[name];
  return typeof value === "string" && value ? value : undefined;
};

/** What this browser session may see again: its entry's confirmation. */
@Injectable()
export class WaitlistBrowserService {
  constructor(
    @InjectRepository(WaitlistBrowser)
    private readonly browserRepository: Repository<WaitlistBrowser>,
  ) {}

  /** A session cookie: no `Max-Age` or `Expires`. */
  async rememberEntry(params: {
    res: Response;
    entryId: number;
  }): Promise<void> {
    const token = randomToken(32);
    await this.browserRepository.insert({
      tokenHash: hashToken(token),
      entryId: params.entryId,
      expiresAt: new Date(Date.now() + SESSION_MAX_MS),
    });
    params.res.cookie(WAITLIST_SESSION_COOKIE, token, cookieOptions());
  }

  private async expireLegacyCookies(req: Request, res: Response) {
    const legacy = cookie(req, LEGACY_BROWSER_COOKIE);
    if (legacy) {
      await this.browserRepository.delete({ tokenHash: hashToken(legacy) });
      res.clearCookie(LEGACY_BROWSER_COOKIE, cookieOptions());
    }
    if (cookie(req, LEGACY_INVITE_COOKIE)) {
      res.clearCookie(LEGACY_INVITE_COOKIE, cookieOptions());
    }
  }

  async findEntry(req: Request, res: Response): Promise<WaitlistEntry | null> {
    await this.expireLegacyCookies(req, res);
    const token = cookie(req, WAITLIST_SESSION_COOKIE);
    if (!token) return null;
    const browser = await this.browserRepository.findOne({
      where: { tokenHash: hashToken(token), expiresAt: MoreThan(new Date()) },
      relations: { entry: true },
    });
    if (!browser) res.clearCookie(WAITLIST_SESSION_COOKIE, cookieOptions());
    return browser?.entry ?? null;
  }

  /** Leaves the entry, its invites, and any account session alone. */
  async forget(req: Request, res: Response): Promise<void> {
    await this.expireLegacyCookies(req, res);
    const token = cookie(req, WAITLIST_SESSION_COOKIE);
    if (token) {
      await this.browserRepository.delete({ tokenHash: hashToken(token) });
    }
    res.clearCookie(WAITLIST_SESSION_COOKIE, cookieOptions());
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async forgetExpired(): Promise<void> {
    await this.browserRepository.delete({ expiresAt: LessThan(new Date()) });
  }
}
