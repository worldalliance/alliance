import 'dotenv/config';
import { DataSource } from 'typeorm';
import { AppTypeOrmLogger } from '../utils/typeorm-logger';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

export const connectionOptions = (): PostgresConnectionOptions => {
  const shared: PostgresConnectionOptions = {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? +process.env.DB_PORT : 5432,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    useUTC: true,
    maxQueryExecutionTime: 100,
    logging: ['error', 'warn'],
    logger: new AppTypeOrmLogger(),
  };

  return process.env.NODE_ENV === 'production' ||
    process.env.NODE_ENV === 'staging'
    ? {
        ...shared,
        ssl: {
          rejectUnauthorized: true,
          ca: process.env.DB_CA_CERT,
        },
        extra: {
          ssl: { rejectUnauthorized: true, ca: process.env.DB_CA_CERT },
        },
      }
    : {
        ...shared,
      };
};

/**
 * The DataSource the TypeORM CLI uses — `migration:run`, `migration:generate`
 * and `schema:log` all point at this file.
 *
 * `entities` is only needed here: the app registers its entities through
 * `TypeOrmModule.forFeature` and `autoLoadEntities`, so `connectionOptions()`
 * above deliberately has none. The CLI has no Nest container to learn them
 * from, and without them it cannot diff entities against the schema
 * (`migration:generate` and the drift check both go silent) nor create
 * TypeORM's `typeorm_metadata` table when a view or generated column needs it.
 */
const dataSource = new DataSource({
  ...connectionOptions(),
  entities: ['src/**/*.entity.ts'],
  logger: undefined,
  migrations: ['migrations/*{.ts,.js}'],
});
export default dataSource;
