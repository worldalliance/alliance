import "dotenv/config";

import { DataSource } from "typeorm";
import { connectionOptions } from "./connection-options";

/**
 * The DataSource the TypeORM CLI uses — `migration:run`, `migration:generate`
 * and `schema:log` all point at this file.
 *
 * `entities` is only needed here: the app registers its entities through
 * `TypeOrmModule.forFeature` and `autoLoadEntities`, so `connectionOptions()`
 * deliberately has none. The CLI has no Nest container to learn them
 * from, and without them it cannot diff entities against the schema
 * (`migration:generate` and the drift check both go silent) nor create
 * TypeORM's `typeorm_metadata` table when a view or generated column needs it.
 */
const dataSource = new DataSource({
  ...connectionOptions(),
  entities: ["src/**/*.entity.ts"],
  logger: undefined,
  migrations: ["migrations/*{.ts,.js}"],
});
export default dataSource;
