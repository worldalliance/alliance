import 'dotenv/config';
import { DataSource } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

export const connectionOptions = (): PostgresConnectionOptions => {
  return process.env.NODE_ENV === 'production' ||
    process.env.NODE_ENV === 'staging'
    ? {
        type: 'postgres',
        host: process.env.DB_HOST,
        port: process.env.DB_PORT ? +process.env.DB_PORT : 5432,
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        entities: ['dist/**/*.entity{.ts,.js}'],
        ssl: { rejectUnauthorized: false },
        extra: { ssl: { rejectUnauthorized: false } }, //TODO
      }
    : {
        type: 'postgres',
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT ?? '5432'),
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        entities: ['dist/**/*.entity{.ts,.js}'],
      };
};

// verison used for migrations only
const dataSource = new DataSource({
  ...connectionOptions(),
  migrations: ['dist/migrations/*{.ts,.js}'],
});
export default dataSource;
