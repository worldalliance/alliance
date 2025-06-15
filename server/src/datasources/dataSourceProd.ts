import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const prodConnectionOptions = (): TypeOrmModuleOptions => {
  return {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? +process.env.DB_PORT : 5432,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    synchronize: false,
    logging: false,
    autoLoadEntities: true,
    migrations: ['dist/db/migrations/*{.ts,.js}'],
    ssl: { rejectUnauthorized: false },
    extra: { ssl: { rejectUnauthorized: false } }, //TODO
  };
};
