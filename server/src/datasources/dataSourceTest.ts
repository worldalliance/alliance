import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const testConnectionOptions = (): TypeOrmModuleOptions => {
  return {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '5432'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    autoLoadEntities: true,
    synchronize: true,
    dropSchema: true,
  };
};
