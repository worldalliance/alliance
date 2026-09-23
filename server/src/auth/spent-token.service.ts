import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash } from "node:crypto";
import { LessThan, type Repository } from "typeorm";
import { SpentToken } from "./entities/spent-token.entity";

@Injectable()
export class SpentTokenService {
  constructor(
    @InjectRepository(SpentToken)
    private spentTokens: Repository<SpentToken>,
  ) {}

  /**
   * True the first time a credential is presented and false on every repeat.
   * The insert decides, so two requests racing the same credential cannot both
   * be told they were first.
   */
  async spend(params: {
    credential: string;
    retainForMs: number;
  }): Promise<boolean> {
    const inserted = await this.spentTokens
      .createQueryBuilder()
      .insert()
      .values({
        hash: createHash("sha256")
          .update(params.credential)
          .digest("base64url"),
        expiresAt: new Date(Date.now() + params.retainForMs),
      })
      .orIgnore()
      .returning("hash")
      .execute();
    return inserted.raw.length > 0;
  }

  @Cron(CronExpression.EVERY_HOUR)
  async forgetExpired(): Promise<void> {
    await this.spentTokens.delete({ expiresAt: LessThan(new Date()) });
  }
}
