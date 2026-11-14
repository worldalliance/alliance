import { R, type Result } from "@alliance/common/result";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { milliseconds } from "date-fns";
import { User } from "src/user/entities/user.entity";
import { hashToken, randomToken } from "src/utils/random";
import type { Repository } from "src/utils/Repository";
import { LessThan } from "typeorm";
import { WebHandoff } from "./entities/web-handoff.entity";

export const WEB_HANDOFF_TTL_MS = milliseconds({ seconds: 60 });

export enum WebHandoffError {
  Invalid = "invalid",
}

@Injectable()
export class WebHandoffService {
  constructor(
    @InjectRepository(WebHandoff)
    private readonly handoffs: Repository<WebHandoff>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async create(userId: number): Promise<string> {
    const code = randomToken(32);
    const now = Date.now();
    await this.handoffs.delete({ expiresAt: LessThan(new Date(now)) });
    await this.handoffs.insert({
      codeHash: hashToken(code),
      userId,
      expiresAt: new Date(now + WEB_HANDOFF_TTL_MS),
    });
    return code;
  }

  /** Uses up the code: a second redemption, or one after it expires, fails. */
  async redeem(code: string): Promise<Result<User, WebHandoffError>> {
    const used = await this.handoffs
      .createQueryBuilder()
      .delete()
      .where(`"codeHash" = :codeHash AND "expiresAt" > :now`, {
        codeHash: hashToken(code),
        now: new Date(),
      })
      .returning(`"userId"`)
      .execute();
    const [row]: { userId: number }[] = used.raw;
    const user = row && (await this.users.findOneBy({ id: row.userId }));
    return user ? R.success(user) : R.failure(WebHandoffError.Invalid);
  }
}

/** A path on the site, never another origin: `//host` and backslashes are refused. */
export function sitePath(next: unknown, fallback: string): string {
  return typeof next === "string" && /^\/(?![/\\])[^\\]*$/.test(next)
    ? next
    : fallback;
}
