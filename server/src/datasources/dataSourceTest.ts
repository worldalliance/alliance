import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const testConnectionOptions = (): TypeOrmModuleOptions => {
  return {
    type: 'sqlite',
    database: ':memory:',
    dropSchema: true,
    autoLoadEntities: true,
    synchronize: true,
  };
};
