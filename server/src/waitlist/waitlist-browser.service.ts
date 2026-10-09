import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { milliseconds } from "date-fns";
import type { CookieOptions, Request, Response } from "express";
import { createHash } from "node:crypto";
import { UserService } from "src/user/user.service";
import { randomToken } from "src/utils/random";
import type { Repository } from "src/utils/Repository";
import { LessThan, MoreThan } from "typeorm";
import type { WaitlistBrowserDtoArgs } from "./dto/waitlist.dto";
import { WaitlistBrowser } from "./entities/waitlist-browser.entity";

export const WAITLIST_SESSION_COOKIE = "waitlist_session";
export const REMEMBERED_INVITE_COOKIE = "remembered_invite";

/** A persistent cookie older clients were given; read only to expire it. */
const LEGACY_BROWSER_COOKIE = "waitlist_browser";

const REMEMBER_MS = milliseconds({ days: 30 });

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

/**
 * What this browser may see again: its entry's confirmation for the browser
 * session, and a signup invite it opened. Neither cookie grants anything
 * beyond that.
 */
@Injectable()
export class WaitlistBrowserService {
  constructor(
    @InjectRepository(WaitlistBrowser)
    private readonly browserRepository: Repository<WaitlistBrowser>,
    private readonly userService: UserService,
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

  async rememberInvite(params: { res: Response; code: string }): Promise<void> {
    if (await this.userService.isInviteClaimable(params.code)) {
      params.res.cookie(REMEMBERED_INVITE_COOKIE, params.code, {
        ...cookieOptions(),
        maxAge: REMEMBER_MS,
      });
    }
  }

  private async expireLegacyBrowser(req: Request, res: Response) {
    const legacy = cookie(req, LEGACY_BROWSER_COOKIE);
    if (!legacy) return;
    await this.browserRepository.delete({ tokenHash: hashToken(legacy) });
    res.clearCookie(LEGACY_BROWSER_COOKIE, cookieOptions());
  }

  /** Clears each cookie that no longer names anything. */
  async find(req: Request, res: Response): Promise<WaitlistBrowserDtoArgs> {
    await this.expireLegacyBrowser(req, res);
    const token = cookie(req, WAITLIST_SESSION_COOKIE);
    const browser = token
      ? await this.browserRepository.findOne({
          where: {
            tokenHash: hashToken(token),
            expiresAt: MoreThan(new Date()),
          },
          relations: { entry: true },
        })
      : null;
    const inviteCode = cookie(req, REMEMBERED_INVITE_COOKIE);
    const claimable =
      inviteCode !== undefined &&
      (await this.userService.isInviteClaimable(inviteCode));

    if (token && !browser) {
      res.clearCookie(WAITLIST_SESSION_COOKIE, cookieOptions());
    }
    if (inviteCode && !claimable) {
      res.clearCookie(REMEMBERED_INVITE_COOKIE, cookieOptions());
    }
    return {
      entry: browser?.entry ?? null,
      inviteCode: claimable ? inviteCode : null,
    };
  }

  /** Leaves the entry, its invites, and any account session alone. */
  async forget(req: Request, res: Response): Promise<void> {
    await this.expireLegacyBrowser(req, res);
    const token = cookie(req, WAITLIST_SESSION_COOKIE);
    if (token) {
      await this.browserRepository.delete({ tokenHash: hashToken(token) });
    }
    res.clearCookie(WAITLIST_SESSION_COOKIE, cookieOptions());
    res.clearCookie(REMEMBERED_INVITE_COOKIE, cookieOptions());
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async forgetExpired(): Promise<void> {
    await this.browserRepository.delete({ expiresAt: LessThan(new Date()) });
  }
}
