import { LIKE_ORDER_RANK_FN_UP_SQL } from "@alliance/common/likeOrder";
import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { DataSource } from "typeorm";

/**
 * Installs the SQL twin of `likeOrderRank` on boot, keeping DB ordering in sync
 * without a migration for each hash tweak.
 */
@Injectable()
export class LikeOrderFunctionService implements OnApplicationBootstrap {
  private readonly logger = new Logger(LikeOrderFunctionService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.dataSource.query(LIKE_ORDER_RANK_FN_UP_SQL);
    this.logger.log("likeOrderRank SQL function installed");
  }
}
